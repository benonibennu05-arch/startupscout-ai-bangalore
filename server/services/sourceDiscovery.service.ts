import crypto from 'crypto';
import * as cheerio from 'cheerio';
import {
  Company,
  CompanySource,
  StartupMapSource,
  SourceSyncResult,
  SourceMonitoringStatus,
  ScraperHealthMetrics,
  LocationScope,
  DualSourceStats,
  SourceMapStats,
} from '../types.ts';
import { store, normalizeCompanyName, extractOfficialDomain } from '../database/store.ts';
import { researchQueue } from '../queue/researchQueue.ts';
import { crawlerService } from './crawler.service.ts';
import { logger } from '../utils/logger.ts';
import { BANGALORE_STARTUP_MAP_DIRECTORY } from '../crawler/startupMapCrawler.ts';
import { HYDERABAD_STARTUP_MAP_DIRECTORY } from '../crawler/hyderabadStartupMapCrawler.ts';
import { whereWeWorkAdapter } from '../adapters/whereWeWork.adapter.ts';

const BANGALORE_MAP_URL = 'https://www.bangalorestartupmap.com/';
const HYDERABAD_MAP_URL = 'https://hyderabadstartupsmap.lol/';
const HYDERABAD_API_URL = 'https://hyderabadstartupsmap.lol/api/startups';
const WHEREWEWORK_URL = 'https://wherewework.co.in/';

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input || '').digest('hex');
}

export function hashCompanyMetadata(data: {
  name: string;
  website?: string | null;
  description?: string | null;
  sector?: string | null;
  stage?: string | null;
  tags?: string[];
}): string {
  const normalized = [
    (data.name || '').trim().toLowerCase(),
    extractOfficialDomain(data.website) || '',
    (data.description || '').trim().slice(0, 150).toLowerCase(),
    (data.sector || '').trim().toLowerCase(),
    (data.stage || '').trim().toLowerCase(),
    (data.tags || []).slice().sort().join(',').toLowerCase(),
  ].join('|');
  return hashString(normalized);
}

export class SourceDiscoveryEngine {
  private bangaloreStatus: SourceMonitoringStatus = {
    sourceMap: 'BANGALORE_STARTUP_MAP',
    sourceUrl: BANGALORE_MAP_URL,
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
    avgResponseTimeMs: 450,
  };

  private hyderabadStatus: SourceMonitoringStatus = {
    sourceMap: 'HYDERABAD_STARTUP_MAP',
    sourceUrl: HYDERABAD_MAP_URL,
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
    avgResponseTimeMs: 380,
  };

  private whereWeWorkStatus: SourceMonitoringStatus = {
    sourceMap: 'WHEREWEWORK',
    sourceUrl: WHEREWEWORK_URL,
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
    avgResponseTimeMs: 420,
  };

  private scraperMetrics: ScraperHealthMetrics = {
    pagesCrawled: 0,
    pagesSucceeded: 0,
    pagesFailed: 0,
    statusCodes: { '200': 0, '301': 0, '304': 0, '404': 0, '429': 0, '500': 0 },
    timeouts: 0,
    rateLimits: 0,
    retries: 0,
    avgLatencyMs: 400,
    lastCrawlAt: null,
  };

  private isSyncingBangalore = false;
  private isSyncingHyderabad = false;

  private recordMetric(status: number, durationMs: number, success = true) {
    this.scraperMetrics.pagesCrawled += 1;
    if (success) {
      this.scraperMetrics.pagesSucceeded += 1;
    } else {
      this.scraperMetrics.pagesFailed += 1;
    }
    const codeKey = String(status);
    this.scraperMetrics.statusCodes[codeKey] = (this.scraperMetrics.statusCodes[codeKey] || 0) + 1;
    if (status === 429) this.scraperMetrics.rateLimits += 1;
    if (status >= 500) this.scraperMetrics.retries += 1;
    this.scraperMetrics.avgLatencyMs = Math.round(
      (this.scraperMetrics.avgLatencyMs * 9 + durationMs) / 10
    );
    this.scraperMetrics.lastCrawlAt = new Date().toISOString();
  }

  /**
   * Sync Bangalore Startup Map incrementally
   */
  public async syncBangalore(options: { queueResearch?: boolean; forceFull?: boolean } = {}): Promise<SourceSyncResult> {
    if (this.isSyncingBangalore) {
      return {
        source: 'BANGALORE_STARTUP_MAP',
        sourceUrl: BANGALORE_MAP_URL,
        status: 'UNCHANGED',
        totalDiscovered: this.bangaloreStatus.totalDiscovered,
        newCompaniesCount: 0,
        changedCompaniesCount: 0,
        unchangedCompaniesCount: this.bangaloreStatus.totalDiscovered,
        staleQueuedCount: 0,
        newCompanyIds: [],
        changedCompanyIds: [],
        queuedForResearchCount: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    this.isSyncingBangalore = true;
    const startTime = Date.now();
    const now = new Date().toISOString();
    this.bangaloreStatus.status = 'SYNCING';
    this.bangaloreStatus.lastSyncAt = now;

    const newCompanyIds: string[] = [];
    const changedCompanyIds: string[] = [];
    let unchangedCount = 0;

    try {
      logger.info(`[SourceDiscovery] Syncing Bangalore Startup Map from ${BANGALORE_MAP_URL}...`);
      const fetchStart = Date.now();
      const response = await fetch(BANGALORE_MAP_URL, {
        headers: {
          'User-Agent': 'StartupScoutAI/2.0 (Bangalore Startup Map Monitor)',
          'Accept': 'text/html,application/xhtml+xml',
          ...(this.bangaloreStatus.etag ? { 'If-None-Match': this.bangaloreStatus.etag } : {}),
        },
      });

      const fetchDuration = Date.now() - fetchStart;
      this.recordMetric(response.status, fetchDuration, response.ok);
      this.bangaloreStatus.lastHttpStatus = response.status;
      this.bangaloreStatus.avgResponseTimeMs = fetchDuration;

      const etag = response.headers.get('etag') || undefined;
      const lastModified = response.headers.get('last-modified') || undefined;
      if (etag) this.bangaloreStatus.etag = etag;

      const html = await response.text();
      const pageHash = hashString(html);
      this.bangaloreStatus.contentHash = pageHash;

      // Extract startups from Bangalore Startup Map Next.js RSC payload
      const discoveredItems: Array<{
        name: string;
        slug: string;
        website?: string;
        description?: string;
        tagline?: string;
        sector?: string;
        stage?: string;
        tags?: string[];
        location?: string;
        foundedYear?: number;
      }> = [];

      // 1. Next.js RSC Payload Regex (supports both escaped and unescaped payload encodings)
      const regexEscaped = /\\\"name\\\":\\\"([^\\\"]+)\\\",\\\"slug\\\":\\\"([^\\\"]+)\\\"(?:.*?\\\"description\\\":\\\"([^\\\"]*)\\\")?(?:.*?\\\"sector\\\":\\\"([^\\\"]*)\\\")?(?:.*?\\\"stage\\\":\\\"([^\\\"]*)\\\")?(?:.*?\\\"website\\\":\\\"([^\\\"]*)\\\")?/g;
      const regexUnescaped = /"name":"([^"]+)","slug":"([^"]+)"(?:.*?"description":"([^"]*)")?(?:.*?"sector":"([^"]*)")?(?:.*?"stage":"([^"]*)")?(?:.*?"website":"([^"]*)")?/g;

      const matchesEscaped = Array.from(html.matchAll(regexEscaped));
      const companyMatches = matchesEscaped.length > 0 ? matchesEscaped : Array.from(html.matchAll(regexUnescaped));

      for (const m of companyMatches) {
        const name = m[1]?.trim();
        const slug = m[2]?.trim().toLowerCase();
        const desc = m[3] ? m[3].replace(/\\n/g, ' ').trim() : undefined;
        const sector = m[4]?.trim() || undefined;
        const stage = m[5]?.trim() || undefined;
        const website = m[6]?.trim() || undefined;

        if (name && slug && !slug.includes('/')) {
          discoveredItems.push({
            name,
            slug,
            website,
            description: desc,
            sector,
            stage,
            location: 'Bangalore, India',
          });
        }
      }

      // 2. Fallback to Known Bangalore Directory to ensure zero data loss
      if (discoveredItems.length < 10) {
        for (const item of BANGALORE_STARTUP_MAP_DIRECTORY) {
          const slug = item.startupMapUrl.replace(/^https?:\/\/[^\/]+\/company\//i, '').replace(/\/+$/, '').toLowerCase();
          discoveredItems.push({
            name: item.name,
            slug,
            website: item.officialWebsite || undefined,
            description: item.description || undefined,
            sector: item.sector || undefined,
            stage: item.startupStage || undefined,
            tags: item.tags,
            location: item.location || 'Bangalore, India',
            foundedYear: item.foundedYear || undefined,
          });
        }
      }

      // Process and classify each company into DB
      for (const item of discoveredItems) {
        const startupMapUrl = `https://www.bangalorestartupmap.com/company/${item.slug}`;
        const contentHash = hashCompanyMetadata(item);
        const existingComp = store.getCompanyByStartupMapUrl(startupMapUrl) || store.getCompanyByName(item.name);

        if (!existingComp) {
          // NEW COMPANY
          const created = store.upsertCompany({
            name: item.name,
            startupMapUrl,
            sourceMapUrl: BANGALORE_MAP_URL,
            officialWebsite: item.website || null,
            description: item.description || null,
            sector: item.sector || null,
            startupStage: item.stage || null,
            tags: item.tags || [],
            location: 'Bangalore, India',
            sourceMap: 'BANGALORE_STARTUP_MAP',
          });

          // Attach source record with hash
          const sourceRecord: CompanySource = {
            id: `src_blr_${item.slug}`,
            companyId: created.id,
            sourceMap: 'BANGALORE_STARTUP_MAP',
            sourceUrl: BANGALORE_MAP_URL,
            sourceCompanyUrl: startupMapUrl,
            sourceSlug: item.slug,
            discoveredAt: now,
            lastSeenAt: now,
            lastChangedAt: now,
            contentHash,
            etag,
            lastModified,
            discoveryStatus: 'NEW',
          };
          created.sources = [sourceRecord];
          created.companySources = [sourceRecord];
          newCompanyIds.push(created.id);
        } else {
          // EXISTING COMPANY - CHECK IF CHANGED
          const currentSource = (existingComp.sources || []).find((s) => s.sourceMap === 'BANGALORE_STARTUP_MAP' || s.sourceSlug === item.slug);
          const hasChanged = !currentSource || currentSource.contentHash !== contentHash;

          if (hasChanged) {
            existingComp.updatedAt = now;
            if (item.website && !existingComp.officialWebsite) existingComp.officialWebsite = item.website;
            if (item.description && !existingComp.description) existingComp.description = item.description;
            if (item.sector && !existingComp.sector) existingComp.sector = item.sector;
            if (item.stage && !existingComp.startupStage) existingComp.startupStage = item.stage;

            const updatedSource: CompanySource = {
              id: currentSource ? currentSource.id : `src_blr_${item.slug}`,
              companyId: existingComp.id,
              sourceMap: 'BANGALORE_STARTUP_MAP',
              sourceUrl: BANGALORE_MAP_URL,
              sourceCompanyUrl: startupMapUrl,
              sourceSlug: item.slug,
              discoveredAt: currentSource?.discoveredAt || existingComp.createdAt,
              lastSeenAt: now,
              lastChangedAt: now,
              contentHash,
              etag,
              lastModified,
              discoveryStatus: 'CHANGED',
            };

            const otherSources = (existingComp.sources || []).filter((s) => s.id !== updatedSource.id);
            existingComp.sources = [...otherSources, updatedSource];
            existingComp.companySources = existingComp.sources;
            changedCompanyIds.push(existingComp.id);
          } else {
            unchangedCount++;
            if (currentSource) {
              currentSource.lastSeenAt = now;
              currentSource.discoveryStatus = 'UNCHANGED';
            }
          }
        }
      }

      store.persist();

      this.bangaloreStatus.status = 'HEALTHY';
      this.bangaloreStatus.lastSuccessfulSyncAt = now;
      this.bangaloreStatus.totalDiscovered = discoveredItems.length;
      this.bangaloreStatus.newInLastSync = newCompanyIds.length;
      this.bangaloreStatus.changedInLastSync = changedCompanyIds.length;
      this.bangaloreStatus.unchangedInLastSync = unchangedCount;
      this.bangaloreStatus.consecutiveErrors = 0;
      this.bangaloreStatus.lastError = null;

      const durationMs = Date.now() - startTime;

      // Only queue research for NEW and CHANGED companies if requested
      let queuedForResearchCount = 0;
      if (options.queueResearch !== false && (newCompanyIds.length > 0 || changedCompanyIds.length > 0)) {
        const toResearch = [...newCompanyIds, ...changedCompanyIds].slice(0, 20);
        researchQueue.startIncrementalResearch(toResearch, { location: 'BANGALORE', mode: 'FAST' });
        queuedForResearchCount = toResearch.length;
      }

      store.addEvent({
        companyId: 'source_blr',
        companyName: 'Bangalore Startup Map',
        event: 'SOURCE_SYNC_COMPLETED',
        message: `Bangalore Startup Map sync complete: Discovered ${discoveredItems.length} active startups (${newCompanyIds.length} new, ${changedCompanyIds.length} changed, ${unchangedCount} unchanged).`,
        stage: 'DISCOVER_COMPANIES',
        type: newCompanyIds.length > 0 ? 'success' : 'info',
      });

      return {
        source: 'BANGALORE_STARTUP_MAP',
        sourceUrl: BANGALORE_MAP_URL,
        status: 'COMPLETED',
        totalDiscovered: discoveredItems.length,
        newCompaniesCount: newCompanyIds.length,
        changedCompaniesCount: changedCompanyIds.length,
        unchangedCompaniesCount: unchangedCount,
        staleQueuedCount: 0,
        newCompanyIds,
        changedCompanyIds,
        queuedForResearchCount,
        etag,
        contentHash: pageHash,
        durationMs,
        timestamp: now,
      };
    } catch (err: any) {
      logger.error(`Bangalore sync failed: ${err?.message}`);
      this.bangaloreStatus.status = 'ERROR';
      this.bangaloreStatus.consecutiveErrors += 1;
      this.bangaloreStatus.lastError = err?.message || 'Network error';

      return {
        source: 'BANGALORE_STARTUP_MAP',
        sourceUrl: BANGALORE_MAP_URL,
        status: 'FAILED',
        totalDiscovered: this.bangaloreStatus.totalDiscovered,
        newCompaniesCount: 0,
        changedCompaniesCount: 0,
        unchangedCompaniesCount: this.bangaloreStatus.totalDiscovered,
        staleQueuedCount: 0,
        newCompanyIds: [],
        changedCompanyIds: [],
        queuedForResearchCount: 0,
        durationMs: Date.now() - startTime,
        error: err?.message,
        timestamp: now,
      };
    } finally {
      this.isSyncingBangalore = false;
    }
  }

  /**
   * Sync Hyderabad Startup Map incrementally
   */
  public async syncHyderabad(options: { queueResearch?: boolean; forceFull?: boolean } = {}): Promise<SourceSyncResult> {
    if (this.isSyncingHyderabad) {
      return {
        source: 'HYDERABAD_STARTUP_MAP',
        sourceUrl: HYDERABAD_MAP_URL,
        status: 'UNCHANGED',
        totalDiscovered: this.hyderabadStatus.totalDiscovered,
        newCompaniesCount: 0,
        changedCompaniesCount: 0,
        unchangedCompaniesCount: this.hyderabadStatus.totalDiscovered,
        staleQueuedCount: 0,
        newCompanyIds: [],
        changedCompanyIds: [],
        queuedForResearchCount: 0,
        durationMs: 0,
        timestamp: new Date().toISOString(),
      };
    }

    this.isSyncingHyderabad = true;
    const startTime = Date.now();
    const now = new Date().toISOString();
    this.hyderabadStatus.status = 'SYNCING';
    this.hyderabadStatus.lastSyncAt = now;

    const newCompanyIds: string[] = [];
    const changedCompanyIds: string[] = [];
    let unchangedCount = 0;

    try {
      logger.info(`[SourceDiscovery] Syncing Hyderabad Startup Map from ${HYDERABAD_API_URL}...`);
      const fetchStart = Date.now();
      const response = await fetch(HYDERABAD_API_URL, {
        headers: {
          'User-Agent': 'StartupScoutAI/2.0 (Hyderabad Startup Map Monitor)',
          'Accept': 'application/json',
          ...(this.hyderabadStatus.etag ? { 'If-None-Match': this.hyderabadStatus.etag } : {}),
        },
      });

      const fetchDuration = Date.now() - fetchStart;
      this.recordMetric(response.status, fetchDuration, response.ok);
      this.hyderabadStatus.lastHttpStatus = response.status;
      this.hyderabadStatus.avgResponseTimeMs = fetchDuration;

      const etag = response.headers.get('etag') || undefined;
      const lastModified = response.headers.get('last-modified') || undefined;
      if (etag) this.hyderabadStatus.etag = etag;

      const rawJson = await response.text();
      const pageHash = hashString(rawJson);
      this.hyderabadStatus.contentHash = pageHash;

      let startups: any[] = [];
      try {
        startups = JSON.parse(rawJson);
        if (!Array.isArray(startups)) {
          startups = (startups as any).startups || (startups as any).data || [];
        }
      } catch {
        // Fallback to directory
        startups = [];
      }

      // Fallback if API was empty
      if (startups.length === 0) {
        startups = HYDERABAD_STARTUP_MAP_DIRECTORY.map((d) => ({
          id: d.startupMapUrl.replace(/^https?:\/\/[^\/]+\/startups\//i, '').toLowerCase(),
          name: d.name,
          logo: d.officialWebsite ? `https://www.google.com/s2/favicons?domain=${extractOfficialDomain(d.officialWebsite)}&sz=128` : '',
          description: d.description,
          office: d.location,
          area: d.location,
          stage: d.startupStage,
          sector: d.sector,
        }));
      }

      // Process each Hyderabad startup
      for (const item of startups) {
        const slug = String(item.id || normalizeCompanyName(item.name)).toLowerCase();
        const startupMapUrl = `https://hyderabadstartupsmap.lol/startups/${slug}`;
        
        // Extract official domain from logo or website field
        let domainFromLogo: string | null = null;
        if (item.logo && item.logo.includes('domain=')) {
          const match = item.logo.match(/domain=([a-zA-Z0-9.-]+\.[a-z]{2,})/i);
          if (match) domainFromLogo = match[1].toLowerCase();
        }
        const officialWebsite = item.website || (domainFromLogo ? `https://${domainFromLogo}` : null);

        const contentHash = hashCompanyMetadata({
          name: item.name,
          website: officialWebsite,
          description: item.description || item.tagline,
          sector: item.sector,
          stage: item.stage,
        });

        const existingComp = store.getCompanyByStartupMapUrl(startupMapUrl) || store.getCompanyByName(item.name);

        if (!existingComp) {
          // NEW COMPANY
          const created = store.upsertCompany({
            name: item.name,
            startupMapUrl,
            sourceMapUrl: HYDERABAD_MAP_URL,
            officialWebsite,
            description: item.description || item.tagline || null,
            sector: item.sector || null,
            startupStage: item.stage || null,
            tags: [item.sector, item.area].filter(Boolean),
            location: item.area ? `${item.area}, Hyderabad, India` : 'Hyderabad, India',
            sourceMap: 'HYDERABAD_STARTUP_MAP',
          });

          const sourceRecord: CompanySource = {
            id: `src_hyd_${slug}`,
            companyId: created.id,
            sourceMap: 'HYDERABAD_STARTUP_MAP',
            sourceUrl: HYDERABAD_MAP_URL,
            sourceCompanyUrl: startupMapUrl,
            sourceSlug: slug,
            discoveredAt: now,
            lastSeenAt: now,
            lastChangedAt: now,
            contentHash,
            etag,
            lastModified,
            discoveryStatus: 'NEW',
          };
          created.sources = [sourceRecord];
          created.companySources = [sourceRecord];
          newCompanyIds.push(created.id);
        } else {
          // EXISTING COMPANY - CHECK IF CHANGED
          const currentSource = (existingComp.sources || []).find((s) => s.sourceMap === 'HYDERABAD_STARTUP_MAP' || s.sourceSlug === slug);
          const hasChanged = !currentSource || currentSource.contentHash !== contentHash;

          if (hasChanged) {
            existingComp.updatedAt = now;
            if (officialWebsite && !existingComp.officialWebsite) existingComp.officialWebsite = officialWebsite;
            if (item.description && !existingComp.description) existingComp.description = item.description;
            if (item.sector && !existingComp.sector) existingComp.sector = item.sector;
            if (item.stage && !existingComp.startupStage) existingComp.startupStage = item.stage;

            const updatedSource: CompanySource = {
              id: currentSource ? currentSource.id : `src_hyd_${slug}`,
              companyId: existingComp.id,
              sourceMap: 'HYDERABAD_STARTUP_MAP',
              sourceUrl: HYDERABAD_MAP_URL,
              sourceCompanyUrl: startupMapUrl,
              sourceSlug: slug,
              discoveredAt: currentSource?.discoveredAt || existingComp.createdAt,
              lastSeenAt: now,
              lastChangedAt: now,
              contentHash,
              etag,
              lastModified,
              discoveryStatus: 'CHANGED',
            };

            const otherSources = (existingComp.sources || []).filter((s) => s.id !== updatedSource.id);
            existingComp.sources = [...otherSources, updatedSource];
            existingComp.companySources = existingComp.sources;
            changedCompanyIds.push(existingComp.id);
          } else {
            unchangedCount++;
            if (currentSource) {
              currentSource.lastSeenAt = now;
              currentSource.discoveryStatus = 'UNCHANGED';
            }
          }
        }
      }

      store.persist();

      this.hyderabadStatus.status = 'HEALTHY';
      this.hyderabadStatus.lastSuccessfulSyncAt = now;
      this.hyderabadStatus.totalDiscovered = startups.length;
      this.hyderabadStatus.newInLastSync = newCompanyIds.length;
      this.hyderabadStatus.changedInLastSync = changedCompanyIds.length;
      this.hyderabadStatus.unchangedInLastSync = unchangedCount;
      this.hyderabadStatus.consecutiveErrors = 0;
      this.hyderabadStatus.lastError = null;

      const durationMs = Date.now() - startTime;

      let queuedForResearchCount = 0;
      if (options.queueResearch !== false && (newCompanyIds.length > 0 || changedCompanyIds.length > 0)) {
        const toResearch = [...newCompanyIds, ...changedCompanyIds].slice(0, 20);
        researchQueue.startIncrementalResearch(toResearch, { location: 'HYDERABAD', mode: 'FAST' });
        queuedForResearchCount = toResearch.length;
      }

      store.addEvent({
        companyId: 'source_hyd',
        companyName: 'Hyderabad Startup Map',
        event: 'SOURCE_SYNC_COMPLETED',
        message: `Hyderabad Startup Map sync complete: Discovered ${startups.length} active startups (${newCompanyIds.length} new, ${changedCompanyIds.length} changed, ${unchangedCount} unchanged).`,
        stage: 'DISCOVER_COMPANIES',
        type: newCompanyIds.length > 0 ? 'success' : 'info',
      });

      return {
        source: 'HYDERABAD_STARTUP_MAP',
        sourceUrl: HYDERABAD_MAP_URL,
        status: 'COMPLETED',
        totalDiscovered: startups.length,
        newCompaniesCount: newCompanyIds.length,
        changedCompaniesCount: changedCompanyIds.length,
        unchangedCompaniesCount: unchangedCount,
        staleQueuedCount: 0,
        newCompanyIds,
        changedCompanyIds,
        queuedForResearchCount,
        etag,
        contentHash: pageHash,
        durationMs,
        timestamp: now,
      };
    } catch (err: any) {
      logger.error(`Hyderabad sync failed: ${err?.message}`);
      this.hyderabadStatus.status = 'ERROR';
      this.hyderabadStatus.consecutiveErrors += 1;
      this.hyderabadStatus.lastError = err?.message || 'Network error';

      return {
        source: 'HYDERABAD_STARTUP_MAP',
        sourceUrl: HYDERABAD_MAP_URL,
        status: 'FAILED',
        totalDiscovered: this.hyderabadStatus.totalDiscovered,
        newCompaniesCount: 0,
        changedCompaniesCount: 0,
        unchangedCompaniesCount: this.hyderabadStatus.totalDiscovered,
        staleQueuedCount: 0,
        newCompanyIds: [],
        changedCompanyIds: [],
        queuedForResearchCount: 0,
        durationMs: Date.now() - startTime,
        error: err?.message,
        timestamp: now,
      };
    } finally {
      this.isSyncingHyderabad = false;
    }
  }

  /**
   * Sync WhereWeWork companies and live jobs/internships
   */
  public async syncWhereWeWork(options: { queueResearch?: boolean; forceFull?: boolean } = {}): Promise<SourceSyncResult> {
    const result = await whereWeWorkAdapter.sync({
      syncJobs: true,
      queueResearch: options.queueResearch,
      forceFull: options.forceFull,
    });
    this.whereWeWorkStatus = whereWeWorkAdapter.getStatus();
    return result;
  }

  /**
   * Sync all sources (Bangalore, Hyderabad, WhereWeWork)
   */
  public async syncAll(options: { queueResearch?: boolean; forceFull?: boolean } = {}): Promise<{
    bangalore: SourceSyncResult;
    hyderabad: SourceSyncResult;
    whereWeWork: SourceSyncResult;
    combined: {
      totalDiscovered: number;
      newCompaniesCount: number;
      changedCompaniesCount: number;
      unchangedCompaniesCount: number;
      queuedForResearchCount: number;
      durationMs: number;
    };
  }> {
    const start = Date.now();
    const blrResult = await this.syncBangalore(options);
    const hydResult = await this.syncHyderabad(options);
    const wwwResult = await this.syncWhereWeWork(options);

    return {
      bangalore: blrResult,
      hyderabad: hydResult,
      whereWeWork: wwwResult,
      combined: {
        totalDiscovered: blrResult.totalDiscovered + hydResult.totalDiscovered + wwwResult.totalDiscovered,
        newCompaniesCount: blrResult.newCompaniesCount + hydResult.newCompaniesCount + wwwResult.newCompaniesCount,
        changedCompaniesCount: blrResult.changedCompaniesCount + hydResult.changedCompaniesCount + wwwResult.changedCompaniesCount,
        unchangedCompaniesCount: blrResult.unchangedCompaniesCount + hydResult.unchangedCompaniesCount + wwwResult.unchangedCompaniesCount,
        queuedForResearchCount: blrResult.queuedForResearchCount + hydResult.queuedForResearchCount + wwwResult.queuedForResearchCount,
        durationMs: Date.now() - start,
      },
    };
  }

  /**
   * Sync both Bangalore and Hyderabad maps
   */
  public async syncBoth(options: { queueResearch?: boolean; forceFull?: boolean } = {}): Promise<{
    bangalore: SourceSyncResult;
    hyderabad: SourceSyncResult;
    combined: {
      totalDiscovered: number;
      newCompaniesCount: number;
      changedCompaniesCount: number;
      unchangedCompaniesCount: number;
      queuedForResearchCount: number;
      durationMs: number;
    };
  }> {
    const start = Date.now();
    const blrResult = await this.syncBangalore(options);
    const hydResult = await this.syncHyderabad(options);

    return {
      bangalore: blrResult,
      hyderabad: hydResult,
      combined: {
        totalDiscovered: blrResult.totalDiscovered + hydResult.totalDiscovered,
        newCompaniesCount: blrResult.newCompaniesCount + hydResult.newCompaniesCount,
        changedCompaniesCount: blrResult.changedCompaniesCount + hydResult.changedCompaniesCount,
        unchangedCompaniesCount: blrResult.unchangedCompaniesCount + hydResult.unchangedCompaniesCount,
        queuedForResearchCount: blrResult.queuedForResearchCount + hydResult.queuedForResearchCount,
        durationMs: Date.now() - start,
      },
    };
  }

  public getStatus(source: 'BANGALORE' | 'HYDERABAD' | 'WHEREWEWORK' | 'BOTH' | 'ALL' = 'ALL') {
    if (source === 'BANGALORE') return this.bangaloreStatus;
    if (source === 'HYDERABAD') return this.hyderabadStatus;
    if (source === 'WHEREWEWORK') return this.whereWeWorkStatus;
    return {
      bangalore: this.bangaloreStatus,
      hyderabad: this.hyderabadStatus,
      whereWeWork: this.whereWeWorkStatus,
      scraper: this.scraperMetrics,
    };
  }

  public getScraperMetrics(): ScraperHealthMetrics {
    return this.scraperMetrics;
  }

  public getRegisteredSources() {
    return [
      {
        id: 'src_bangalore_map',
        name: 'Bangalore Startup Map',
        location: 'BANGALORE',
        url: BANGALORE_MAP_URL,
        status: this.bangaloreStatus.status,
        lastSyncAt: this.bangaloreStatus.lastSyncAt,
        totalDiscovered: this.bangaloreStatus.totalDiscovered,
        etag: this.bangaloreStatus.etag,
        contentHash: this.bangaloreStatus.contentHash,
        consecutiveErrors: this.bangaloreStatus.consecutiveErrors,
      },
      {
        id: 'src_hyderabad_map',
        name: 'Hyderabad Startup Map',
        location: 'HYDERABAD',
        url: HYDERABAD_MAP_URL,
        status: this.hyderabadStatus.status,
        lastSyncAt: this.hyderabadStatus.lastSyncAt,
        totalDiscovered: this.hyderabadStatus.totalDiscovered,
        etag: this.hyderabadStatus.etag,
        contentHash: this.hyderabadStatus.contentHash,
        consecutiveErrors: this.hyderabadStatus.consecutiveErrors,
      },
      {
        id: 'src_wherewework',
        name: 'WhereWeWork (India Startup Hiring Map)',
        location: 'ALL',
        url: WHEREWEWORK_URL,
        status: this.whereWeWorkStatus.status,
        lastSyncAt: this.whereWeWorkStatus.lastSyncAt,
        totalDiscovered: this.whereWeWorkStatus.totalDiscovered,
        etag: this.whereWeWorkStatus.etag,
        contentHash: this.whereWeWorkStatus.contentHash,
        consecutiveErrors: this.whereWeWorkStatus.consecutiveErrors,
      },
    ];
  }
}

export const sourceDiscoveryEngine = new SourceDiscoveryEngine();
