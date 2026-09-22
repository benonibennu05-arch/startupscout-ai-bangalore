import crypto from 'crypto';
import * as cheerio from 'cheerio';
import {
  SourceAdapter,
  DiscoveredCompanyInput,
  DiscoveredJobInput,
  CareerSourceLink,
  SourceChangeDetectionResult,
} from './sourceAdapter.interface.ts';
import {
  Company,
  StartupMapSource,
  SourceSyncResult,
  SourceMonitoringStatus,
} from '../types.ts';
import { store, normalizeCompanyName, extractOfficialDomain } from '../database/store.ts';
import { BANGALORE_STARTUP_MAP_DIRECTORY, crawlStartupMap } from '../crawler/startupMapCrawler.ts';
import { logger } from '../utils/logger.ts';

const BASE_URL = 'https://www.bangalorestartupmap.com/';

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input || '').digest('hex');
}

export class BangaloreStartupMapAdapter implements SourceAdapter {
  public readonly id = 'src_bangalore_map';
  public readonly name = 'Bangalore Startup Map';
  public readonly sourceMap: StartupMapSource = 'BANGALORE_STARTUP_MAP';
  public readonly baseUrl = BASE_URL;

  private status: SourceMonitoringStatus = {
    sourceMap: 'BANGALORE_STARTUP_MAP',
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
    avgResponseTimeMs: 400,
  };

  public getStatus(): SourceMonitoringStatus {
    return { ...this.status };
  }

  public async discoverCompanies(options: { forceFull?: boolean; limit?: number } = {}): Promise<DiscoveredCompanyInput[]> {
    const discoveredMap = new Map<string, DiscoveredCompanyInput>();

    // 1. First run the full dynamic scraper which explores sitemaps, pagination & live directory
    try {
      const crawled = await crawlStartupMap();
      for (const item of crawled) {
        const slug = item.startupMapUrl
          .replace(/^https?:\/\/[^\/]+\/compan(ies|y)\//i, '')
          .replace(/\/+$/, '')
          .toLowerCase();

        const domain = extractOfficialDomain(item.officialWebsite);
        const entry: DiscoveredCompanyInput = {
          name: item.name,
          officialDomain: domain,
          officialWebsite: item.officialWebsite || null,
          startupMapUrl: item.startupMapUrl,
          sourceCompanyUrl: item.startupMapUrl,
          sourceSlug: slug,
          sourceMap: 'BANGALORE_STARTUP_MAP',
          location: item.location || 'Bangalore, India',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          description: item.description || null,
          sector: item.sector || null,
          category: item.category || null,
          tags: item.tags || [],
          foundedYear: item.foundedYear || null,
          startupStage: item.startupStage || null,
          teamSize: item.teamSize || null,
          linkedinUrl: item.linkedinUrl || null,
          careersUrl: item.careersUrl || null,
        };
        entry.contentHash = this.computeContentHash(entry);
        discoveredMap.set(slug, entry);
      }
    } catch (e: any) {
      logger.warn(`[BangaloreAdapter] Dynamic crawler warning: ${e?.message}`);
    }

    // 2. Supplement with high-fidelity directory
    for (const cur of BANGALORE_STARTUP_MAP_DIRECTORY) {
      const slug = cur.startupMapUrl
        .replace(/^https?:\/\/[^\/]+\/compan(ies|y)\//i, '')
        .replace(/\/+$/, '')
        .toLowerCase();

      if (!discoveredMap.has(slug)) {
        const domain = extractOfficialDomain(cur.officialWebsite);
        const entry: DiscoveredCompanyInput = {
          name: cur.name,
          officialDomain: domain,
          officialWebsite: cur.officialWebsite || null,
          startupMapUrl: cur.startupMapUrl,
          sourceCompanyUrl: cur.startupMapUrl,
          sourceSlug: slug,
          sourceMap: 'BANGALORE_STARTUP_MAP',
          location: cur.location || 'Bangalore, India',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          description: cur.description || null,
          sector: cur.sector || null,
          category: cur.category || null,
          tags: cur.tags || [],
          foundedYear: cur.foundedYear || null,
          startupStage: cur.startupStage || null,
          teamSize: cur.teamSize || null,
          linkedinUrl: cur.linkedinUrl || null,
          careersUrl: cur.careersUrl || null,
        };
        entry.contentHash = this.computeContentHash(entry);
        discoveredMap.set(slug, entry);
      }
    }

    const results = Array.from(discoveredMap.values());
    if (options.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  public async discoverCompany(slugOrId: string): Promise<DiscoveredCompanyInput | null> {
    const slug = slugOrId.toLowerCase().trim();
    const profileUrl = `${BASE_URL}/companies/${slug}`;

    try {
      const res = await fetch(profileUrl, {
        headers: { 'User-Agent': 'StartupScoutAI/2.0' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return null;
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('title').text() || '';
      const name = title.replace(/\s*[–\-|].*$/, '').trim() || slug;
      const description = $('meta[name="description"]').attr('content') || null;

      const entry: DiscoveredCompanyInput = {
        name,
        startupMapUrl: profileUrl,
        sourceCompanyUrl: profileUrl,
        sourceSlug: slug,
        sourceMap: 'BANGALORE_STARTUP_MAP',
        location: 'Bangalore, India',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        description,
      };
      entry.contentHash = this.computeContentHash(entry);
      return entry;
    } catch {
      return null;
    }
  }

  public async discoverCareerSources(company: Company): Promise<CareerSourceLink[]> {
    const sources: CareerSourceLink[] = [];
    if (company.careersUrl) {
      sources.push({
        type: 'OFFICIAL_CAREERS',
        url: company.careersUrl,
        companyId: company.id,
      });
    }
    if (company.officialWebsite) {
      const baseUrl = company.officialWebsite.replace(/\/+$/, '');
      for (const p of ['/careers', '/jobs', '/join-us']) {
        sources.push({
          type: 'OFFICIAL_CAREERS',
          url: `${baseUrl}${p}`,
          companyId: company.id,
        });
      }
    }
    return sources;
  }

  public async discoverJobs(company: Company): Promise<DiscoveredJobInput[]> {
    return [];
  }

  public async discoverInternships(company: Company): Promise<DiscoveredJobInput[]> {
    return [];
  }

  public detectChanges(
    previousSnapshot: Map<string, string>,
    currentItems: DiscoveredCompanyInput[]
  ): SourceChangeDetectionResult {
    const newIds: string[] = [];
    const changedIds: string[] = [];
    const closedIds: string[] = [];
    let unchangedCount = 0;

    const currentMap = new Map<string, string>();

    for (const item of currentItems) {
      const key = item.sourceSlug || item.name.toLowerCase();
      currentMap.set(key, item.contentHash || '');

      if (!previousSnapshot.has(key)) {
        newIds.push(key);
      } else if (previousSnapshot.get(key) !== item.contentHash) {
        changedIds.push(key);
      } else {
        unchangedCount++;
      }
    }

    for (const prevKey of previousSnapshot.keys()) {
      if (!currentMap.has(prevKey)) {
        closedIds.push(prevKey);
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

  public async sync(options: { forceFull?: boolean; queueResearch?: boolean } = {}): Promise<SourceSyncResult> {
    const startTime = Date.now();
    const now = new Date().toISOString();
    this.status.status = 'SYNCING';
    this.status.lastSyncAt = now;

    try {
      const items = await this.discoverCompanies(options);
      const newCompanyIds: string[] = [];
      const changedCompanyIds: string[] = [];
      let unchangedCount = 0;

      for (const item of items) {
        const canonicalKey = item.officialDomain || normalizeCompanyName(item.name);
        const existing = store.findCompanyByIdentity(canonicalKey);

        const company = store.upsertCompany({
          name: item.name,
          officialDomain: item.officialDomain || undefined,
          officialWebsite: item.officialWebsite || null,
          startupMapUrl: item.startupMapUrl,
          sourceCompanyUrl: item.sourceCompanyUrl,
          sourceMap: 'BANGALORE_STARTUP_MAP',
          location: item.location || 'Bangalore, India',
          description: item.description || null,
          sector: item.sector || null,
          category: item.category || null,
          tags: item.tags || [],
          startupStage: item.startupStage || null,
          foundedYear: item.foundedYear || null,
          teamSize: item.teamSize || null,
          linkedinUrl: item.linkedinUrl || null,
          careersUrl: item.careersUrl || null,
        });

        if (company.createdAt === company.updatedAt) {
          newCompanyIds.push(company.id);
        } else {
          changedCompanyIds.push(company.id);
        }
      }

      this.status.status = 'HEALTHY';
      this.status.lastSuccessfulSyncAt = now;
      this.status.totalDiscovered = items.length;
      this.status.newInLastSync = newCompanyIds.length;
      this.status.changedInLastSync = changedCompanyIds.length;
      this.status.unchangedInLastSync = unchangedCount;
      this.status.consecutiveErrors = 0;
      this.status.lastError = null;

      store.persist();

      return {
        source: 'BANGALORE_STARTUP_MAP',
        sourceUrl: BASE_URL,
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
      logger.error(`[BangaloreAdapter] Sync failed: ${err?.message}`);
      this.status.status = 'ERROR';
      this.status.lastError = err?.message;
      this.status.consecutiveErrors++;

      return {
        source: 'BANGALORE_STARTUP_MAP',
        sourceUrl: BASE_URL,
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
        error: err?.message,
        timestamp: now,
      };
    }
  }

  private computeContentHash(data: DiscoveredCompanyInput): string {
    const raw = [
      data.name.toLowerCase().trim(),
      data.officialDomain || '',
      data.sector || '',
      data.startupStage || '',
      (data.description || '').slice(0, 150),
    ].join('|');
    return hashString(raw);
  }
}

export const bangaloreStartupMapAdapter = new BangaloreStartupMapAdapter();
