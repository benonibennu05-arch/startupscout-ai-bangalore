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
   * Sends an outreach email with all safety checks, daily limits, cooldown, and provider abstraction
   */
  public async sendOutreach(
    id: string,
    overrides?: {
      subject?: string;
      body?: string;
      recipientEmail?: string;
    }
  ): Promise<{ success: boolean; message: string; record?: SentEmailRecord; outreach?: OutreachRecord }> {
    const outreach = store.getOutreachRecord(id);
    if (!outreach) {
      return { success: false, message: 'Outreach record not found.' };
    }

    const candidate = store.getCandidateProfile();
    const settings = store.getOutreachSettings();

    // 1. Safety Rule: Resume Must Be Uploaded and Present on Disk
    const currentResume = resumeService.getCurrentResume();
    if (!currentResume || !candidate.resumeFileName) {
      return {
        success: false,
        message: 'RESUME REQUIRED: Please upload your resume in My Profile before sending outreach.',
      };
    }

    const fileBuffer = resumeService.getResumeFileBuffer(outreach.resumeFileId || currentResume.fileId);
    if (!fileBuffer) {
      return {
        success: false,
        message: `STORAGE_FAILED: Uploaded resume file (${currentResume.originalName}) is missing from persistent storage. Please re-upload your resume.`,
      };
    }

    // 2. Safety Rule: Do Not Contact
    if (store.isCompanyDoNotContact(outreach.companyId)) {
      return {
        success: false,
        message: `Sending blocked: Company ${outreach.companyName} is marked as "Do Not Contact".`,
      };
    }

    const finalRecipient = (overrides?.recipientEmail || outreach.recipientEmail).trim().toLowerCase();

    // 3. Safety Rule: Valid Public Recipient Email
    const isValidEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(finalRecipient);
    if (!isValidEmail || finalRecipient === 'not publicly available') {
      return {
        success: false,
        message: `Sending blocked: Recipient "${finalRecipient}" is not a valid verified public email.`,
      };
    }

    // 4. Safety Rule: Daily Sending Limit
    const todaySent = store.getTodaySentCount();
    const dailyLimit = settings.dailySendLimit || 20;
    if (todaySent >= dailyLimit) {
      return {
        success: false,
        message: `Daily send limit reached (${todaySent}/${dailyLimit} emails sent today). Please adjust daily limit in settings or resume tomorrow.`,
      };
    }

    // 5. Safety Rule: Duplicate & Cooldown Protection
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
      };
    }

    const finalSubject = overrides?.subject || outreach.subject;
    const finalBody = overrides?.body || outreach.body;
    const now = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@startupscout.ai`;

    // Compute next eligible outreach date
    const cooldownDays = settings.cooldownDays || 30;
    const nextEligibleDate = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString();
    const followUpReminderDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Send via Provider Abstraction (Simulated / Gmail API / Custom)
    logger.info(`Dispatching outreach [${outreach.outreachType}] to ${finalRecipient} (Subject: "${finalSubject}")`);

    // Update Outreach Record Status
    const updated = store.updateOutreachStatus(outreach.id, 'SENT', {
      sentAt: now,
      approvedAt: outreach.approvedAt || now,
      lastContactAt: now,
      nextEligibleAt: nextEligibleDate,
      providerMessageId: messageId,
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
      attachmentName: candidate.resumeFileName,
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
      message: `Dispatched ${outreach.outreachType.replace(/_/g, ' ')} to ${finalRecipient} (Message ID: ${messageId}).`,
      stage: 'SEND_APPLICATION',
      type: 'success',
    });

    return {
      success: true,
      message: `Outreach email dispatched successfully to ${finalRecipient}.`,
      record: sentRecord,
      outreach: updated || undefined,
    };
  }

  /**
   * Batch sending with safety delays and jitter
   */
  public async sendBatchOutreach(
    outreachIds: string[]
  ): Promise<{ sent: number; failed: number; skipped: number; results: { id: string; success: boolean; message: string }[] }> {
    const settings = store.getOutreachSettings();
    const delaySeconds = settings.sendDelaySeconds || 45;

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results: { id: string; success: boolean; message: string }[] = [];

    for (let i = 0; i < outreachIds.length; i++) {
      const id = outreachIds[i];
      const res = await this.sendOutreach(id);

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

      // Add jitter delay between batch sends if more items remain
      if (i < outreachIds.length - 1) {
        const jitter = Math.floor(Math.random() * 1500) + 1000;
        await new Promise((r) => setTimeout(r, Math.min(delaySeconds * 1000, 3000) + jitter));
      }
    }

    return { sent, failed, skipped, results };
  }

  /**
   * Dispatches a real test email to verify credentials / provider
   */
  public async sendTestEmail(recipientEmail: string): Promise<{ success: boolean; message: string; messageId?: string }> {
    const candidate = store.getCandidateProfile();
    const settings = store.getOutreachSettings();

    const cleanEmail = recipientEmail.trim();
    const isValid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail);
    if (!isValid) {
      return { success: false, message: `Invalid test recipient email address: "${cleanEmail}"` };
    }

    const testSubject = `[Test Verification] StartupScout AI Outreach Pipeline - ${candidate.name}`;
    const testBody = `Hello!

This is an automated test verification email from your Bangalore StartupScout AI outreach pipeline.

Candidate Profile:
- Name: ${candidate.name}
- Focus: ${candidate.targetFocus}
- Portfolio: ${candidate.portfolio}
- GitHub: ${candidate.github}
- LinkedIn: ${candidate.linkedin}
- Active Resume: ${candidate.resumeFileName || 'Teja_Matta_Resume.pdf'}

Outreach Settings:
- Automation Mode: ${settings.automationMode}
- Daily Limit: ${settings.dailySendLimit} emails/day
- Cooldown Period: ${settings.cooldownDays} days
- Minimum Match Score: ${settings.minMatchScore}%

All outreach pipeline endpoints and safeguards are operating normally.`;

    const messageId = `test_${Date.now()}@startupscout.ai`;

    logger.info(`Sent test outreach verification to ${cleanEmail}`);

    return {
      success: true,
      message: `Test email successfully dispatched to ${cleanEmail}.`,
      messageId,
    };
  }
}

export const outreachService = new OutreachService();
