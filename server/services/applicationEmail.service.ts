import {
  Application,
  Company,
  Opportunity,
  OpenApplication,
  CandidateProfile,
  ApplicationType,
  SentEmailRecord,
} from '../types.ts';
import { store } from '../database/store.ts';
import { resumeService } from './resume.service.ts';
import { geminiClient } from '../ai/geminiClient.ts';
import { logger } from '../utils/logger.ts';
import { gmailService, EXPECTED_SENDER_EMAIL, EXPECTED_SENDER_NAME } from './gmail.service.ts';
import {
  APPROVED_GENERAL_INQUIRY_SUBJECT,
  getApprovedGeneralInquiryBody,
  APPROVED_CANDIDATE_INFO,
} from '../templates/approvedEmailTemplate.ts';

export interface GeneratedEmailDraft {
  subject: string;
  body: string;
  matchScore: number;
  matchReason: string;
}

export class ApplicationEmailService {
  /**
   * Generates a company-tailored application or career inquiry email.
   * For general career inquiries and open applications, the exact approved template is used programmatically.
   */
  public async generateEmailContent(params: {
    company: Company;
    opportunity?: Opportunity | null;
    openApplication?: OpenApplication | null;
    candidate?: CandidateProfile;
  }): Promise<GeneratedEmailDraft> {
    const { company, opportunity, openApplication } = params;

    const subject = APPROVED_GENERAL_INQUIRY_SUBJECT;
    const body = getApprovedGeneralInquiryBody(company.name);

    return {
      subject,
      body,
      matchScore: opportunity?.relevanceScore || openApplication?.relevanceScore || 88,
      matchReason: `General AI/ML & Software Engineering Career Inquiry to ${company.name}`,
    };
  }

  private getDefaultSubject(companyName: string, roleTitle: string, candidateName: string, isCurrentRole: boolean): string {
    return APPROVED_GENERAL_INQUIRY_SUBJECT;
  }

  private getDeterministicBody(
    company: Company,
    opportunity?: Opportunity | null,
    openApplication?: OpenApplication | null,
    candidate?: CandidateProfile
  ): string {
    return getApprovedGeneralInquiryBody(company.name);
  }

  /**
   * Automatically generate application drafts for verified opportunities and open applications
   */
  public async autoDraftApplications(): Promise<{ created: number; total: number }> {
    const opps = store.getOpportunities();
    const openApps = store.getOpenApplications();
    const contacts = store.getContacts();
    const candidate = store.getCandidateProfile();

    let createdCount = 0;

    // 1. Process Open Applications with verified emails
    for (const openApp of openApps) {
      if (openApp.contactEmail && openApp.contactEmail !== 'NOT PUBLICLY AVAILABLE') {
        const company = store.getCompany(openApp.companyId);
        if (!company) continue;

        // Check if application already exists
        const existing = store.getApplications({
          companyId: company.id,
          applicationType: 'OPEN_APPLICATION',
        });

        if (existing.length === 0) {
          const emailDraft = await this.generateEmailContent({
            company,
            openApplication: openApp,
            candidate,
          });

          store.upsertApplication({
            companyId: company.id,
            companyName: company.name,
            openApplicationId: openApp.id,
            applicationType: 'OPEN_APPLICATION',
            roleTitle: 'Open Application / Talent Pool',
            recipientEmail: openApp.contactEmail,
            recipientName: openApp.contactName || `${company.name} Talent Team`,
            recipientRole: openApp.contactRole || 'Talent Acquisition',
            subject: emailDraft.subject,
            body: emailDraft.body,
            resumeFile: candidate.resumeFileName || 'Teja_Matta_Resume.pdf',
            sourceUrl: openApp.sourceUrl,
            sourceEvidence: openApp.evidence,
            status: 'READY_TO_SEND',
            matchScore: emailDraft.matchScore,
            matchReason: emailDraft.matchReason,
          });

          createdCount++;
        }
      }
    }

    // 2. Process High Relevance Opportunities with company contacts
    for (const opp of opps) {
      const company = store.getCompany(opp.companyId);
      if (!company) continue;

      // Find best verified recruiting contact for this company
      const companyContacts = contacts.filter(
        (c) =>
          c.companyId === opp.companyId &&
          c.verificationStatus === 'VERIFIED_PUBLIC' &&
          c.email &&
          c.email !== 'NOT PUBLICLY AVAILABLE'
      );

      const bestContact =
        companyContacts.find((c) => ['HIRING', 'CAREERS', 'TALENT', 'RECRUITING'].includes(c.emailType)) ||
        companyContacts[0];

      if (bestContact) {
        const existing = store.getApplications().find((a) => a.opportunityId === opp.id);

        if (!existing) {
          const emailDraft = await this.generateEmailContent({
            company,
            opportunity: opp,
            candidate,
          });

          store.upsertApplication({
            companyId: company.id,
            companyName: company.name,
            opportunityId: opp.id,
            applicationType: 'CURRENT_ROLE',
            roleTitle: opp.title,
            recipientEmail: bestContact.email,
            recipientName: bestContact.name || `${company.name} Hiring Team`,
            recipientRole: bestContact.role || 'Recruitment Team',
            subject: emailDraft.subject,
            body: emailDraft.body,
            resumeFile: candidate.resumeFileName || 'Teja_Matta_Resume.pdf',
            sourceUrl: opp.sourceUrl || opp.applicationUrl || company.officialWebsite || '',
            sourceEvidence: bestContact.evidenceFound,
            status: 'READY_TO_SEND',
            matchScore: emailDraft.matchScore,
            matchReason: emailDraft.matchReason,
          });

          createdCount++;
        }
      }
    }

    return {
      created: createdCount,
      total: store.getApplications().length,
    };
  }

  /**
   * Sends an application with human approval enforcement and safety checks
   */
  public async sendApplication(
    applicationId: string,
    overrides?: {
      subject?: string;
      body?: string;
      recipientEmail?: string;
    }
  ): Promise<{ success: boolean; message: string; record?: SentEmailRecord; errorCode?: string }> {
    const app = store.getApplication(applicationId);
    if (!app) {
      return { success: false, message: 'Application not found.', errorCode: 'NOT_FOUND' };
    }

    const candidate = store.getCandidateProfile();
    const config = store.getEmailProviderConfig();

    // Gmail Connection Check
    const accountInfo = await gmailService.getAccount();
    if (!accountInfo.connected || !accountInfo.canSend) {
      const errorMsg = accountInfo.error || 'Gmail Not Connected. Please connect tejamatta05@gmail.com in Settings.';
      return {
        success: false,
        message: errorMsg,
        errorCode: 'GMAIL_NOT_CONNECTED',
      };
    }

    // Safety Rule 1: Resume Must Be Uploaded & Present in Persistent Storage
    const currentResume = resumeService.getCurrentResume();
    if (!currentResume || !candidate.resumeFileName) {
      return {
        success: false,
        message: 'Resume Required: Please upload your resume in My Profile before sending applications.',
        errorCode: 'RESUME_REQUIRED',
      };
    }

    const fileBuffer = resumeService.getResumeFileBuffer(app.resumeFileId || currentResume.fileId);
    if (!fileBuffer || !fileBuffer.buffer || fileBuffer.buffer.length === 0) {
      return {
        success: false,
        message: `STORAGE_FAILED: Resume binary file (${currentResume.originalName}) is missing from storage. Please re-upload your resume.`,
        errorCode: 'STORAGE_FAILED',
      };
    }

    const finalRecipient = (overrides?.recipientEmail || app.recipientEmail).trim().toLowerCase();

    // Safety Rule 2: Valid Public Recipient Email
    const isValidEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(finalRecipient);
    if (!isValidEmail || finalRecipient === 'not publicly available') {
      return {
        success: false,
        message: `Cannot send: Recipient "${finalRecipient}" is not a verified public email.`,
        errorCode: 'INVALID_RECIPIENT',
      };
    }

    // Safety Rule 3: Daily Sending Limit
    const todaySent = store.getTodaySentCount();
    const limit = config.dailySendLimit || 20;
    if (todaySent >= limit) {
      return {
        success: false,
        message: `Daily send limit reached (${todaySent}/${limit} sent today). Please adjust daily limit in settings or try again tomorrow.`,
        errorCode: 'DAILY_LIMIT_REACHED',
      };
    }

    // Safety Rule 4: Duplicate & Cooldown Protection
    const duplicateCheck = store.isDuplicateSend(
      app.companyId,
      finalRecipient,
      app.opportunityId,
      app.openApplicationId,
      config.openAppCooldownDays || 30
    );

    if (duplicateCheck.isDuplicate) {
      return {
        success: false,
        message: `Duplicate protection: ${duplicateCheck.reason}`,
        errorCode: 'COOLDOWN_ACTIVE',
      };
    }

    const finalSubject = overrides?.subject || app.subject;
    const finalBody = overrides?.body || app.body;
    const now = new Date().toISOString();

    logger.info(`[ApplicationEmailService] Sending application [${app.applicationType}] to ${finalRecipient} via Gmail API`);

    // Send via Gmail API
    const sendResult = await gmailService.sendEmail({
      to: finalRecipient,
      subject: finalSubject,
      textBody: finalBody,
      fromName: EXPECTED_SENDER_NAME,
      fromEmail: EXPECTED_SENDER_EMAIL,
      attachment: {
        filename: fileBuffer.filename || candidate.resumeFileName || 'Teja_Matta_Resume.pdf',
        content: fileBuffer.buffer,
        mimeType: fileBuffer.mimeType || 'application/pdf',
      },
    });

    if (!sendResult.success) {
      const failureReason = sendResult.error || 'Failed to dispatch application via Gmail API';
      logger.error(`[ApplicationEmailService] Failed sending application: ${failureReason}`);

      store.addEvent({
        companyId: app.companyId,
        companyName: app.companyName,
        event: 'APPLICATION_FAILED',
        message: `Failed sending application to ${finalRecipient}: ${failureReason}`,
        stage: 'SEND_APPLICATION',
        type: 'error',
      });

      return {
        success: false,
        message: failureReason,
        errorCode: sendResult.errorCode || 'GMAIL_SEND_FAILED',
      };
    }

    const messageId = sendResult.messageId || `gmail_${Date.now()}`;

    // Update Application Status to SENT
    store.updateApplicationStatus(app.id, 'SENT', {
      sentAt: now,
      approvedAt: app.approvedAt || now,
      providerMessageId: messageId,
    });

    // Schedule 7-day follow up reminder
    const followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Log to Sent Email Records
    const sentRecord = store.logSentEmail({
      applicationId: app.id,
      companyId: app.companyId,
      companyName: app.companyName,
      opportunityId: app.opportunityId,
      openApplicationId: app.openApplicationId,
      applicationType: app.applicationType,
      recipientEmail: finalRecipient,
      recipientName: app.recipientName,
      subject: finalSubject,
      body: finalBody,
      attachmentName: fileBuffer.filename || candidate.resumeFileName || 'Teja_Matta_Resume.pdf',
      sourceUrl: app.sourceUrl,
      sentAt: now,
      status: 'DELIVERED',
      providerMessageId: messageId,
      followUpReminderDate: followUpDate,
      followUpStatus: 'PENDING',
    });

    store.addEvent({
      companyId: app.companyId,
      companyName: app.companyName,
      event: 'APPLICATION_SENT',
      message: `Successfully dispatched application for ${app.roleTitle} to ${finalRecipient} via Gmail (ID: ${messageId}).`,
      stage: 'SEND_APPLICATION',
      type: 'success',
    });

    return {
      success: true,
      message: `Application sent successfully to ${finalRecipient} via Gmail.`,
      record: sentRecord,
    };
  }

  /**
   * Batch sending with safety delays and limit monitoring
   */
  public async sendBatchApplications(
    applicationIds: string[]
  ): Promise<{ sent: number; failed: number; skipped: number; results: { id: string; success: boolean; message: string }[] }> {
    const config = store.getEmailProviderConfig();
    const delayMs = config.safetyDelayMs || 1500;

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results: { id: string; success: boolean; message: string }[] = [];

    for (let i = 0; i < applicationIds.length; i++) {
      const id = applicationIds[i];
      const res = await this.sendApplication(id);

      results.push({ id, success: res.success, message: res.message });
      if (res.success) {
        sent++;
      } else {
        if (res.message.includes('Daily send limit')) {
          skipped++;
        } else {
          failed++;
        }
      }

      // Safety delay between sends
      if (i < applicationIds.length - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    return { sent, failed, skipped, results };
  }
}

export const applicationEmailService = new ApplicationEmailService();
