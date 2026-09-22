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
import { HYDERABAD_STARTUP_MAP_DIRECTORY } from '../crawler/hyderabadStartupMapCrawler.ts';
import { logger } from '../utils/logger.ts';

const BASE_URL = 'https://hyderabadstartupsmap.lol';
const API_URL = 'https://hyderabadstartupsmap.lol/api/startups';
const SITEMAP_URL = 'https://hyderabadstartupsmap.lol/sitemap.xml';

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input || '').digest('hex');
}

export function extractDomainFromLogo(logoUrl?: string | null): string | null {
  if (!logoUrl) return null;
  const match = logoUrl.match(/domain=([a-zA-Z0-9.-]+\.[a-z]{2,})/i);
  return match ? match[1].toLowerCase() : null;
}

export class HyderabadStartupMapAdapter implements SourceAdapter {
  public readonly id = 'src_hyderabad_map';
  public readonly name = 'Hyderabad Startup Map';
  public readonly sourceMap: StartupMapSource = 'HYDERABAD_STARTUP_MAP';
  public readonly baseUrl = BASE_URL;

  private status: SourceMonitoringStatus = {
    sourceMap: 'HYDERABAD_STARTUP_MAP',
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
    avgResponseTimeMs: 350,
  };

  public getStatus(): SourceMonitoringStatus {
    return { ...this.status };
  }

  /**
   * Discovers all Hyderabad startups using multi-layer discovery:
   * 1. Public live API endpoint (/api/startups)
   * 2. Live sitemap.xml (/sitemap.xml)
   * 3. Curated directory fallback
   */
  public async discoverCompanies(options: { forceFull?: boolean; limit?: number } = {}): Promise<DiscoveredCompanyInput[]> {
    const discoveredMap = new Map<string, DiscoveredCompanyInput>();
    const startTime = Date.now();

    // Layer 1: Attempt direct public API fetch
    try {
      logger.info(`[HyderabadAdapter] Fetching startup records from ${API_URL}...`);
      const res = await fetch(API_URL, {
        headers: {
          'User-Agent': 'StartupScoutAI/2.0 (Hyderabad Startup Map Adapter)',
          'Accept': 'application/json',
          ...(this.status.etag && !options.forceFull ? { 'If-None-Match': this.status.etag } : {}),
        },
        signal: AbortSignal.timeout(15000),
      });

      this.status.lastHttpStatus = res.status;
      this.status.avgResponseTimeMs = Date.now() - startTime;

      if (res.ok) {
        const etag = res.headers.get('etag');
        if (etag) this.status.etag = etag;

        const data = await res.json();
        const items = Array.isArray(data) ? data : (data?.startups || data?.data || []);

        for (const item of items) {
          const slug = String(item.id || item.slug || normalizeCompanyName(item.name)).toLowerCase().trim();
          if (!slug) continue;

          const domain = extractDomainFromLogo(item.logo) || extractOfficialDomain(item.website);
          const officialWebsite = item.website || (domain ? `https://${domain}` : null);
          const startupMapUrl = `${BASE_URL}/startups/${slug}`;

          const entry: DiscoveredCompanyInput = {
            name: item.name?.trim() || slug,
            officialDomain: domain || null,
            officialWebsite,
            startupMapUrl,
            sourceCompanyUrl: startupMapUrl,
            sourceSlug: slug,
            sourceMap: 'HYDERABAD_STARTUP_MAP',
            location: 'Hyderabad, India',
            city: 'Hyderabad',
            state: 'Telangana',
            country: 'India',
            description: item.description || item.tagline || null,
            sector: item.sector || 'Technology',
            category: item.sector || 'Enterprise Tech',
            tags: [item.sector, item.area, item.stage].filter(Boolean),
            startupStage: item.stage || null,
            logoUrl: item.logo || null,
            latitude: item.lat || null,
            longitude: item.lng || null,
            officeAddress: item.office || null,
            area: item.area || null,
            rawMetadata: item,
          };

          entry.contentHash = this.computeContentHash(entry);
          discoveredMap.set(slug, entry);
        }
        logger.info(`[HyderabadAdapter] Successfully loaded ${discoveredMap.size} companies from API`);
      }
    } catch (apiErr: any) {
      logger.warn(`[HyderabadAdapter] API fetch encountered error: ${apiErr?.message}. Falling back to sitemap/directory.`);
    }

    // Layer 2: If API was empty or failed, fetch live sitemap.xml
    if (discoveredMap.size === 0) {
      try {
        logger.info(`[HyderabadAdapter] Scraping sitemap from ${SITEMAP_URL}...`);
        const smRes = await fetch(SITEMAP_URL, {
          headers: { 'User-Agent': 'StartupScoutAI/2.0' },
          signal: AbortSignal.timeout(15000),
        });

        if (smRes.ok) {
          const smXml = await smRes.text();
          const matches = smXml.match(/https?:\/\/[^\s<>]+\/startups\/[^\s<>]+/g) || [];
          for (const rawUrl of matches) {
            const cleanUrl = rawUrl.trim();
            const slug = cleanUrl.replace(/^https?:\/\/[^\/]+\/startups\//i, '').replace(/\/+$/, '').toLowerCase();
            if (slug && !discoveredMap.has(slug)) {
              const name = slug
                .split('-')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

              const entry: DiscoveredCompanyInput = {
                name,
                startupMapUrl: cleanUrl,
                sourceCompanyUrl: cleanUrl,
                sourceSlug: slug,
                sourceMap: 'HYDERABAD_STARTUP_MAP',
                location: 'Hyderabad, India',
                city: 'Hyderabad',
                state: 'Telangana',
                country: 'India',
              };
              entry.contentHash = this.computeContentHash(entry);
              discoveredMap.set(slug, entry);
            }
          }
          logger.info(`[HyderabadAdapter] Discovered ${discoveredMap.size} companies from sitemap`);
        }
      } catch (smErr: any) {
        logger.warn(`[HyderabadAdapter] Sitemap crawl failed: ${smErr?.message}`);
      }
    }

    // Layer 3: Curated Directory Fallback (ensures robust baseline even offline)
    for (const cur of HYDERABAD_STARTUP_MAP_DIRECTORY) {
      const slug = cur.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!discoveredMap.has(slug)) {
        const domain = extractOfficialDomain(cur.officialWebsite);
        const entry: DiscoveredCompanyInput = {
          name: cur.name,
          officialDomain: domain,
          officialWebsite: cur.officialWebsite || null,
          startupMapUrl: cur.startupMapUrl || `${BASE_URL}/startups/${slug}`,
          sourceCompanyUrl: cur.startupMapUrl || `${BASE_URL}/startups/${slug}`,
          sourceSlug: slug,
          sourceMap: 'HYDERABAD_STARTUP_MAP',
          location: cur.location || 'Hyderabad, India',
          city: 'Hyderabad',
          state: 'Telangana',
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
      } else {
        // Enrich existing entry with known careers URL / linkedin if missing
        const existing = discoveredMap.get(slug)!;
        if (!existing.careersUrl && cur.careersUrl) existing.careersUrl = cur.careersUrl;
        if (!existing.officialWebsite && cur.officialWebsite) existing.officialWebsite = cur.officialWebsite;
        if (!existing.linkedinUrl && cur.linkedinUrl) existing.linkedinUrl = cur.linkedinUrl;
      }
    }

    const results = Array.from(discoveredMap.values());
    if (options.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  /**
   * Discovers a single company's profile page details
   */
  public async discoverCompany(slugOrId: string): Promise<DiscoveredCompanyInput | null> {
    const slug = slugOrId.toLowerCase().trim();
    const profileUrl = `${BASE_URL}/startups/${slug}`;

    try {
      const res = await fetch(profileUrl, {
        headers: { 'User-Agent': 'StartupScoutAI/2.0' },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) return null;
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('title').text() || '';
      const nameMatch = title.match(/^([^–\-|]+)/);
      const name = nameMatch ? nameMatch[1].trim() : slug;
      const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;
      const keywords = $('meta[name="keywords"]').attr('content') || '';
      const tags = keywords.split(',').map((k) => k.trim()).filter(Boolean);

      // Look for external official website or logo
      let domain: string | null = null;
      $('img').each((_, el) => {
        const src = $(el).attr('src') || '';
        const d = extractDomainFromLogo(src);
        if (d && !domain) domain = d;
      });

      const entry: DiscoveredCompanyInput = {
        name,
        officialDomain: domain,
        officialWebsite: domain ? `https://${domain}` : null,
        startupMapUrl: profileUrl,
        sourceCompanyUrl: profileUrl,
        sourceSlug: slug,
        sourceMap: 'HYDERABAD_STARTUP_MAP',
        location: 'Hyderabad, India',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        description,
        tags,
      };

      entry.contentHash = this.computeContentHash(entry);
      return entry;
    } catch (err) {
      return null;
    }
  }

  /**
   * Discovers career pages / ATS links for a company
   */
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
      const potentialCareerUrls = [
        `${baseUrl}/careers`,
        `${baseUrl}/jobs`,
        `${baseUrl}/join-us`,
        `${baseUrl}/work-with-us`,
      ];

      for (const url of potentialCareerUrls) {
        if (!sources.some((s) => s.url === url)) {
          sources.push({
            type: 'OFFICIAL_CAREERS',
            url,
            companyId: company.id,
          });
        }
      }
    }

    return sources;
  }

  public async discoverJobs(company: Company): Promise<DiscoveredJobInput[]> {
    // Standard jobs discovered during company research
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
          sourceMap: 'HYDERABAD_STARTUP_MAP',
          location: item.location || 'Hyderabad, India',
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
        source: 'HYDERABAD_STARTUP_MAP',
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
      logger.error(`[HyderabadAdapter] Sync failed: ${err?.message}`);
      this.status.status = 'ERROR';
      this.status.lastError = err?.message;
      this.status.consecutiveErrors++;

      return {
        source: 'HYDERABAD_STARTUP_MAP',
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

export const hyderabadStartupMapAdapter = new HyderabadStartupMapAdapter();
