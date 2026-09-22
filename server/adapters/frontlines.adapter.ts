import crypto from 'crypto';
import {
  SourceAdapter,
  DiscoveredCompanyInput,
  DiscoveredJobInput,
  CareerSourceLink,
  SourceChangeDetectionResult,
} from './sourceAdapter.interface.ts';
import {
  StartupMapSource,
  SourceSyncResult,
  SourceMonitoringStatus,
  Company,
  Opportunity,
} from '../types.ts';
import { store, normalizeCompanyName, extractOfficialDomain } from '../database/store.ts';
import { careerPageService } from './career/careerPage.service.ts';
import { logger } from '../utils/logger.ts';

const BASE_URL = 'https://frontlinesmedia.in/302-company-career-pages/';

export interface FrontlinesCompanyEntry {
  index: number;
  name: string;
  careerUrl: string;
}

export class FrontlinesCareerPagesAdapter implements SourceAdapter {
  public readonly id = 'frontlines';
  public readonly name = 'Frontlines Media';
  public readonly sourceMap: StartupMapSource = 'FRONTLINES_CAREER_DIRECTORY';
  public readonly baseUrl = BASE_URL;

  private isRunning = false;
  private cachedDirectory: FrontlinesCompanyEntry[] = [];
  private status: SourceMonitoringStatus = {
    sourceMap: 'FRONTLINES_CAREER_DIRECTORY',
    sourceUrl: BASE_URL,
    status: 'HEALTHY',
    lastSyncAt: null,
    lastSuccessfulSyncAt: null,
    etag: null,
    contentHash: null,
    totalDiscovered: 0,
    newInLastSync: 0,
    changedInLastSync: 0,
    unchangedInLastSync: 0,
    lastHttpStatus: 200,
    lastError: null,
    consecutiveErrors: 0,
    avgResponseTimeMs: 0,
  };

  public getStatus(): SourceMonitoringStatus {
    return { ...this.status };
  }

  /**
   * Scrapes and parses all 302 companies from the live Frontlines Media directory article.
   */
  public async scrapeDirectory(): Promise<FrontlinesCompanyEntry[]> {
    try {
      logger.info(`[FrontlinesAdapter] Fetching live directory from ${this.baseUrl}`);
      const res = await fetch(this.baseUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`Frontlines directory returned HTTP ${res.status}: ${res.statusText}`);
      }

      const html = await res.text();
      const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      const companies: FrontlinesCompanyEntry[] = [];

      for (const tr of trMatches) {
        const tds = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        if (tds.length >= 3) {
          const rawIndex = tds[0][1].replace(/<[^>]+>/g, '').trim();
          const rawName = tds[1][1].replace(/<[^>]+>/g, '').trim();
          const aMatch = tds[2][1].match(/href="([^"]+)"/i);
          let careerUrl = aMatch ? aMatch[1].trim() : tds[2][1].replace(/<[^>]+>/g, '').trim();
          careerUrl = careerUrl.replace(/&amp;/g, '&').replace(/\s+/g, '%20');

          const num = parseInt(rawIndex, 10);
          if (!isNaN(num) && rawName && careerUrl.startsWith('http')) {
            companies.push({ index: num, name: rawName, careerUrl });
          }
        }
      }

      logger.info(`[FrontlinesAdapter] Successfully extracted ${companies.length} companies from directory`);
      this.cachedDirectory = companies;
      return companies;
    } catch (err: any) {
      logger.error(`[FrontlinesAdapter] Error scraping directory: ${err.message}`);
      if (this.cachedDirectory.length > 0) {
        return this.cachedDirectory;
      }
      throw err;
    }
  }

  public async discoverCompanies(): Promise<DiscoveredCompanyInput[]> {
    const entries = await this.scrapeDirectory();
    return entries.map((entry) => {
      const slug = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const domain = extractOfficialDomain(entry.careerUrl);
      return {
        name: entry.name,
        officialDomain: domain,
        officialWebsite: domain ? `https://${domain}` : entry.careerUrl,
        startupMapUrl: this.baseUrl,
        sourceCompanyUrl: entry.careerUrl,
        sourceSlug: slug,
        sourceMap: 'FRONTLINES_CAREER_DIRECTORY',
        location: 'Multi-city / National',
        careersUrl: entry.careerUrl,
        jobBoardUrl: entry.careerUrl,
        description: `Discovered via Frontlines Media 302 Directory (#${entry.index})`,
        tags: ['Frontlines-302', 'Career-Directory'],
        contentHash: crypto.createHash('sha256').update(`${entry.name}|${entry.careerUrl}`).digest('hex'),
      };
    });
  }

  public async discoverCompany(slugOrId: string): Promise<DiscoveredCompanyInput | null> {
    const companies = await this.discoverCompanies();
    return companies.find((c) => c.sourceSlug === slugOrId || c.name.toLowerCase() === slugOrId.toLowerCase()) || null;
  }

  public async discoverCareerSources(company: Company): Promise<CareerSourceLink[]> {
    if (company.careersUrl) {
      return [{ type: 'OFFICIAL_CAREERS', url: company.careersUrl, companyId: company.id }];
    }
    return [];
  }

  public async discoverJobs(company: Company): Promise<DiscoveredJobInput[]> {
    const careerUrl = company.careersUrl || company.jobBoardUrl;
    if (!careerUrl) return [];

    const pageResult = await careerPageService.extractCareerPage(company.name, careerUrl);
    return pageResult.jobs
      .filter((j) => !j.classification.isInternship)
      .map((j) => ({
        title: j.title,
        companyId: company.id,
        companyName: company.name,
        location: j.location.formatted,
        city: j.location.city,
        country: j.location.country,
        department: j.department,
        workMode: j.location.workMode === 'HYBRID' ? 'HYBRID' : j.location.isRemote ? 'REMOTE' : 'ON_SITE',
        type: j.classification.type,
        isInternship: false,
        applyUrl: j.applicationUrl,
        sourceUrl: j.sourceJobUrl,
        sourceMap: 'OFFICIAL_COMPANY_CAREER_PAGE',
        description: j.description,
        skills: j.classification.skills,
        externalRef: j.sourceJobId,
      }));
  }

  public async discoverInternships(company: Company): Promise<DiscoveredJobInput[]> {
    const careerUrl = company.careersUrl || company.jobBoardUrl;
    if (!careerUrl) return [];

    const pageResult = await careerPageService.extractCareerPage(company.name, careerUrl);
    return pageResult.jobs
      .filter((j) => j.classification.isInternship)
      .map((j) => ({
        title: j.title,
        companyId: company.id,
        companyName: company.name,
        location: j.location.formatted,
        city: j.location.city,
        country: j.location.country,
        department: j.department,
        workMode: j.location.workMode === 'HYBRID' ? 'HYBRID' : j.location.isRemote ? 'REMOTE' : 'ON_SITE',
        type: 'INTERNSHIP',
        isInternship: true,
        applyUrl: j.applicationUrl,
        sourceUrl: j.sourceJobUrl,
        sourceMap: 'OFFICIAL_COMPANY_CAREER_PAGE',
        description: j.description,
        skills: j.classification.skills,
        externalRef: j.sourceJobId,
      }));
  }

  public detectChanges(
    previousSnapshot: Map<string, string>,
    currentItems: DiscoveredCompanyInput[]
  ): SourceChangeDetectionResult {
    const currentSlugs = new Set<string>();
    const newIds: string[] = [];
    const changedIds: string[] = [];
    const closedIds: string[] = [];
    let unchangedCount = 0;

    for (const item of currentItems) {
      const slug = item.sourceSlug || item.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      currentSlugs.add(slug);
      const prevHash = previousSnapshot.get(slug);

      if (!prevHash) {
        newIds.push(slug);
      } else if (prevHash !== item.contentHash) {
        changedIds.push(slug);
      } else {
        unchangedCount++;
      }
    }

    for (const [prevSlug] of previousSnapshot.entries()) {
      if (!currentSlugs.has(prevSlug)) {
        closedIds.push(prevSlug);
      }
    }

    return {
      newCount: newIds.length,
      changedCount: changedIds.length,
      unchangedCount,
      closedCount: closedIds.length,
      newIds,
      changedIds,
      closedIds,
    };
  }

  public async sync(options: { forceFull?: boolean; queueResearch?: boolean; maxCompanies?: number } = {}): Promise<SourceSyncResult> {
    const startTime = Date.now();
    const now = new Date().toISOString();

    if (this.isRunning) {
      return {
        source: 'FRONTLINES_CAREER_DIRECTORY',
        sourceUrl: this.baseUrl,
        status: 'PARTIAL',
        totalDiscovered: this.status.totalDiscovered,
        newCompaniesCount: 0,
        changedCompaniesCount: 0,
        unchangedCompaniesCount: this.status.totalDiscovered,
        staleQueuedCount: 0,
        newCompanyIds: [],
        changedCompanyIds: [],
        queuedForResearchCount: 0,
        durationMs: 0,
        error: 'Sync already in progress',
        timestamp: now,
      };
    }

    this.isRunning = true;
    this.status.status = 'SYNCING';

    try {
      const items = await this.discoverCompanies();
      const newCompanyIds: string[] = [];
      const changedCompanyIds: string[] = [];
      let unchangedCount = 0;

      const seededCompanies: { company: Company; careerUrl: string }[] = [];

      for (const item of items) {
        const norm = normalizeCompanyName(item.name);
        const existing = store.getCompanies().find((c) => normalizeCompanyName(c.name) === norm);

        const comp = store.upsertCompany({
          name: item.name,
          sourceMap: 'FRONTLINES_CAREER_DIRECTORY',
          discoveredViaSource: 'FRONTLINES_CAREER_DIRECTORY',
          careersPageFound: true,
          careersUrl: item.careersUrl,
          startupMapUrl: item.startupMapUrl,
          sourceCompanyUrl: item.sourceCompanyUrl,
          location: existing?.location || item.location,
          locations: existing?.locations || [item.location],
          description: item.description,
          tags: item.tags,
        });

        if (!existing) {
          newCompanyIds.push(comp.id);
        } else {
          unchangedCount++;
        }

        if (item.careersUrl) {
          seededCompanies.push({ company: comp, careerUrl: item.careersUrl });
        }
      }

      // Process official career pages with bounded concurrency (5 parallel workers)
      const toProcess = seededCompanies.slice(0, options.maxCompanies || (options.forceFull ? seededCompanies.length : 25));
      const concurrency = 5;
      let index = 0;

      const worker = async () => {
        while (index < toProcess.length) {
          const current = toProcess[index++];
          if (!current) break;

          try {
            const pageResult = await careerPageService.extractCareerPage(current.company.name, current.careerUrl);
            if (!pageResult.success && pageResult.error) {
              store.addEvent({
                companyId: current.company.id,
                companyName: current.company.name,
                event: 'CAREER_PAGE_ERROR',
                message: `Failed to parse official career page: ${pageResult.error}`,
                type: 'warning',
              });
              continue;
            }

            for (const job of pageResult.jobs) {
              const isIntern = job.classification.isInternship;
              const stableId = 'frontlines_' + crypto.createHash('sha256').update(`${current.company.id}_${job.sourceJobId || job.applicationUrl || job.title}`).digest('hex').slice(0, 16);

              store.upsertOpportunity({
                id: stableId,
                companyId: current.company.id,
                companyName: current.company.name,
                title: job.title,
                category: job.classification.category,
                type: isIntern ? 'INTERNSHIP' : 'FULL_TIME',
                employmentType: isIntern ? 'INTERN' : 'FULL_TIME',
                experienceLevel: job.classification.experienceLevel,
                location: job.location.formatted,
                country: job.location.country,
                stateProvince: job.location.stateProvince,
                city: job.location.city,
                metro: job.location.metro,
                locationRaw: job.location.locationRaw,
                workMode: job.location.workMode,
                isRemote: job.location.isRemote,
                isInternship: isIntern,
                isFresherFriendly: job.classification.isFresherFriendly,
                isGraduateRole: job.classification.isGraduateRole,
                isApprenticeship: job.classification.isApprenticeship,
                remote: job.location.isRemote ? 'REMOTE' : job.location.workMode === 'HYBRID' ? 'HYBRID' : 'ON_SITE',
                description: job.description,
                responsibilities: [],
                requirements: [],
                skills: job.classification.skills,
                salary: null,
                applicationUrl: job.applicationUrl,
                sourceUrl: current.careerUrl,
                sourceJobUrl: job.sourceJobUrl,
                sourceJobId: job.sourceJobId,
                sourceType: 'OFFICIAL_CAREERS',
                sourceMap: 'OFFICIAL_COMPANY_CAREER_PAGE',
                source: 'OFFICIAL_COMPANY_CAREER_PAGE',
                discoveredViaSource: 'FRONTLINES_CAREER_DIRECTORY',
                authoritativeSource: 'OFFICIAL_COMPANY_CAREER_PAGE',
                verificationStatus: 'VERIFIED',
                confidence: 'HIGH',
                aiMlRelevance: job.classification.aiMlRelevance,
                relevanceScore: job.classification.relevanceScore,
                contentHash: job.contentHash,
                status: 'OPEN',
                lastSeenAt: now,
                lastVerifiedAt: now,
              });
            }

            store.upsertCompany({
              ...current.company,
              status: 'COMPLETED',
              lastResearchedAt: now,
              atsProvider: pageResult.platform,
            });
          } catch (err: any) {
            logger.warn(`[FrontlinesAdapter] Error extracting ${current.company.name}: ${err.message}`);
          }
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, toProcess.length) }, () => worker());
      await Promise.all(workers);

      this.status.status = 'HEALTHY';
      this.status.lastSyncAt = now;
      this.status.lastSuccessfulSyncAt = now;
      this.status.totalDiscovered = items.length;
      this.status.newInLastSync = newCompanyIds.length;
      this.status.changedInLastSync = changedCompanyIds.length;
      this.status.unchangedInLastSync = unchangedCount;
      this.status.consecutiveErrors = 0;

      return {
        source: 'FRONTLINES_CAREER_DIRECTORY',
        sourceUrl: this.baseUrl,
        status: 'SUCCESS',
        totalDiscovered: items.length,
        newCompaniesCount: newCompanyIds.length,
        changedCompaniesCount: changedCompanyIds.length,
        unchangedCompaniesCount: unchangedCount,
        staleQueuedCount: 0,
        newCompanyIds,
        changedCompanyIds,
        queuedForResearchCount: 0,
        durationMs: Date.now() - startTime,
        timestamp: now,
      };
    } catch (err: any) {
      logger.error(`[FrontlinesAdapter] Sync failed: ${err.message}`);
      this.status.status = 'ERROR';
      this.status.lastError = err.message;
      this.status.consecutiveErrors++;

      return {
        source: 'FRONTLINES_CAREER_DIRECTORY',
        sourceUrl: this.baseUrl,
        status: 'FAILED',
        totalDiscovered: this.status.totalDiscovered,
        newCompaniesCount: 0,
        changedCompaniesCount: 0,
        unchangedCompaniesCount: 0,
        staleQueuedCount: 0,
        newCompanyIds: [],
        changedCompanyIds: [],
        queuedForResearchCount: 0,
        durationMs: Date.now() - startTime,
        error: err.message,
        timestamp: now,
      };
    } finally {
      this.isRunning = false;
    }
  }
}

export const frontlinesCareerPagesAdapter = new FrontlinesCareerPagesAdapter();
