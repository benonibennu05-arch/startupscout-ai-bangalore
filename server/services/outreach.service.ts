import {
  Company,
  Opportunity,
  OpenApplication,
  Contact,
  CandidateProfile,
  OutreachRecord,
  OutreachSettings,
  OutreachStatus,
  OutreachType,
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

export interface GeneratedOutreachContent {
  subject: string;
  body: string;
  matchScore: number;
  matchReason: string;
}

export class OutreachService {
  /**
   * Generates outreach draft for a specific company and context.
   * For General AI/ML Career Inquiries, this uses the EXACT approved template programmatically without AI rewriting.
   */
  public async generateDraftContent(params: {
    company: Company;
    opportunity?: Opportunity | null;
    openApplication?: OpenApplication | null;
    outreachType: OutreachType;
    recipientEmail: string;
    candidate?: CandidateProfile;
  }): Promise<GeneratedOutreachContent> {
    const { company, opportunity, openApplication, outreachType } = params;

    // For all General AI/ML Career Inquiries and Open Applications:
    // Programmatic enforcement of the approved fixed template (NO LLM REWRITING)
    const subject = APPROVED_GENERAL_INQUIRY_SUBJECT;
    const body = getApprovedGeneralInquiryBody(company.name);

    return {
      subject,
      body,
      matchScore: opportunity?.relevanceScore || 88,
      matchReason: `General AI/ML & Software Engineering Career Inquiry to ${company.name} verified public email`,
    };
  }

  private getDefaultSubject(companyName: string, roleTitle: string, candidateName: string, outreachType: OutreachType): string {
    return APPROVED_GENERAL_INQUIRY_SUBJECT;
  }

  private getDeterministicBody(
    company: Company,
    opportunity: Opportunity | null | undefined,
    openApplication: OpenApplication | null | undefined,
    outreachType: OutreachType,
    isGeneralInbox: boolean,
    candidate: CandidateProfile
  ): string {
    return getApprovedGeneralInquiryBody(company.name);
  }

  /**
   * Evaluates a company and creates the best outreach opportunity draft
   */
  public async evaluateAndCreateDraftForCompany(company: Company): Promise<OutreachRecord | null> {
    const settings = store.getOutreachSettings();

    // Check "Do Not Contact"
    if (store.isCompanyDoNotContact(company.id)) {
      return null;
    }

    // 1. Find verified public contacts
    const contacts = store.getContactsForCompany(company.id);
    const verifiedContacts = contacts.filter(
      (c) =>
        c.verificationStatus === 'VERIFIED_PUBLIC' &&
        c.exactMatch !== false &&
        c.email &&
        c.email.toLowerCase() !== 'not publicly available' &&
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(c.email.trim())
    );

    if (verifiedContacts.length === 0) {
      return null; // No verified public email -> not eligible for email outreach
    }

    // Pick best contact by role priority
    const bestContact =
      verifiedContacts.find((c) => ['HIRING', 'CAREERS', 'TALENT', 'RECRUITING'].includes(c.emailType)) ||
      verifiedContacts.find((c) => c.emailType === 'HR') ||
      verifiedContacts.find((c) => c.emailType === 'FOUNDER') ||
      verifiedContacts[0];

    const recipientEmail = bestContact.email.trim().toLowerCase();

    // 2. Find opportunities
    const opps = store.getOpportunitiesForCompany(company.id);
    const aiMlOpps = opps.filter((o) => o.category === 'AI_ML' || o.aiMlRelevance === 'CORE_AI_ML' || o.relevanceScore >= 60);
    const softwareOpps = opps.filter((o) => o.category === 'SOFTWARE' || o.category === 'BACKEND' || o.category === 'FULL_STACK' || o.category === 'DATA');

    // 3. Find open application statements
    const openApps = store.getOpenApplications({ companyId: company.id });
    const verifiedOpenApp = openApps.find((a) => a.hasVerifiedEmail || Boolean(a.contactEmail));

    let selectedOpp: Opportunity | null = null;
    let selectedOpenApp: OpenApplication | null = null;
    let outreachType: OutreachType = 'AI_ML_CAREER_INQUIRY';
    let roleTitle = 'AI/ML & Software Engineering Career Inquiry';

    if (aiMlOpps.length > 0) {
      selectedOpp = aiMlOpps[0];
      outreachType = selectedOpp.type === 'INTERNSHIP' ? 'INTERNSHIP_APPLICATION' : 'JOB_APPLICATION';
      roleTitle = selectedOpp.title;
    } else if (softwareOpps.length > 0) {
      selectedOpp = softwareOpps[0];
      outreachType = selectedOpp.type === 'INTERNSHIP' ? 'INTERNSHIP_APPLICATION' : 'JOB_APPLICATION';
      roleTitle = selectedOpp.title;
    } else if (verifiedOpenApp) {
      selectedOpenApp = verifiedOpenApp;
      outreachType = 'OPEN_APPLICATION';
      roleTitle = 'Open Application / Talent Pool';
    } else {
      // No jobs or non-matching jobs, BUT verified public email exists!
      outreachType = 'AI_ML_CAREER_INQUIRY';
      roleTitle = 'AI/ML & Software Engineering Career Inquiry';
    }

    const candidate = store.getCandidateProfile();

    const generated = await this.generateDraftContent({
      company,
      opportunity: selectedOpp,
      openApplication: selectedOpenApp,
      outreachType,
      recipientEmail,
      candidate,
    });

    const initialStatus: OutreachStatus =
      settings.automationMode === 'AUTO_SEND' && generated.matchScore >= (settings.minMatchScore || 60)
        ? 'APPROVED'
        : 'DRAFT_READY';

    const outreachRecord = store.upsertOutreachRecord({
      companyId: company.id,
      companyName: company.name,
      opportunityId: selectedOpp?.id || null,
      openApplicationId: selectedOpenApp?.id || null,
      outreachType,
      roleTitle,
      recipientEmail,
      recipientName: bestContact.name || `${company.name} Talent Team`,
      recipientRole: bestContact.role || 'Recruitment Team',
      emailType: bestContact.emailType,
      emailSourceUrl: bestContact.sourceUrl,
      emailSourceText: bestContact.sourceText || bestContact.evidenceFound,
      emailVerificationStatus: bestContact.verificationStatus,
      exactMatch: bestContact.exactMatch,
      subject: generated.subject,
      body: generated.body,
      resumeFile: candidate.resumeFileName || 'Teja_Matta_Resume.pdf',
      portfolioUrl: candidate.portfolio,
      linkedinUrl: candidate.linkedin,
      githubUrl: candidate.github,
      status: initialStatus,
      matchScore: generated.matchScore,
      matchReason: generated.matchReason,
      sourceUrl: selectedOpp?.sourceUrl || selectedOpenApp?.sourceUrl || bestContact.sourceUrl || company.officialWebsite || '',
      sourceEvidence: selectedOpp?.description || selectedOpenApp?.evidence || bestContact.evidenceFound || 'Public verified company contact',
    });

    return outreachRecord;
  }

  /**
   * Generates drafts for all eligible researched companies
   */
  public async autoDraftAllEligible(): Promise<{ totalCompanies: number; eligible: number; draftsCreated: number }> {
    const companies = store.getCompanies();
    const researched = companies.filter((c) => c.status === 'COMPLETED');

    let eligible = 0;
    let draftsCreated = 0;

    for (const company of researched) {
      const contacts = store.getContactsForCompany(company.id);
      const hasVerifiedEmail = contacts.some(
        (c) =>
          c.verificationStatus === 'VERIFIED_PUBLIC' &&
          c.exactMatch !== false &&
          c.email &&
          c.email.toLowerCase() !== 'not publicly available'
      );

      if (hasVerifiedEmail) {
        eligible++;
        const draft = await this.evaluateAndCreateDraftForCompany(company);
        if (draft) {
          draftsCreated++;
        }
      }
    }

    return {
      totalCompanies: companies.length,
      eligible,
      draftsCreated,
    };
  }

  /**
   * TEST OUTREACH: Generates drafts for 5 researched companies without sending them
   */
  public async generateTestOutreachBatch(count = 5): Promise<{ success: boolean; createdCount: number; items: OutreachRecord[] }> {
    const companies = store.getCompanies();
    const researchedWithEmails = companies.filter((c) => {
      if (c.status !== 'COMPLETED') return false;
      const contacts = store.getContactsForCompany(c.id);
      return contacts.some(
        (cnt) =>
          cnt.verificationStatus === 'VERIFIED_PUBLIC' &&
          cnt.exactMatch !== false &&
          cnt.email &&
          cnt.email.toLowerCase() !== 'not publicly available'
      );
    });

    const targetCompanies = researchedWithEmails.slice(0, count);
    const createdItems: OutreachRecord[] = [];

    for (const comp of targetCompanies) {
      const draft = await this.evaluateAndCreateDraftForCompany(comp);
      if (draft) {
        createdItems.push(draft);
      }
    }

    store.addEvent({
      companyId: 'SYSTEM',
      companyName: 'Outreach Pipeline',
      event: 'TEST_OUTREACH_GENERATED',
      message: `Generated ${createdItems.length} test outreach draft(s) across researched Bangalore startups without sending.`,
      stage: 'SEND_APPLICATION',
      type: 'success',
    });

    return {
      success: true,
      createdCount: createdItems.length,
      items: createdItems,
    };
  }

  /**
   * Sends an outreach email with all safety checks, daily limits, cooldown, and Gmail API dispatch
   */
  public async sendOutreach(
    id: string,
    overrides?: {
      subject?: string;
      body?: string;
      recipientEmail?: string;
    }
  ): Promise<{ success: boolean; message: string; record?: SentEmailRecord; outreach?: OutreachRecord; errorCode?: string }> {
    const outreach = store.getOutreachRecord(id);
    if (!outreach) {
      return { success: false, message: 'Outreach record not found.', errorCode: 'NOT_FOUND' };
    }

    const candidate = store.getCandidateProfile();
    const settings = store.getOutreachSettings();

    // 1. Safety Rule: Gmail Connection Verification
    const accountInfo = await gmailService.getAccount();
    if (!accountInfo.connected || !accountInfo.canSend) {
      const errorMsg = accountInfo.error || 'Gmail Not Connected. Please connect tejamatta05@gmail.com in Settings or Outreach Pipeline.';
      store.updateOutreachStatus(outreach.id, 'FAILED', {
        failedAt: new Date().toISOString(),
        lastError: errorMsg,
        errorCode: 'GMAIL_NOT_CONNECTED',
        errorMessage: errorMsg,
        provider: 'GMAIL',
      });
      return {
        success: false,
        message: errorMsg,
        errorCode: 'GMAIL_NOT_CONNECTED',
      };
    }

    // 2. Safety Rule: Resume Must Be Uploaded and Present on Disk
    const currentResume = resumeService.getCurrentResume();
    if (!currentResume || !candidate.resumeFileName) {
      const errorMsg = 'RESUME REQUIRED: Please upload your resume in My Profile before sending outreach.';
      store.updateOutreachStatus(outreach.id, 'FAILED', {
        failedAt: new Date().toISOString(),
        lastError: errorMsg,
        errorCode: 'RESUME_REQUIRED',
        errorMessage: errorMsg,
        provider: 'GMAIL',
      });
      return {
        success: false,
        message: errorMsg,
        errorCode: 'RESUME_REQUIRED',
      };
    }

    const fileBuffer = resumeService.getResumeFileBuffer(outreach.resumeFileId || currentResume.fileId);
    if (!fileBuffer || !fileBuffer.buffer || fileBuffer.buffer.length === 0) {
      const errorMsg = `STORAGE_FAILED: Uploaded resume file (${currentResume.originalName}) is missing from persistent storage. Please re-upload your resume.`;
      store.updateOutreachStatus(outreach.id, 'FAILED', {
        failedAt: new Date().toISOString(),
        lastError: errorMsg,
        errorCode: 'STORAGE_FAILED',
        errorMessage: errorMsg,
        provider: 'GMAIL',
      });
      return {
        success: false,
        message: errorMsg,
        errorCode: 'STORAGE_FAILED',
      };
    }

    // 3. Safety Rule: Do Not Contact
    if (store.isCompanyDoNotContact(outreach.companyId)) {
      const errorMsg = `Sending blocked: Company ${outreach.companyName} is marked as "Do Not Contact".`;
      store.updateOutreachStatus(outreach.id, 'SKIPPED', {
        notes: errorMsg,
      });
      return {
        success: false,
        message: errorMsg,
        errorCode: 'DO_NOT_CONTACT',
      };
    }

    const finalRecipient = (overrides?.recipientEmail || outreach.recipientEmail).trim().toLowerCase();

    // 4. Safety Rule: Valid Public Recipient Email
    const isValidEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(finalRecipient);
    if (!isValidEmail || finalRecipient === 'not publicly available') {
      const errorMsg = `Sending blocked: Recipient "${finalRecipient}" is not a valid verified public email.`;
      store.updateOutreachStatus(outreach.id, 'FAILED', {
        failedAt: new Date().toISOString(),
        lastError: errorMsg,
        errorCode: 'INVALID_RECIPIENT',
        errorMessage: errorMsg,
        provider: 'GMAIL',
      });
      return {
        success: false,
        message: errorMsg,
        errorCode: 'INVALID_RECIPIENT',
      };
    }

    // 5. Safety Rule: Daily Sending Limit
    const todaySent = store.getTodaySentCount();
    const dailyLimit = settings.dailySendLimit || 20;
    if (todaySent >= dailyLimit) {
      const errorMsg = `Daily send limit reached (${todaySent}/${dailyLimit} emails sent today). Please adjust daily limit in settings or resume tomorrow.`;
      return {
        success: false,
        message: errorMsg,
        errorCode: 'DAILY_LIMIT_REACHED',
      };
    }

    // 6. Safety Rule: Duplicate & Cooldown Protection
    const duplicateCheck = store.isDuplicateSend(
      outreach.companyId,
      finalRecipient,
      outreach.opportunityId,
      outreach.openApplicationId,
      settings.cooldownDays || 30
    );

    if (duplicateCheck.isDuplicate) {
      store.updateOutreachStatus(outreach.id, 'COOLDOWN', {
        notes: duplicateCheck.reason,
      });
      return {
        success: false,
        message: `Cooldown protection: ${duplicateCheck.reason}`,
        errorCode: 'COOLDOWN_ACTIVE',
      };
    }

    const finalSubject = overrides?.subject || outreach.subject;
    const finalBody = overrides?.body || outreach.body;
    const now = new Date().toISOString();

    // Compute next eligible outreach date
    const cooldownDays = settings.cooldownDays || 30;
    const nextEligibleDate = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString();
    const followUpReminderDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    logger.info(`[OutreachService] Dispatching outreach to ${finalRecipient} via Gmail API (Subject: "${finalSubject}")`);

    // Call Gmail API
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
      const failureReason = sendResult.error || 'Failed to dispatch email via Gmail API';
      logger.error(`[OutreachService] Gmail API dispatch failed for ${outreach.id}: ${failureReason}`);

      const failedRecord = store.updateOutreachStatus(outreach.id, 'FAILED', {
        failedAt: now,
        lastError: failureReason,
        errorCode: sendResult.errorCode || 'GMAIL_SEND_FAILED',
        errorMessage: failureReason,
        provider: 'GMAIL',
        senderEmail: EXPECTED_SENDER_EMAIL,
      });

      store.addEvent({
        companyId: outreach.companyId,
        companyName: outreach.companyName,
        event: 'OUTREACH_FAILED',
        message: `Failed sending outreach to ${finalRecipient}: ${failureReason}`,
        stage: 'SEND_APPLICATION',
        type: 'error',
      });

      return {
        success: false,
        message: failureReason,
        errorCode: sendResult.errorCode || 'GMAIL_SEND_FAILED',
        outreach: failedRecord || undefined,
      };
    }

    const messageId = sendResult.messageId || `gmail_${Date.now()}`;
    const threadId = sendResult.threadId || null;

    // Update Outreach Record Status to SENT
    const updated = store.updateOutreachStatus(outreach.id, 'SENT', {
      sentAt: now,
      approvedAt: outreach.approvedAt || now,
      lastContactAt: now,
      nextEligibleAt: nextEligibleDate,
      gmailMessageId: messageId,
      gmailThreadId: threadId,
      providerMessageId: messageId,
      provider: 'GMAIL',
      senderEmail: EXPECTED_SENDER_EMAIL,
      lastError: null,
      errorCode: null,
      errorMessage: null,
    });

    // Log to Sent Email Records
    const sentRecord = store.logSentEmail({
      applicationId: outreach.id,
      companyId: outreach.companyId,
      companyName: outreach.companyName,
      opportunityId: outreach.opportunityId,
      openApplicationId: outreach.openApplicationId,
      applicationType: outreach.outreachType as any,
      recipientEmail: finalRecipient,
      recipientName: outreach.recipientName || `${outreach.companyName} Hiring Team`,
      subject: finalSubject,
      body: finalBody,
      attachmentName: fileBuffer.filename || candidate.resumeFileName || 'Teja_Matta_Resume.pdf',
      sourceUrl: outreach.sourceUrl,
      sentAt: now,
      status: 'DELIVERED',
      providerMessageId: messageId,
      followUpReminderDate,
      followUpStatus: 'PENDING',
    });

    store.addEvent({
      companyId: outreach.companyId,
      companyName: outreach.companyName,
      event: 'OUTREACH_SENT',
      message: `Dispatched ${outreach.outreachType.replace(/_/g, ' ')} to ${finalRecipient} via verified Gmail (Message ID: ${messageId}).`,
      stage: 'SEND_APPLICATION',
      type: 'success',
    });

    return {
      success: true,
      message: `Outreach email dispatched successfully to ${finalRecipient} via Gmail.`,
      record: sentRecord,
      outreach: updated || undefined,
    };
  }

  /**
   * Batch sending with safety delays, limit checks, and detailed reporting
   */
  public async sendBatchOutreach(
    outreachIds: string[]
  ): Promise<{
    sent: number;
    failed: number;
    skipped: number;
    dailyLimit: number;
    dailyRemaining: number;
    results: { id: string; success: boolean; message: string; errorCode?: string; companyName?: string; recipientEmail?: string }[];
  }> {
    const settings = store.getOutreachSettings();
    const delaySeconds = Math.max(1, Math.min(settings.sendDelaySeconds || 2, 5));

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results: { id: string; success: boolean; message: string; errorCode?: string; companyName?: string; recipientEmail?: string }[] = [];

    // Pre-flight check on Gmail connection
    const account = await gmailService.getAccount();
    if (!account.connected || !account.canSend) {
      const errorMsg = account.error || 'Gmail not connected. Please connect tejamatta05@gmail.com.';
      for (const id of outreachIds) {
        const rec = store.getOutreachRecord(id);
        results.push({
          id,
          companyName: rec?.companyName,
          recipientEmail: rec?.recipientEmail,
          success: false,
          message: errorMsg,
          errorCode: 'GMAIL_NOT_CONNECTED',
        });
        failed++;
      }
      const todaySent = store.getTodaySentCount();
      return {
        sent: 0,
        failed,
        skipped: 0,
        dailyLimit: settings.dailySendLimit || 20,
        dailyRemaining: Math.max(0, (settings.dailySendLimit || 20) - todaySent),
        results,
      };
    }

    for (let i = 0; i < outreachIds.length; i++) {
      const id = outreachIds[i];
      const rec = store.getOutreachRecord(id);
      const res = await this.sendOutreach(id);

      results.push({
        id,
        companyName: rec?.companyName,
        recipientEmail: rec?.recipientEmail,
        success: res.success,
        message: res.message,
        errorCode: res.errorCode,
      });

      if (res.success) {
        sent++;
      } else {
        if (res.errorCode === 'DAILY_LIMIT_REACHED') {
          skipped++;
          // Skip remaining if daily limit reached
          for (let j = i + 1; j < outreachIds.length; j++) {
            const nextId = outreachIds[j];
            const nextRec = store.getOutreachRecord(nextId);
            results.push({
              id: nextId,
              companyName: nextRec?.companyName,
              recipientEmail: nextRec?.recipientEmail,
              success: false,
              message: 'Skipped: Daily send limit reached.',
              errorCode: 'DAILY_LIMIT_REACHED',
            });
            skipped++;
          }
          break;
        } else if (res.errorCode === 'DO_NOT_CONTACT' || res.errorCode === 'COOLDOWN_ACTIVE') {
          skipped++;
        } else {
          failed++;
        }
      }

      // Safety delay between batch sends if more items remain
      if (i < outreachIds.length - 1) {
        const jitter = Math.floor(Math.random() * 800) + 500;
        await new Promise((r) => setTimeout(r, delaySeconds * 1000 + jitter));
      }
    }

    const todaySent = store.getTodaySentCount();
    const dailyLimit = settings.dailySendLimit || 20;

    return {
      sent,
      failed,
      skipped,
      dailyLimit,
      dailyRemaining: Math.max(0, dailyLimit - todaySent),
      results,
    };
  }

  /**
   * Dispatches a real test email via Gmail API
   */
  public async sendTestEmail(recipientEmail: string): Promise<{ success: boolean; message: string; messageId?: string; from?: string; to?: string }> {
    const cleanEmail = recipientEmail.trim();
    const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail);
    if (!isValid) {
      return { success: false, message: `Invalid test recipient email address: "${cleanEmail}"` };
    }

    const result = await gmailService.sendTestEmail(cleanEmail);
    if (!result.success) {
      return {
        success: false,
        message: result.error || 'Failed to dispatch test email via Gmail API.',
      };
    }

    return {
      success: true,
      message: `Test email successfully dispatched to ${cleanEmail} from ${EXPECTED_SENDER_EMAIL}.`,
      messageId: result.messageId,
      from: EXPECTED_SENDER_EMAIL,
      to: cleanEmail,
    };
  }
}

export const outreachService = new OutreachService();
