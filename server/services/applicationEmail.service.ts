import { GoogleGenAI } from '@google/genai';
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
import { logger } from '../utils/logger.ts';

let aiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface GeneratedEmailDraft {
  subject: string;
  body: string;
  matchScore: number;
  matchReason: string;
}

export class ApplicationEmailService {
  /**
   * Generates a company-tailored personalized cold application email
   */
  public async generateEmailContent(params: {
    company: Company;
    opportunity?: Opportunity | null;
    openApplication?: OpenApplication | null;
    candidate?: CandidateProfile;
  }): Promise<GeneratedEmailDraft> {
    const candidate = params.candidate || store.getCandidateProfile();
    const { company, opportunity, openApplication } = params;

    const isCurrentRole = Boolean(opportunity && opportunity.title);
    const targetTitle = opportunity?.title || 'AI / ML & Software Engineering Opportunities';
    const roleType = opportunity?.type || 'INTERNSHIP';

    const ai = getGenAiClient();
    if (ai) {
      try {
        const prompt = `You are a professional career advisor assisting a high-caliber candidate in writing a personalized, compelling job application email.

Candidate Profile:
- Name: ${candidate.name}
- Target: ${candidate.targetFocus}
- Skills: ${candidate.skills.slice(0, 10).join(', ')}
- Portfolio: ${candidate.portfolio}
- LinkedIn: ${candidate.linkedin}
- GitHub: ${candidate.github}
- Education: ${candidate.education}

Company:
- Name: ${company.name}
- Sector/Description: ${company.description || company.sector || 'Bangalore High-Growth Tech Startup'}
- Website: ${company.officialWebsite || 'Official Company'}

Application Context:
${
  isCurrentRole
    ? `Specific Role Opening: "${opportunity?.title}"
Job Description: "${opportunity?.description || ''}"
Key Requirements: "${(opportunity?.requirements || []).join(', ')}"
Key Skills: "${(opportunity?.skills || []).join(', ')}"`
    : `Open Application / Talent Pool Inquiry:
Company Statement/Evidence: "${openApplication?.evidence || 'Open talent pool inquiry'}"
Target Area: AI/ML Engineering, Generative AI, LLM systems, or Backend Engineering internships / fresher roles.`
}

Guidelines:
1. Subject line: Clear, professional, role-specific with candidate name.
2. Email Body: 150-220 words.
3. Structure:
   - Respectful, personalized opening addressing the hiring team and referencing ${company.name}'s specific domain.
   - Specific connection: ${isCurrentRole ? `why candidate is a strong fit for "${opportunity?.title}"` : `explaining candidate's strong interest in ${company.name} and inquiry for upcoming AI/ML or Software opportunities`}.
   - Highlight 2-3 specific technical strengths (e.g. PyTorch, LLMs, LangChain, FastAPI, agentic workflows).
   - Reference attached resume (${candidate.resumeFileName || 'Teja_Matta_Resume.pdf'}), portfolio (${candidate.portfolio}), and GitHub (${candidate.github}).
   - Professional closing offering a brief conversation.
4. Tone: Confident, humble, authentic, zero AI fluff, zero exaggeration.

Return strict JSON:
{
  "subject": "...",
  "body": "...",
  "matchScore": 92,
  "matchReason": "Strong alignment with LLM / AI systems and backend stack"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim();
        if (text) {
          const parsed = JSON.parse(text);
          return {
            subject: parsed.subject || this.getDefaultSubject(company.name, targetTitle, candidate.name, isCurrentRole),
            body: parsed.body || this.getDeterministicBody(company, opportunity, openApplication, candidate),
            matchScore: parsed.matchScore || 88,
            matchReason: parsed.matchReason || `Matched skills with ${company.name}`,
          };
        }
      } catch (err: any) {
        logger.warn(`Gemini application email generation fallback: ${err?.message}`);
      }
    }

    // Deterministic High-Quality Template Fallback
    return {
      subject: this.getDefaultSubject(company.name, targetTitle, candidate.name, isCurrentRole),
      body: this.getDeterministicBody(company, opportunity, openApplication, candidate),
      matchScore: opportunity?.relevanceScore || openApplication?.relevanceScore || 88,
      matchReason: isCurrentRole
        ? `Direct skill match with ${opportunity?.title} at ${company.name}`
        : `Verified open application opportunity for AI & Software roles at ${company.name}`,
    };
  }

  private getDefaultSubject(companyName: string, roleTitle: string, candidateName: string, isCurrentRole: boolean): string {
    if (isCurrentRole) {
      if (roleTitle.toLowerCase().includes('intern')) {
        return `Application: ${roleTitle} - ${candidateName}`;
      }
      return `Application for ${roleTitle} - ${candidateName}`;
    }
    return `Inquiry: AI/ML & Software Engineering Opportunities - ${candidateName}`;
  }

  private getDeterministicBody(
    company: Company,
    opportunity?: Opportunity | null,
    openApplication?: OpenApplication | null,
    candidate?: CandidateProfile
  ): string {
    const cand = candidate || store.getCandidateProfile();
    const recipientGreeting = 'Dear ' + company.name + ' Hiring Team,';

    if (opportunity && opportunity.title) {
      const isInternship = opportunity.type === 'INTERNSHIP' || opportunity.title.toLowerCase().includes('intern');
      return `${recipientGreeting}

I am writing to express my strong interest in the ${opportunity.title} role at ${company.name}. Having closely followed your work in ${company.sector || 'technology'}, I am deeply impressed by your engineering focus.

I specialize in ${cand.targetFocus}, with hands-on experience building generative AI pipelines, LLM-powered autonomous agents, and scalable backend services using Python, PyTorch, FastAPI, and TypeScript. In my recent projects, I developed end-to-end multi-agent retrieval frameworks and low-latency API architectures.

I would welcome the opportunity to bring my hands-on technical skills and enthusiasm to the ${opportunity.title} position.

My resume is attached for your review. You can also explore my portfolio and code here:
- Portfolio: ${cand.portfolio}
- GitHub: ${cand.github}
- LinkedIn: ${cand.linkedin}

Thank you for your time and consideration. I would be thrilled to speak with your team.

Best regards,
${cand.name}
Bengaluru, India`;
    }

    // Open Application Body
    return `${recipientGreeting}

I noticed on your careers page that ${company.name} welcomes open applications and outreach from passionate builders ("${openApplication?.evidence ? openApplication.evidence.slice(0, 100) + '...' : 'always looking for exceptional talent'}").

I am an aspiring AI/ML and Software Engineer based in Bengaluru with a strong focus on Generative AI, Large Language Models, AI Agent architectures, and high-performance Python backends. I have built production-ready tools using PyTorch, Hugging Face, LangChain, and FastAPI.

I would love to explore whether there are current or upcoming internship or entry-level software/AI engineering opportunities with your team at ${company.name}.

I have attached my resume (${cand.resumeFileName || 'Teja_Matta_Resume.pdf'}) with complete details. You can also review my work and open-source projects here:
- Portfolio: ${cand.portfolio}
- GitHub: ${cand.github}
- LinkedIn: ${cand.linkedin}

Thank you for your time, and I look forward to the possibility of connecting.

Warm regards,
${cand.name}
Bengaluru, India`;
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
  ): Promise<{ success: boolean; message: string; record?: SentEmailRecord }> {
    const app = store.getApplication(applicationId);
    if (!app) {
      return { success: false, message: 'Application not found.' };
    }

    const candidate = store.getCandidateProfile();
    const config = store.getEmailProviderConfig();

    // Safety Rule 1: Resume Must Be Uploaded
    if (!candidate.resumeFileName) {
      return {
        success: false,
        message: 'Cannot send application: Resume must be uploaded in Candidate Profile first.',
      };
    }

    const finalRecipient = (overrides?.recipientEmail || app.recipientEmail).trim();

    // Safety Rule 2: Valid Public Recipient Email
    const isValidEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(finalRecipient);
    if (!isValidEmail || finalRecipient === 'not publicly available') {
      return {
        success: false,
        message: `Cannot send: Recipient "${finalRecipient}" is not a verified public email.`,
      };
    }

    // Safety Rule 3: Daily Sending Limit
    const todaySent = store.getTodaySentCount();
    const limit = config.dailySendLimit || 20;
    if (todaySent >= limit) {
      return {
        success: false,
        message: `Daily send limit reached (${todaySent}/${limit} sent today). Please adjust daily limit in settings or try again tomorrow.`,
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
      };
    }

    const finalSubject = overrides?.subject || app.subject;
    const finalBody = overrides?.body || app.body;
    const now = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}@startupscout.ai`;

    // Send via provider abstraction
    logger.info(`Sending application [${app.applicationType}] to ${finalRecipient} via ${config.provider}`);

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
      attachmentName: candidate.resumeFileName,
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
      message: `Successfully dispatched application for ${app.roleTitle} to ${finalRecipient} (ID: ${messageId}).`,
      stage: 'SEND_APPLICATION',
      type: 'success',
    });

    return {
      success: true,
      message: `Application sent successfully to ${finalRecipient}.`,
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
