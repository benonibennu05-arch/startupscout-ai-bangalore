import * as cheerio from 'cheerio';
import { Company, Opportunity, Contact, ResearchMode, OpenApplication } from '../types.ts';
import { store } from '../database/store.ts';
import { crawlerService } from './crawler.service.ts';
import { careersService } from './careers.service.ts';
import { geminiService } from '../ai/gemini.service.ts';
import { emailService } from './email.service.ts';
import { extractJobSnippetsFromHtml } from '../extractors/job.extractor.ts';
import { extractCompanyFromStartupMapPage } from '../extractors/company.extractor.ts';
import { extractOpenApplicationFromHtml } from '../extractors/openApplication.extractor.ts';
import { REAL_OPEN_APPLICATIONS_MAP } from '../crawler/openApplicationsMap.ts';
import { applicationEmailService } from './applicationEmail.service.ts';
import { outreachService } from './outreach.service.ts';
import { logger } from '../utils/logger.ts';
import { REAL_OPPORTUNITIES_MAP } from '../crawler/companyResearcher.ts';

export interface ResearchResult {
  company: Company;
  opportunities: Opportunity[];
  contacts: Contact[];
  openApplications: OpenApplication[];
  durationMs: number;
  geminiCalls: number;
}

export class CompanyResearchService {
  /**
   * Performs the fast Two-Stage Research Pipeline on a single startup
   * Stage 1: Fast DOM / heuristic discovery (Careers-first, max 5 pages, regex, mailto, local scoring)
   * Stage 2: Targeted AI Analysis (Only for ambiguous roles or when mode is BALANCED / DEEP)
   */
  public async researchCompany(
    company: Company,
    options: { mode?: ResearchMode; forceRefresh?: boolean } = {}
  ): Promise<ResearchResult> {
    const startTime = Date.now();
    const mode = options.mode || 'FAST';
    const settings = store.getSettings();
    const now = new Date().toISOString();
    let geminiCalls = 0;

    // Cache Check: if researched within 7 days, reuse existing unless forceRefresh is set
    if (!options.forceRefresh && company.lastResearchedAt && company.status === 'COMPLETED') {
      const daysSince = (Date.now() - new Date(company.lastResearchedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        return {
          company,
          opportunities: store.getOpportunitiesForCompany(company.id),
          contacts: store.getContactsForCompany(company.id),
          openApplications: store.getOpenApplications({ companyId: company.id }),
          durationMs: Date.now() - startTime,
          geminiCalls: 0,
        };
      }
    }

    logger.info(`[${mode} MODE] Fast parallel research for: ${company.name}`);
    store.updateCompanyStatus(company.id, 'RESEARCHING');

    const discoveredOpportunities: Opportunity[] = [];
    const discoveredContacts: Contact[] = [];

    store.addEvent({
      companyId: company.id,
      companyName: company.name,
      event: 'RESEARCH_STARTED',
      message: `Starting ${mode} research for ${company.name}...`,
      stage: 'RESEARCH_COMPANY',
      type: 'info',
    });

    // -------------------------------------------------------------
    // STAGE 1: FAST DISCOVERY & METADATA RESOLUTION
    // -------------------------------------------------------------
    let officialWebsite = company.officialWebsite;
    let websiteVerified = company.websiteVerified;
    let websiteSourceUrl = company.websiteSourceUrl;
    let careersUrl = company.careersUrl;
    let jobBoardUrl = company.jobBoardUrl;
    let atsProvider = company.atsProvider;

    if (officialWebsite && officialWebsite.startsWith('http')) {
      websiteVerified = true;
      websiteSourceUrl = officialWebsite;
    }

    // Step 1: Extract Bangalore Startup Map profile data if needed
    if (company.startupMapUrl && (!officialWebsite || !company.description || !company.foundedYear)) {
      try {
        const mapHtml = await crawlerService.fetchHtml(company.startupMapUrl, {
          timeoutMs: Math.min(10000, settings.requestTimeoutMs),
        });

        if (mapHtml) {
          const extracted = extractCompanyFromStartupMapPage(mapHtml, company.startupMapUrl);
          if (extracted.officialWebsite && !officialWebsite) {
            officialWebsite = extracted.officialWebsite;
            websiteVerified = true;
            websiteSourceUrl = company.startupMapUrl;
          }
          if (extracted.careersUrl && !careersUrl) careersUrl = extracted.careersUrl;
          if (extracted.linkedinUrl && !company.linkedinUrl) company.linkedinUrl = extracted.linkedinUrl;
          if (extracted.description && !company.description) company.description = extracted.description;
          if (extracted.startupStage && !company.startupStage) company.startupStage = extracted.startupStage;
          if (extracted.foundedYear && !company.foundedYear) company.foundedYear = extracted.foundedYear;
          if (extracted.teamSize && !company.teamSize) company.teamSize = extracted.teamSize;
          if (extracted.tags && extracted.tags.length > 0) {
            company.tags = Array.from(new Set([...(company.tags || []), ...extracted.tags]));
          }

          // Extract founders / personnel
          if (extracted.personnel && extracted.personnel.length > 0) {
            for (const p of extracted.personnel) {
              const contact = store.upsertContact({
                companyId: company.id,
                companyName: company.name,
                name: p.name,
                role: p.role,
                email: 'NOT PUBLICLY AVAILABLE',
                emailType: 'FOUNDER',
                profileUrl: p.profileUrl,
                sourceUrl: company.startupMapUrl,
                verificationStatus: 'VERIFIED_PUBLIC',
                exactMatch: true,
                evidenceFound: `Founder listed on Bangalore Startup Map profile (${company.startupMapUrl})`,
                sourceType: 'BANGALORE_STARTUP_MAP',
              });
              discoveredContacts.push(contact);
            }
          }
        }
      } catch (err: any) {
        logger.debug(`Map profile fetch skipped for ${company.name}: ${err?.message}`);
      }
    }

    // Step 2: Careers-First Discovery Strategy
    if (officialWebsite && (!careersUrl || !jobBoardUrl)) {
      try {
        const careersDiscovery = await careersService.discoverCareersChannel(
          officialWebsite,
          Math.min(10000, settings.requestTimeoutMs)
        );
        if (careersDiscovery.careersUrl && !careersUrl) careersUrl = careersDiscovery.careersUrl;
        if (careersDiscovery.jobBoardUrl && !jobBoardUrl) jobBoardUrl = careersDiscovery.jobBoardUrl;
        if (careersDiscovery.atsProvider && !atsProvider) atsProvider = careersDiscovery.atsProvider;
      } catch (err: any) {
        logger.debug(`Careers discovery error for ${company.name}: ${err?.message}`);
      }
    }

    // Step 3: Opportunity Discovery & Fast Local Heuristics
    const knownOpps = REAL_OPPORTUNITIES_MAP[company.name];

    let careerHtmlContent: string | null = null;

    if (knownOpps && knownOpps.length > 0) {
      // Known authentic opportunities map
      for (const raw of knownOpps) {
        let classified;
        if (mode === 'FAST') {
          classified = geminiService.heuristicClassify(
            raw.title,
            raw.description,
            settings.targetRoles,
            settings.targetSkills
          );
        } else {
          geminiCalls++;
          classified = await geminiService.classifyOpportunity(
            raw.title,
            raw.description,
            company.name,
            settings.targetRoles,
            settings.targetSkills
          );
        }

        const opp = store.upsertOpportunity({
          companyId: company.id,
          companyName: company.name,
          title: raw.title,
          type: raw.type || classified.type,
          employmentType: (raw.type || classified.type) === 'INTERNSHIP' ? 'Internship' : 'Full-time',
          experienceLevel: raw.experienceLevel || classified.experienceLevel,
          location: raw.location || 'Bangalore, India',
          remote: raw.remote || classified.remote,
          description: raw.description,
          responsibilities: classified.responsibilities,
          requirements: classified.requirements,
          skills: classified.skills,
          salary: raw.salary || classified.salary,
          applicationUrl: raw.applicationUrl,
          sourceUrl: raw.sourceUrl,
          sourceType: raw.sourceType,
          verificationStatus: 'VERIFIED',
          confidence: raw.sourceType === 'OFFICIAL_CAREERS' || raw.sourceType === 'ATS_BOARD' ? 'HIGH' : 'MEDIUM',
          relevanceScore: classified.relevanceScore,
          status: 'OPEN',
          discoveredAt: now,
          lastVerifiedAt: now,
        });

        discoveredOpportunities.push(opp);
      }
    } else if (careersUrl || jobBoardUrl) {
      // Live crawl from career portal (max 1-2 pages)
      const targetUrl = jobBoardUrl || careersUrl!;
      try {
        const careerHtml = await crawlerService.fetchHtml(targetUrl, {
          timeoutMs: Math.min(10000, settings.requestTimeoutMs),
        });

        if (careerHtml) {
          careerHtmlContent = careerHtml;
          const snippets = extractJobSnippetsFromHtml(careerHtml, targetUrl, company.name);

          for (const snippet of snippets.slice(0, 5)) {
            // Check if fast heuristic is clear, or if targeted AI is needed
            let classified = geminiService.heuristicClassify(
              snippet.title,
              snippet.description,
              settings.targetRoles,
              settings.targetSkills
            );

            // STAGE 2: TARGETED AI ANALYSIS ONLY IF AMBIGUOUS & NOT FAST MODE
            const isAmbiguous = classified.relevanceScore >= 35 && classified.relevanceScore <= 65;
            if ((mode === 'DEEP' || (mode === 'BALANCED' && isAmbiguous)) && geminiCalls < 2) {
              try {
                geminiCalls++;
                classified = await geminiService.classifyOpportunity(
                  snippet.title,
                  snippet.description,
                  company.name,
                  settings.targetRoles,
                  settings.targetSkills
                );
              } catch {
                // Heuristic fallback already in place
              }
            }

            const opp = store.upsertOpportunity({
              companyId: company.id,
              companyName: company.name,
              title: snippet.title,
              type: snippet.type || classified.type,
              employmentType: classified.type === 'INTERNSHIP' ? 'Internship' : 'Full-time',
              experienceLevel: classified.experienceLevel,
              location: snippet.location || 'Bangalore, India',
              remote: classified.remote,
              description: snippet.description,
              responsibilities: classified.responsibilities,
              requirements: classified.requirements,
              skills: classified.skills,
              salary: classified.salary,
              applicationUrl: snippet.applicationUrl,
              sourceUrl: snippet.sourceUrl,
              sourceType: snippet.sourceType,
              verificationStatus: 'UNVERIFIED',
              confidence: 'HIGH',
              relevanceScore: classified.relevanceScore,
              status: 'OPEN',
              discoveredAt: now,
              lastVerifiedAt: now,
            });

            discoveredOpportunities.push(opp);
          }
        }
      } catch (err: any) {
        logger.debug(`Career page fetch error for ${company.name}: ${err?.message}`);
      }
    }

    // Step 3b: Open Application / Talent Pool Detection
    const discoveredOpenApps: OpenApplication[] = [];
    const seedOpenApp = REAL_OPEN_APPLICATIONS_MAP[company.name];

    if (seedOpenApp) {
      const openApp = store.upsertOpenApplication({
        companyId: company.id,
        companyName: company.name,
        sourceUrl: seedOpenApp.sourceUrl,
        sourceText: seedOpenApp.evidence,
        evidence: seedOpenApp.evidence,
        contactEmail: seedOpenApp.contactEmail,
        contactName: seedOpenApp.contactName,
        contactRole: seedOpenApp.contactRole,
        verificationStatus: seedOpenApp.contactEmail ? 'VERIFIED_PUBLIC' : 'NOT_FOUND',
        relevanceScore: seedOpenApp.relevanceScore,
        status: 'OPEN',
        hasVerifiedEmail: Boolean(seedOpenApp.contactEmail),
        discoveredAt: now,
        updatedAt: now,
      });
      discoveredOpenApps.push(openApp);

      store.addEvent({
        companyId: company.id,
        companyName: company.name,
        event: 'OPEN_APPLICATION_FOUND',
        message: `Identified verified talent pool opportunity for ${company.name}: "${seedOpenApp.evidence.slice(0, 80)}..."`,
        stage: 'DISCOVER_JOBS',
        type: 'success',
      });
    } else if (careerHtmlContent) {
      const extractedOpen = extractOpenApplicationFromHtml(
        careerHtmlContent,
        careersUrl || officialWebsite || '',
        company.name,
        officialWebsite
      );

      if (extractedOpen) {
        const openApp = store.upsertOpenApplication({
          companyId: company.id,
          companyName: company.name,
          sourceUrl: extractedOpen.sourceUrl,
          sourceText: extractedOpen.sourceText,
          evidence: extractedOpen.evidence,
          contactEmail: extractedOpen.contactEmail,
          contactName: extractedOpen.contactName,
          contactRole: extractedOpen.contactRole,
          verificationStatus: extractedOpen.verificationStatus,
          relevanceScore: extractedOpen.relevanceScore,
          status: 'OPEN',
          hasVerifiedEmail: Boolean(extractedOpen.contactEmail),
          discoveredAt: now,
          updatedAt: now,
        });
        discoveredOpenApps.push(openApp);

        store.addEvent({
          companyId: company.id,
          companyName: company.name,
          event: 'OPEN_APPLICATION_FOUND',
          message: `Discovered open application / talent pool invitation at ${company.name}: "${extractedOpen.evidence.slice(0, 80)}..."`,
          stage: 'DISCOVER_JOBS',
          type: 'success',
        });
      }
    }

    // Step 4: Public Recruitment Emails & Contacts Extraction (Evidence-Only)
    // 4a. Extract from careers page HTML if available
    if (careersUrl && careerHtmlContent) {
      try {
        const extractedCareers = emailService.extractAndPersistEmails(
          careerHtmlContent,
          careersUrl,
          company.id,
          company.name,
          officialWebsite,
          'OFFICIAL_CAREERS_PAGE'
        );
        discoveredContacts.push(...extractedCareers);
      } catch (err: any) {
        logger.debug(`Email extraction error on careers page for ${company.name}: ${err?.message}`);
      }
    }

    // 4b. Extract from official website HTML
    if (officialWebsite) {
      try {
        const siteHtml = await crawlerService.fetchHtml(officialWebsite, {
          timeoutMs: Math.min(8000, settings.requestTimeoutMs),
        });
        if (siteHtml) {
          // If no open app found from careers, try homepage/contact page
          if (discoveredOpenApps.length === 0) {
            const extractedOpen = extractOpenApplicationFromHtml(
              siteHtml,
              officialWebsite,
              company.name,
              officialWebsite
            );
            if (extractedOpen) {
              const openApp = store.upsertOpenApplication({
                companyId: company.id,
                companyName: company.name,
                sourceUrl: extractedOpen.sourceUrl,
                sourceText: extractedOpen.sourceText,
                evidence: extractedOpen.evidence,
                contactEmail: extractedOpen.contactEmail,
                contactName: extractedOpen.contactName,
                contactRole: extractedOpen.contactRole,
                verificationStatus: extractedOpen.verificationStatus,
                relevanceScore: extractedOpen.relevanceScore,
                status: 'OPEN',
                hasVerifiedEmail: Boolean(extractedOpen.contactEmail),
                discoveredAt: now,
                updatedAt: now,
              });
              discoveredOpenApps.push(openApp);
            }
          }

          const extractedWebsite = emailService.extractAndPersistEmails(
            siteHtml,
            officialWebsite,
            company.id,
            company.name,
            officialWebsite,
            'OFFICIAL_COMPANY_PAGE'
          );
          discoveredContacts.push(...extractedWebsite);
        }
      } catch (err: any) {
        logger.debug(`Email extraction error on website for ${company.name}: ${err?.message}`);
      }
    }

    if (discoveredContacts.length > 0) {
      store.addEvent({
        companyId: company.id,
        companyName: company.name,
        event: 'EMAILS_FOUND',
        message: `Extracted ${discoveredContacts.length} verified public contact(s) with verifiable evidence.`,
        stage: 'DISCOVER_EMAILS',
        type: 'success',
      });
    } else {
      store.addEvent({
        companyId: company.id,
        companyName: company.name,
        event: 'EMAILS_NOT_FOUND',
        message: `No verified public recruitment email found on public pages for ${company.name}.`,
        stage: 'DISCOVER_EMAILS',
        type: 'info',
      });
    }

    // Step 4c: Auto-draft application & outreach emails for human review if verified contact exists
    try {
      await outreachService.evaluateAndCreateDraftForCompany(company);
      await applicationEmailService.autoDraftApplications();
    } catch (err: any) {
      logger.debug(`Auto outreach/draft generation error for ${company.name}: ${err?.message}`);
    }

    // Step 5: Persist Company Record Immediately
    const updatedCompany = store.upsertCompany({
      id: company.id,
      name: company.name,
      officialWebsite,
      websiteVerified,
      websiteSourceUrl,
      careersUrl,
      jobBoardUrl,
      atsProvider,
      description: company.description,
      sector: company.sector,
      category: company.category,
      tags: company.tags,
      startupStage: company.startupStage,
      foundedYear: company.foundedYear,
      teamSize: company.teamSize,
      linkedinUrl: company.linkedinUrl,
      status: 'COMPLETED',
      lastResearchedAt: now,
    });

    const durationMs = Date.now() - startTime;

    store.addEvent({
      companyId: company.id,
      companyName: company.name,
      event: 'COMPANY_COMPLETED',
      message: `Research completed for ${company.name} in ${(durationMs / 1000).toFixed(1)}s: ${discoveredOpportunities.length} jobs, ${discoveredOpenApps.length} open apps, ${discoveredContacts.length} contacts saved.`,
      stage: 'COMPLETE',
      type: 'success',
    });

    return {
      company: updatedCompany,
      opportunities: discoveredOpportunities,
      contacts: discoveredContacts,
      openApplications: discoveredOpenApps,
      durationMs,
      geminiCalls,
    };
  }
}

export const companyResearchService = new CompanyResearchService();
