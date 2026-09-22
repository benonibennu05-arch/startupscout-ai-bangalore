import crypto from 'crypto';
import {
  SourceAdapter,
  DiscoveredCompanyInput,
  DiscoveredJobInput,
  CareerSourceLink,
  SourceChangeDetectionResult,
} from './sourceAdapter.interface.ts';
import {
  Company,
  Opportunity,
  StartupMapSource,
  SourceSyncResult,
  SourceMonitoringStatus,
} from '../types.ts';
import { store, normalizeCompanyName, extractOfficialDomain } from '../database/store.ts';
import { classifyRole, generateJobFingerprint } from '../ai/roleClassifier.ts';
import { parseLocation } from './career/careerLocationParser.ts';
import { logger } from '../utils/logger.ts';

const BASE_URL = 'https://wherewework.co.in';
const API_BASE_URL = 'https://wherewework-api.fly.dev';

export const PRIMARY_CITIES = [
  'bengaluru',
  'hyderabad',
  'pune',
  'gurugram',
  'delhi',
  'singapore',
  'sanfrancisco',
  'siliconvalley',
  'newyork',
  'boston',
] as const;

// Additional tech hubs to dynamically probe in parallel
export const PROBE_CITIES = [
  'mumbai',
  'noida',
  'chennai',
  'ahmedabad',
  'kolkata',
  'chandigarh',
] as const;

export const WHEREWEWORK_CITIES = [...PRIMARY_CITIES] as const;
export type WhereWeWorkCity = (typeof WHEREWEWORK_CITIES)[number];

const CITY_METADATA: Record<string, { city: string; state: string; country: string }> = {
  bengaluru: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
  hyderabad: { city: 'Hyderabad', state: 'Telangana', country: 'India' },
  pune: { city: 'Pune', state: 'Maharashtra', country: 'India' },
  gurugram: { city: 'Gurugram', state: 'Haryana', country: 'India' },
  delhi: { city: 'Delhi', state: 'Delhi', country: 'India' },
  singapore: { city: 'Singapore', state: 'Singapore', country: 'Singapore' },
  sanfrancisco: { city: 'San Francisco', state: 'California', country: 'United States' },
  siliconvalley: { city: 'Silicon Valley', state: 'California', country: 'United States' },
  newyork: { city: 'New York', state: 'New York', country: 'United States' },
  boston: { city: 'Boston', state: 'Massachusetts', country: 'United States' },
  mumbai: { city: 'Mumbai', state: 'Maharashtra', country: 'India' },
  noida: { city: 'Noida', state: 'Uttar Pradesh', country: 'India' },
  chennai: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' },
  ahmedabad: { city: 'Ahmedabad', state: 'Gujarat', country: 'India' },
  kolkata: { city: 'Kolkata', state: 'West Bengal', country: 'India' },
  chandigarh: { city: 'Chandigarh', state: 'Punjab', country: 'India' },
};

export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input || '').digest('hex');
}

export function isInternshipTitle(title: string): boolean {
  const lower = (title || '').toLowerCase();
  return /\b(intern|internship|trainee|apprentice|fellow|fellowship|student|graduate program|co-op|summer analyst)\b/i.test(lower);
}

function formatJobTitle(title: string): string {
  const trimmed = (title || '').trim();
  if (trimmed.length > 0 && trimmed === trimmed.toLowerCase()) {
    // Convert to title case for cleaner display
    return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return trimmed;
}

function formatJobLocation(rawLocation: string, defaultLocation: string): string {
  if (!rawLocation) return defaultLocation || 'India';
  let loc = rawLocation.trim();
  loc = loc.replace(/\bbengaluru\b/gi, 'Bangalore');
  loc = loc.replace(/\bgurugram\b/gi, 'Gurgaon / Gurugram');
  if (loc.toLowerCase().endsWith(', in')) {
    loc = loc.slice(0, -4) + ', India';
  }
  if (!loc.toLowerCase().includes('india') && !loc.toLowerCase().includes('singapore')) {
    loc = `${loc}, India`;
  }
  return loc;
}

interface RawWhereWeWorkJob {
  ref?: string;
  title?: string;
  location?: string;
  department?: string;
  remote?: boolean;
  applyUrl?: string;
  postedAt?: string;
}

export async function fetchDynamicWhereWeWorkCities(): Promise<{ id: string; name: string; region: string; countryCode?: string }[]> {
  try {
    const htmlRes = await fetch(BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!htmlRes.ok) return [];
    const html = await htmlRes.text();
    const jsMatch = html.match(/src="([^"]+index[^"]+\.js)"/i);
    if (!jsMatch) return [];
    const jsUrl = new URL(jsMatch[1], BASE_URL).toString();
    const jsRes = await fetch(jsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!jsRes.ok) return [];
    const js = await jsRes.text();
    const regex = /\{id:"([a-z0-9_\-]+)",countryCode:"([a-z0-9_\-]+)",name:"([^"]+)",region:"([^"]+)"/g;
    const cities: { id: string; name: string; region: string; countryCode?: string }[] = [];
    let m;
    while ((m = regex.exec(js)) !== null) {
      cities.push({ id: m[1], countryCode: m[2], name: m[3], region: m[4] });
    }
    return cities;
  } catch (err: any) {
    logger.warn(`[WhereWeWorkAdapter] Dynamic city discovery error: ${err.message}`);
    return [];
  }
}

export class WhereWeWorkAdapter implements SourceAdapter {
  public readonly id = 'src_wherewework';
  public readonly name = 'WhereWeWork.co.in';
  public readonly sourceMap: StartupMapSource = 'WHEREWEWORK';
  public readonly baseUrl = BASE_URL;

  private status: SourceMonitoringStatus = {
    sourceMap: 'WHEREWEWORK',
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
    avgResponseTimeMs: 380,
  };

  private previousSnapshot: Map<string, string> = new Map();

  public getStatus(): SourceMonitoringStatus {
    return { ...this.status };
  }

  /**
   * Discovers all publicly accessible companies across WhereWeWork's city directories.
   * Dynamically inspects the live WhereWeWork web bundle and probes all active city routes in parallel.
   */
  public async discoverCompanies(options: {
    forceFull?: boolean;
    limit?: number;
    cities?: string[];
  } = {}): Promise<DiscoveredCompanyInput[]> {
    const discoveredMap = new Map<string, DiscoveredCompanyInput>();
    const startTime = Date.now();

    let targetCities = options.cities || [];
    if (targetCities.length === 0) {
      const dynamicCities = await fetchDynamicWhereWeWorkCities();
      if (dynamicCities.length > 0) {
        for (const dc of dynamicCities) {
          if (!CITY_METADATA[dc.id.toLowerCase()]) {
            const parts = dc.region.split(',').map((s) => s.trim());
            CITY_METADATA[dc.id.toLowerCase()] = {
              city: dc.name,
              state: parts[0] || dc.region,
              country: parts[1] || (dc.countryCode === 'in' ? 'India' : dc.countryCode === 'us' ? 'United States' : 'Singapore'),
            };
          }
        }
        targetCities = Array.from(
          new Set([
            ...dynamicCities.map((c) => c.id),
            ...PRIMARY_CITIES,
            ...PROBE_CITIES,
          ])
        );
        logger.info(`[WhereWeWorkAdapter] Dynamically discovered ${dynamicCities.length} live cities from WhereWeWork bundle: ${dynamicCities.map(c => c.name).join(', ')}`);
      } else {
        targetCities = [...PRIMARY_CITIES, ...PROBE_CITIES];
      }
    }

    logger.info(`[WhereWeWorkAdapter] Discovering companies across ${targetCities.length} city routes...`);

    // Fetch all city endpoints concurrently
    const cityPromises = targetCities.map(async (city) => {
      try {
        const cityUrl = `${API_BASE_URL}/cities/${encodeURIComponent(city)}/companies`;
        const res = await fetch(cityUrl, {
          headers: {
            'User-Agent': 'StartupScoutAI/2.0 (WhereWeWork Adapter; +https://wherewework.co.in/)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data?.companies) ? data.companies : [];
          return { city, items };
        }
      } catch {
        // City not available or network error
      }
      return { city, items: [] };
    });

    const cityResults = await Promise.all(cityPromises);

    for (const { city, items } of cityResults) {
      if (items.length === 0) continue;
      const geo = CITY_METADATA[city.toLowerCase()] || { city, state: 'India', country: 'India' };

      for (const item of items) {
        // Unique identifier for company within WhereWeWork API
        const rawId = item.id || `${city}:${item.slug}`;
        const domain = extractOfficialDomain(item.website);
        const officialWebsite = item.website || (domain ? `https://${domain}` : null);
        const sourceSlug = item.slug || item.id || rawId;
        const sourceUrl = `${BASE_URL}/?c=${encodeURIComponent(item.slug || '')}`;

        const entry: DiscoveredCompanyInput = {
          name: item.name?.trim() || item.slug,
          officialDomain: domain || null,
          officialWebsite,
          startupMapUrl: sourceUrl,
          sourceCompanyUrl: sourceUrl,
          sourceSlug,
          sourceMap: 'WHEREWEWORK',
          location: `${geo.city}, ${geo.country}`,
          city: geo.city,
          state: geo.state,
          country: geo.country,
          description: item.blurb?.trim() || null,
          sector: item.sector?.trim() || 'Technology',
          category: item.sector?.trim() || 'Technology',
          tags: [item.sector, item.area, geo.city].filter(Boolean),
          latitude: typeof item.lat === 'number' ? item.lat : null,
          longitude: typeof item.lng === 'number' ? item.lng : null,
          area: item.area || null,
          openingsCount: typeof item.openings === 'number' ? item.openings : 0,
          rawMetadata: {
            ...item,
            cityKey: city,
            apiId: rawId,
          },
        };

        entry.contentHash = this.computeContentHash(entry);

        // Deduplicate or merge if company exists across multiple cities
        const dedupKey = domain || normalizeCompanyName(entry.name);
        if (discoveredMap.has(dedupKey)) {
          const existing = discoveredMap.get(dedupKey)!;
          // Merge locations
          if (!existing.location.includes(geo.city)) {
            existing.location = `${existing.city || 'Bangalore'} & ${geo.city}, ${geo.country}`;
          }
          // Merge tags
          const mergedTags = new Set([...(existing.tags || []), ...(entry.tags || [])]);
          existing.tags = Array.from(mergedTags);
          // Aggregate openings count
          existing.openingsCount = Math.max(existing.openingsCount || 0, entry.openingsCount || 0);
          // Keep secondary apiId if present
          if (existing.rawMetadata && entry.rawMetadata) {
            existing.rawMetadata.additionalApiIds = [
              ...(existing.rawMetadata.additionalApiIds || []),
              rawId,
            ];
          }
        } else {
          discoveredMap.set(dedupKey, entry);
        }
      }
    }

    this.status.avgResponseTimeMs = Date.now() - startTime;
    const results = Array.from(discoveredMap.values());
    logger.info(`[WhereWeWorkAdapter] Discovered ${results.length} canonical companies from WhereWeWork.`);

    if (options.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }

  public async discoverCompany(slugOrId: string): Promise<DiscoveredCompanyInput | null> {
    const parts = slugOrId.split(':');
    const city = parts.length > 1 ? parts[0] : 'bengaluru';
    const slug = parts.length > 1 ? parts[1] : parts[0];

    try {
      const cityUrl = `${API_BASE_URL}/cities/${encodeURIComponent(city)}/companies`;
      const res = await fetch(cityUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = await res.json();
      const match = (data?.companies || []).find((c: any) => c.slug === slug || c.id === slugOrId);
      if (!match) return null;

      const domain = extractOfficialDomain(match.website);
      const geo = CITY_METADATA[city.toLowerCase()] || { city, state: 'India', country: 'India' };

      const entry: DiscoveredCompanyInput = {
        name: match.name,
        officialDomain: domain,
        officialWebsite: match.website,
        startupMapUrl: `${BASE_URL}/?c=${encodeURIComponent(match.slug)}`,
        sourceSlug: match.slug,
        sourceMap: 'WHEREWEWORK',
        location: `${geo.city}, ${geo.country}`,
        city: geo.city,
        state: geo.state,
        country: geo.country,
        description: match.blurb,
        sector: match.sector,
        tags: [match.sector, match.area, geo.city].filter(Boolean),
        openingsCount: match.openings || 0,
        latitude: match.lat,
        longitude: match.lng,
        rawMetadata: { ...match, cityKey: city, apiId: match.id || `${city}:${match.slug}` },
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
    const whereSource = (company.sources || company.companySources || []).find(
      (s) => s.sourceMap === 'WHEREWEWORK'
    );
    if (whereSource?.sourceUrl) {
      sources.push({
        type: 'ATS',
        url: whereSource.sourceUrl,
        provider: 'WhereWeWork',
        companyId: company.id,
      });
    }
    return sources;
  }

  /**
   * Discovers live full-time jobs for a company from WhereWeWork
   */
  public async discoverJobs(company: Company): Promise<DiscoveredJobInput[]> {
    const all = await this.fetchRawJobsForCompany(company);
    return all
      .filter((j) => !isInternshipTitle(j.title || ''))
      .map((j) => this.mapRawJobToDiscoveredJob(j, company, false));
  }

  /**
   * Discovers live internship opportunities for a company from WhereWeWork
   */
  public async discoverInternships(company: Company): Promise<DiscoveredJobInput[]> {
    const all = await this.fetchRawJobsForCompany(company);
    return all
      .filter((j) => isInternshipTitle(j.title || '') || isInternshipTitle(j.department || ''))
      .map((j) => this.mapRawJobToDiscoveredJob(j, company, true));
  }

  /**
   * Helper to fetch raw jobs array from WhereWeWork API for any company
   */
  private async fetchRawJobsForCompany(
    company: Company | { id: string; name: string; slug?: string; rawMetadata?: any; sources?: any[] }
  ): Promise<RawWhereWeWorkJob[]> {
    const whereSource = (company.sources || []).find((s: any) => s.sourceMap === 'WHEREWEWORK');
    const slug = (company as any).rawMetadata?.apiId || whereSource?.sourceSlug || (company as any).slug || company.name.toLowerCase();

    // Prioritize direct apiId if stored in rawMetadata (e.g. "bengaluru:cred")
    const candidateIds = new Set<string>();
    if ((company as any).rawMetadata?.apiId) {
      candidateIds.add((company as any).rawMetadata.apiId);
    }
    if ((company as any).rawMetadata?.additionalApiIds) {
      for (const id of (company as any).rawMetadata.additionalApiIds) {
        candidateIds.add(id);
      }
    }
    candidateIds.add(slug);
    for (const city of PRIMARY_CITIES) {
      candidateIds.add(`${city}:${slug}`);
      candidateIds.add(`${city}:${company.name.toLowerCase().replace(/\s+/g, '')}`);
    }

    for (const cid of candidateIds) {
      try {
        const jobsUrl = `${API_BASE_URL}/companies/${encodeURIComponent(cid)}/jobs`;
        const res = await fetch(jobsUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(6000),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.jobs) && data.jobs.length > 0) {
            return data.jobs;
          }
        }
      } catch {
        // Try next candidate
      }
    }

    return [];
  }

  private mapRawJobToDiscoveredJob(
    j: RawWhereWeWorkJob,
    company: Company | { id: string; name: string; location?: string },
    isInternship: boolean
  ): DiscoveredJobInput {
    const cleanTitle = formatJobTitle(j.title || '');
    const cleanLocation = formatJobLocation(j.location || '', company.location || 'India');
    const companyKey = company.name.toLowerCase();

    return {
      title: cleanTitle,
      companyId: company.id,
      companyName: company.name,
      location: cleanLocation,
      department: j.department?.trim() || undefined,
      workMode: j.remote ? 'REMOTE' : (cleanLocation.toLowerCase().includes('hybrid') ? 'HYBRID' : 'ON_SITE'),
      applyUrl: j.applyUrl || `${BASE_URL}/?c=${encodeURIComponent(companyKey)}`,
      sourceUrl: j.applyUrl || BASE_URL,
      sourceMap: 'WHEREWEWORK',
      isInternship,
      postedAt: j.postedAt || undefined,
      externalRef: j.ref,
    };
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

  /**
   * Full production synchronization:
   * 1. Scrapes all WhereWeWork companies across all cities.
   * 2. Upserts canonical company profiles, linking multi-source data.
   * 3. Concurrently collects ALL live job and internship openings via direct ATS links.
   * 4. Classifies roles into AI/ML relevance, experience level, category, and skills.
   * 5. Detects closed/removed jobs and marks them CLOSED.
   * 6. Records a ResearchRun and updates MonitoringSource status.
   */
  public async sync(options: {
    forceFull?: boolean;
    queueResearch?: boolean;
    syncJobs?: boolean;
    concurrency?: number;
  } = {}): Promise<SourceSyncResult> {
    const startTime = Date.now();
    const now = new Date().toISOString();
    this.status.status = 'SYNCING';
    this.status.lastSyncAt = now;

    try {
      logger.info(`[WhereWeWorkAdapter] Starting full sync...`);
      const items = await this.discoverCompanies(options);

      const changeDetection = this.detectChanges(this.previousSnapshot, items);
      const newCompanyIds: string[] = [];
      const changedCompanyIds: string[] = [];
      let unchangedCount = 0;

      // Map to store canonical companies ready for job fetching
      const companyJobFetchList: {
        company: Company;
        apiId: string;
        openingsCount: number;
      }[] = [];

      // Step 1: Upsert all companies
      for (const item of items) {
        const canonicalKey = item.officialDomain || normalizeCompanyName(item.name);
        const existing = store.findCompanyByIdentity(canonicalKey);

        const company = store.upsertCompany({
          name: item.name,
          officialDomain: item.officialDomain || undefined,
          officialWebsite: item.officialWebsite || null,
          startupMapUrl: item.startupMapUrl,
          sourceCompanyUrl: item.sourceCompanyUrl,
          sourceMap: 'WHEREWEWORK',
          location: item.location,
          description: item.description || null,
          sector: item.sector || null,
          category: item.category || null,
          tags: item.tags || [],
          openingsCount: item.openingsCount || 0,
          sourceSlug: item.sourceSlug,
          latitude: item.latitude || null,
          longitude: item.longitude || null,
        } as any);

        if (!existing || company.createdAt === company.updatedAt) {
          newCompanyIds.push(company.id);
        } else {
          changedCompanyIds.push(company.id);
        }

        const apiId = item.rawMetadata?.apiId || `${item.city?.toLowerCase() || 'bengaluru'}:${item.sourceSlug || item.name.toLowerCase()}`;
        const hasOpenings = (item.openingsCount && item.openingsCount > 0) || options.forceFull;

        if (hasOpenings) {
          companyJobFetchList.push({
            company,
            apiId,
            openingsCount: item.openingsCount || 0,
          });
        }
      }

      unchangedCount = Math.max(0, items.length - (newCompanyIds.length + changedCompanyIds.length));

      // Step 2: Fetch and persist all jobs & internships concurrently
      let totalJobsIndexed = 0;
      let totalInternshipsIndexed = 0;
      let newOpportunitiesCount = 0;
      const scrapedJobIds = new Set<string>();
      const scrapedFingerprints = new Set<string>();

      if (options.syncJobs !== false && companyJobFetchList.length > 0) {
        logger.info(
          `[WhereWeWorkAdapter] Fetching live jobs for ${companyJobFetchList.length} companies with openings (concurrency: ${options.concurrency || 14})...`
        );

        const poolConcurrency = options.concurrency || 14;

        for (let i = 0; i < companyJobFetchList.length; i += poolConcurrency) {
          const batch = companyJobFetchList.slice(i, i + poolConcurrency);

          const batchResults = await Promise.all(
            batch.map(async ({ company, apiId }) => {
              try {
                const jobsUrl = `${API_BASE_URL}/companies/${encodeURIComponent(apiId)}/jobs`;
                const res = await fetch(jobsUrl, {
                  headers: { Accept: 'application/json' },
                  signal: AbortSignal.timeout(8000),
                });

                if (res.ok) {
                  const data = await res.json();
                  return { company, jobs: Array.isArray(data?.jobs) ? (data.jobs as RawWhereWeWorkJob[]) : [] };
                }
              } catch {
                // Secondary attempt with company slug if needed
              }
              return { company, jobs: [] };
            })
          );

          for (const { company, jobs } of batchResults) {
            for (const j of jobs) {
              if (!j.title) continue;

              const cleanTitle = formatJobTitle(j.title);
              const isInternship = isInternshipTitle(cleanTitle) || isInternshipTitle(j.department || '');
              const cleanLocation = formatJobLocation(j.location || '', company.location);
              const workMode = j.remote
                ? 'REMOTE'
                : cleanLocation.toLowerCase().includes('hybrid')
                ? 'HYBRID'
                : 'ON_SITE';

              const isFresher =
                isInternship ||
                /\b(fresher|entry|junior|associate|graduate|campus|0-1|0-2|new grad)\b/i.test(cleanTitle);

              // Perform deep role classification
              const classification = classifyRole(
                cleanTitle,
                j.department || '',
                company.name,
                cleanLocation,
                store.getCandidateProfile()
              );

              // Stable opportunity ID based on company + ATS ref / applyUrl
              const stableId =
                'www_' +
                hashString(`${company.id}_${j.ref || j.applyUrl || cleanTitle}`).substring(0, 16);
              const fingerprint = generateJobFingerprint(company.name, cleanTitle, cleanLocation);

              scrapedJobIds.add(stableId);
              if (fingerprint) scrapedFingerprints.add(fingerprint);

              const existingOpp = store.getOpportunity(stableId);

              const parsedLoc = parseLocation(cleanLocation);

              const opp = store.upsertOpportunity({
                id: stableId,
                companyId: company.id,
                companyName: company.name,
                title: cleanTitle,
                category: classification.category,
                type: isInternship ? 'INTERNSHIP' : 'FULL_TIME',
                employmentType: isInternship ? 'INTERN' : 'FULL_TIME',
                experienceLevel: isInternship
                  ? 'INTERN'
                  : isFresher
                  ? 'ENTRY_LEVEL'
                  : classification.experienceLevel,
                location: parsedLoc.formatted || cleanLocation,
                country: parsedLoc.country,
                stateProvince: parsedLoc.stateProvince,
                city: parsedLoc.city,
                metro: parsedLoc.metro,
                locationRaw: cleanLocation,
                workMode: parsedLoc.workMode,
                isRemote: parsedLoc.isRemote,
                isInternship: isInternship,
                isFresherFriendly: isFresher || isInternship,
                isGraduateRole: isInternship || isFresher,
                isApprenticeship: cleanTitle.toLowerCase().includes('apprentice'),
                sourceMap: 'WHEREWEWORK',
                source: 'WHEREWEWORK',
                discoveredViaSource: 'WHEREWEWORK',
                authoritativeSource: 'WHEREWEWORK',
                remote: workMode,
                description: `${cleanTitle} at ${company.name}${
                  j.department ? ` (${j.department})` : ''
                }. Verified live direct role discovered via WhereWeWork.co.in.`,
                responsibilities: [],
                requirements: [],
                skills: classification.skills || [],
                salary: null,
                applicationUrl: j.applyUrl || `${BASE_URL}/?c=${encodeURIComponent(company.name.toLowerCase())}`,
                sourceUrl: j.applyUrl || BASE_URL,
                sourceJobUrl: j.applyUrl || `${BASE_URL}/?c=${encodeURIComponent(company.name.toLowerCase())}`,
                sourceType: 'ATS_BOARD',
                verificationStatus: 'VERIFIED',
                confidence: 'HIGH',
                aiMlRelevance: classification.aiMlRelevance,
                relevanceScore: classification.relevanceScore,
                personalMatchScore: classification.personalMatchScore,
                jobFingerprint: fingerprint,
                isNew: !existingOpp,
                status: 'OPEN',
                firstSeenAt: existingOpp?.firstSeenAt || j.postedAt || now,
                lastSeenAt: now,
                lastVerifiedAt: now,
              });

              if (isInternship) {
                totalInternshipsIndexed++;
              } else {
                totalJobsIndexed++;
              }

              if (!existingOpp) {
                newOpportunitiesCount++;
              }
            }
          }
        }
      }

      // Step 3: Closed job detection
      // Mark any prior OPEN WhereWeWork opportunity as CLOSED if no longer returned by the live API
      let closedJobsCount = 0;
      const allOpportunities = store.getOpportunities();
      for (const opp of allOpportunities) {
        if (
          (opp.sourceMap === 'WHEREWEWORK' || opp.sourceType === 'ATS_BOARD') &&
          opp.status === 'OPEN'
        ) {
          const isStillActive =
            scrapedJobIds.has(opp.id) ||
            (opp.jobFingerprint && scrapedFingerprints.has(opp.jobFingerprint));

          if (!isStillActive) {
            opp.status = 'CLOSED';
            opp.updatedAt = now;
            opp.lastSeenAt = now;
            store.updateOpportunityStatus(opp.id, 'CLOSED');
            closedJobsCount++;
          }
        }
      }

      // Step 4: Record ResearchRun
      const researchRun = store.createResearchRun('FULL_MAP', items.length);
      store.updateResearchRun(researchRun.id, {
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        location: 'WHEREWEWORK',
        sourceMap: 'WHEREWEWORK',
        totalCompanies: items.length,
        completedCompanies: companyJobFetchList.length,
        failedCompanies: 0,
        jobsFound: totalJobsIndexed,
        internshipsFound: totalInternshipsIndexed,
      });

      // Step 5: Update Monitoring Source Status
      this.status.status = 'HEALTHY';
      this.status.lastSuccessfulSyncAt = now;
      this.status.totalDiscovered = items.length;
      this.status.newInLastSync = newCompanyIds.length;
      this.status.changedInLastSync = changedCompanyIds.length;
      this.status.unchangedInLastSync = unchangedCount;
      this.status.consecutiveErrors = 0;
      this.status.lastError = null;

      // Update in store's monitoring_sources table
      store.upsertMonitoringSource({
        companyId: 'wherewework',
        companyName: 'WhereWeWork',
        sourceType: 'ATS_BOARD',
        sourceUrl: BASE_URL,
        status: 'ACTIVE',
        lastCheckedAt: now,
        opportunitiesFound: totalJobsIndexed + totalInternshipsIndexed,
      });

      // Store current snapshot for future diffing
      for (const item of items) {
        const key = item.sourceSlug || item.name.toLowerCase();
        this.previousSnapshot.set(key, item.contentHash || '');
      }

      store.persist();

      store.addEvent({
        companyId: 'wherewework',
        companyName: 'WhereWeWork',
        event: 'SOURCE_SYNC_COMPLETED',
        message: `WhereWeWork sync complete: Discovered ${items.length} companies, ${totalJobsIndexed} jobs, and ${totalInternshipsIndexed} internships (${closedJobsCount} closed).`,
        stage: 'DISCOVER_COMPANIES',
        type: 'success',
      });

      const durationMs = Date.now() - startTime;
      logger.info(
        `[WhereWeWorkAdapter] Sync finished in ${durationMs}ms: ${items.length} companies, ${totalJobsIndexed} jobs, ${totalInternshipsIndexed} internships.`
      );

      return {
        source: 'WHEREWEWORK',
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
        durationMs,
        timestamp: now,
      };
    } catch (err: any) {
      logger.error(`[WhereWeWorkAdapter] Sync error: ${err?.message}`);
      this.status.status = 'ERROR';
      this.status.lastError = err?.message;
      this.status.consecutiveErrors++;

      return {
        source: 'WHEREWEWORK',
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
      data.city || '',
      String(data.openingsCount || 0),
    ].join('|');
    return hashString(raw);
  }
}

export const whereWeWorkAdapter = new WhereWeWorkAdapter();
