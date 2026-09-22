import {
  Company,
  Opportunity,
  StartupMapSource,
  SourceSyncResult,
  SourceMonitoringStatus,
} from '../types.ts';

export interface DiscoveredCompanyInput {
  name: string;
  officialDomain?: string | null;
  officialWebsite?: string | null;
  startupMapUrl: string;
  sourceCompanyUrl?: string;
  sourceSlug?: string;
  sourceMap: StartupMapSource;
  location: string;
  city?: string;
  state?: string;
  country?: string;
  description?: string | null;
  sector?: string | null;
  category?: string | null;
  tags?: string[];
  foundedYear?: number | null;
  startupStage?: string | null;
  teamSize?: string | null;
  linkedinUrl?: string | null;
  careersUrl?: string | null;
  jobBoardUrl?: string | null;
  logoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  officeAddress?: string | null;
  area?: string | null;
  openingsCount?: number | null;
  contentHash?: string;
  rawMetadata?: Record<string, any>;
}

export interface DiscoveredJobInput {
  title: string;
  companyId: string;
  companyName: string;
  location: string;
  city?: string;
  country?: string;
  department?: string;
  workMode?: 'REMOTE' | 'HYBRID' | 'ON_SITE';
  type?: string;
  isInternship?: boolean;
  applyUrl: string;
  sourceUrl: string;
  sourceMap: StartupMapSource;
  description?: string;
  postedAt?: string;
  skills?: string[];
  externalRef?: string;
}

export interface CareerSourceLink {
  type: 'ATS' | 'OFFICIAL_CAREERS' | 'EXTERNAL_BOARD';
  url: string;
  provider?: string;
  companyId?: string;
}

export interface SourceChangeDetectionResult {
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  closedCount: number;
  newIds: string[];
  changedIds: string[];
  closedIds: string[];
}

export interface SourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly sourceMap: StartupMapSource;
  readonly baseUrl: string;

  getStatus(): SourceMonitoringStatus;

  /**
   * Discover all company profiles from this source
   */
  discoverCompanies(options?: {
    forceFull?: boolean;
    limit?: number;
  }): Promise<DiscoveredCompanyInput[]>;

  /**
   * Fetch a single company profile details by identifier
   */
  discoverCompany(slugOrId: string): Promise<DiscoveredCompanyInput | null>;

  /**
   * Discover official career links, ATS boards, or job listing pages
   */
  discoverCareerSources(company: Company): Promise<CareerSourceLink[]>;

  /**
   * Discover live full-time/contract jobs for a company
   */
  discoverJobs(company: Company): Promise<DiscoveredJobInput[]>;

  /**
   * Discover live internship/trainee roles for a company
   */
  discoverInternships(company: Company): Promise<DiscoveredJobInput[]>;

  /**
   * Compare previous snapshot with current data to identify changes
   */
  detectChanges(
    previousSnapshot: Map<string, string>,
    currentItems: DiscoveredCompanyInput[]
  ): SourceChangeDetectionResult;

  /**
   * Run sync and persist into store
   */
  sync(options?: {
    forceFull?: boolean;
    queueResearch?: boolean;
  }): Promise<SourceSyncResult>;
}
