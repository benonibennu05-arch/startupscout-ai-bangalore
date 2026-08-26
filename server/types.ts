export type OpportunityType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'INTERNSHIP'
  | 'CONTRACT'
  | 'APPRENTICESHIP'
  | 'TRAINEE'
  | 'GRADUATE'
  | 'OTHER';

export type ExperienceLevel =
  | 'INTERN'
  | 'FRESHER'
  | 'ENTRY_LEVEL'
  | 'JUNIOR'
  | 'MID'
  | 'SENIOR'
  | 'LEAD'
  | 'EXECUTIVE'
  | 'UNKNOWN';

export type RemotePolicy = 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN';

export type SourceType =
  | 'OFFICIAL_CAREERS'
  | 'ATS_BOARD'
  | 'STARTUP_MAP'
  | 'COMPANY_WEBSITE'
  | 'THIRD_PARTY'
  | 'EXTERNAL_BOARD';

export type VerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'CLOSED'
  | 'UNKNOWN';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type OpportunityStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export type CompanyStatus =
  | 'PENDING'
  | 'DISCOVERING'
  | 'RESEARCHING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING';

export type EmailType =
  | 'RECRUITING'
  | 'HR'
  | 'CAREERS'
  | 'TALENT'
  | 'HIRING'
  | 'FOUNDER'
  | 'CAMPUS_HIRING'
  | 'GENERAL_CONTACT'
  | 'UNKNOWN';

export type ResearchStage =
  | 'DISCOVER_COMPANIES'
  | 'RESEARCH_COMPANY'
  | 'FIND_WEBSITE'
  | 'FIND_CAREERS'
  | 'DISCOVER_JOBS'
  | 'VERIFY_JOBS'
  | 'DISCOVER_EMAILS'
  | 'CALCULATE_RELEVANCE'
  | 'SAVE_RESULTS'
  | 'COMPLETE';

export interface Company {
  id: string;
  name: string;
  startupMapUrl: string;
  officialWebsite: string | null;
  websiteVerified: boolean;
  websiteSourceUrl: string | null;
  description: string | null;
  sector: string | null;
  category: string | null;
  tags: string[];
  location: string | null;
  foundedYear: number | null;
  startupStage: string | null;
  teamSize: string | null;
  linkedinUrl: string | null;
  careersUrl: string | null;
  jobBoardUrl: string | null;
  atsProvider?: string | null;
  status: CompanyStatus;
  lastResearchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  type: OpportunityType;
  employmentType: string;
  experienceLevel: ExperienceLevel;
  location: string;
  remote: RemotePolicy;
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  salary: string | null;
  applicationUrl: string | null;
  sourceUrl: string;
  sourceType: SourceType;
  verificationStatus: VerificationStatus;
  confidence: ConfidenceLevel;
  relevanceScore: number; // 0 - 100
  status: OpportunityStatus;
  discoveredAt: string;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityFilter {
  companyId?: string;
  type?: OpportunityType;
  experienceLevel?: ExperienceLevel;
  remote?: RemotePolicy;
  status?: OpportunityStatus;
  verificationStatus?: VerificationStatus;
  minRelevance?: number;
  isFresherFriendly?: boolean;
  search?: string;
}

export interface Contact {
  id: string;
  companyId: string;
  companyName: string;
  name?: string | null; // Named recruiter, talent partner, founder or null if generic inbox
  role?: string | null; // e.g. "Talent Acquisition Manager", "Founder & CEO"
  email: string; // Publicly displayed email, or "NOT PUBLICLY AVAILABLE" if only person name/role was found
  emailType: EmailType;
  profileUrl?: string | null; // LinkedIn or bio URL
  sourceUrl: string;
  verified: boolean;
  discoveredAt: string;
}

export type ResearchMode = 'FAST' | 'BALANCED' | 'DEEP';

export interface ActiveWorkerInfo {
  workerId: number;
  companyId: string;
  companyName: string;
  stage: ResearchStage;
  startedAt: string;
}

export interface ResearchMetrics {
  companiesPerMinute: number;
  estimatedRemainingMinutes: number | null;
  avgCompanyDurationMs: number;
  geminiCallsCount: number;
  timeoutsCount: number;
  rateLimitedCount: number;
  activeWorkersCount: number;
  concurrency: number;
  mode: ResearchMode;
  elapsedSeconds: number;
}

export interface ResearchRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'FAILED';
  totalCompanies: number;
  completedCompanies: number;
  failedCompanies: number;
  jobsFound: number;
  internshipsFound: number;
  emailsFound: number;
  batchType: 'TEST_10' | 'FULL_MAP' | 'CUSTOM_SELECTION' | 'RETRY_FAILED' | 'RECHECK';
  mode?: ResearchMode;
  concurrency?: number;
}

export interface ResearchError {
  id: string;
  companyId: string;
  companyName: string;
  stage: ResearchStage;
  error: string;
  attempt: number;
  timestamp: string;
  resolved: boolean;
}

export interface ResearchEvent {
  id: string;
  companyId: string;
  companyName: string;
  event: string;
  message: string;
  timestamp: string;
  stage?: ResearchStage;
  type?: 'info' | 'success' | 'warning' | 'error';
}

export interface UserSettings {
  targetRoles: string[];
  targetSkills: string[];
  preferredLocations: string[];
  preferredOpportunityTypes: OpportunityType[];
  maxExperienceYears: number;
  includeKeywords: string[];
  excludeKeywords: string[];
  minRelevanceScore: number;
  remotePreference: 'ANY' | 'REMOTE_ONLY' | 'HYBRID_OR_REMOTE' | 'ON_SITE';
  crawlerConcurrency: number;
  requestDelayMs: number;
  requestTimeoutMs: number;
  maxRetryAttempts: number;
  geminiModel: string;
  geminiTemperature: number;
}
