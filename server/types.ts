export type OpportunityType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'INTERNSHIP'
  | 'CONTRACT'
  | 'APPRENTICESHIP'
  | 'TRAINEE'
  | 'GRADUATE'
  | 'OTHER';

export type OutreachType =
  | 'JOB_APPLICATION'
  | 'INTERNSHIP_APPLICATION'
  | 'OPEN_APPLICATION'
  | 'AI_ML_CAREER_INQUIRY'
  | 'GENERAL_CAREER_INQUIRY';

export type OutreachStatus =
  | 'DISCOVERED'
  | 'EMAIL_VERIFIED'
  | 'DRAFT_READY'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'SENT'
  | 'FAILED'
  | 'REPLIED'
  | 'FOLLOW_UP'
  | 'SKIPPED'
  | 'COOLDOWN';

export type CompanyOutreachState =
  | 'HIRING_NOW'
  | 'OPEN_APPLICATION'
  | 'NO_CURRENT_ROLE_PUBLIC_EMAIL'
  | 'NO_PUBLIC_EMAIL'
  | 'CONTACTED'
  | 'COOLDOWN'
  | 'DO_NOT_CONTACT'
  | 'FAILED';

export type AutomationMode = 'MANUAL' | 'REVIEW_BEFORE_SEND' | 'AUTO_SEND';

export interface OutreachSettings {
  automationMode: AutomationMode;
  dailySendLimit: number; // 5, 10, 20, 30, 50 (default 20)
  cooldownDays: number; // 7, 14, 30, 60 (default 30)
  minMatchScore: number; // default 60
  sendDelaySeconds: number; // default 45 (range 30-90)
  autoSendOnlyVerified: boolean;
  gmailConnected: boolean;
  gmailAccountEmail: string | null;
  gmailAccessToken?: string | null;
  gmailRefreshToken?: string | null;
  gmailTokenExpiry?: number | null;
  lastOAuthError?: string | null;
  doNotContactCompanyIds: string[];
}

export interface GoogleOAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  scope?: string;
  tokenType?: string;
  idToken?: string;
  email: string;
  name?: string;
  picture?: string;
  connectedAt: string;
  updatedAt: string;
}

export interface EmailStatusResponse {
  connected: boolean;
  email: string | null;
  provider: 'gmail';
  canSend: boolean;
  isExpectedAccount: boolean;
  expectedEmail: string;
  dailyLimit: number;
  sentToday: number;
  remainingToday: number;
  hasResume: boolean;
  resumeFileName: string | null;
  automationMode: AutomationMode;
  cooldownDays: number;
  error?: string | null;
  googleAuthConfigured?: boolean;
}

export type StartupMapSource =
  | 'BANGALORE_STARTUP_MAP'
  | 'HYDERABAD_STARTUP_MAP'
  | 'BANGALORE'
  | 'HYDERABAD'
  | 'BOTH';
export type LocationScope = 'BANGALORE' | 'HYDERABAD' | 'BOTH';

export interface CompanySource {
  id: string;
  companyId: string;
  sourceMap: StartupMapSource;
  sourceUrl: string;
  sourceCompanyUrl?: string;
  discoveredAt: string;
}

export interface SourceMapStats {
  sourceName: string;
  sourceUrl: string;
  rawDiscovered: number;
  uniqueCompanies: number;
  stored: number;
  researched: number;
  processing: number;
  queued: number;
  pending: number;
  failed: number;
  skipped: number;
  status: 'READY' | 'RUNNING' | 'COMPLETE';
}

export interface DualSourceStats {
  bangalore: SourceMapStats;
  hyderabad: SourceMapStats;
  duplicatesAcrossMaps: number;
  combinedRawRecords: number;
  combinedUniqueCompanies: number;
  totalStoredCompanies: number;
  totalResearchable: number;
  researchedTotal: number;
  pendingTotal: number;
  failedTotal: number;
  isConsistent: boolean;
  discrepancies: {
    bangaloreMissing: number;
    hyderabadMissing: number;
    combinedMissing: number;
  };
}

export interface ResearchStatsBreakdown {
  scope: LocationScope;
  total: number;
  completed: number;
  processing: number;
  queued: number;
  failed: number;
  skipped: number;
  pending: number;
}

export interface DashboardCompanyStats {
  bangalore: SourceMapStats;
  hyderabad: SourceMapStats;
  combined: {
    sourceRecords: number;
    uniqueCompanies: number;
    duplicates: number;
    stored: number;
    researched: number;
    processing: number;
    queued: number;
    pending: number;
    failed: number;
    skipped: number;
    status: 'READY' | 'RUNNING' | 'COMPLETE';
  };
  research: {
    BANGALORE: ResearchStatsBreakdown;
    HYDERABAD: ResearchStatsBreakdown;
    BOTH: ResearchStatsBreakdown;
  };
  consistency: {
    bangaloreSource: number;
    bangaloreDatabase: number;
    bangaloreDiff: number;
    hyderabadSource: number;
    hyderabadDatabase: number;
    hyderabadDiff: number;
    combinedSource: number;
    combinedDatabase: number;
    duplicates: number;
    queueCount: number;
    researchCount: number;
    isConsistent: boolean;
    syncRequired: boolean;
  };
}

export interface OutreachRecord {
  id: string;
  companyId: string;
  companyName: string;
  location?: string;
  opportunityId?: string | null;
  openApplicationId?: string | null;
  outreachType: OutreachType;
  roleTitle?: string;
  recipientEmail: string;
  recipientName?: string | null;
  recipientRole?: string | null;
  emailType?: EmailType;
  emailSourceUrl: string;
  emailSourceText?: string;
  emailVerificationStatus: EmailVerificationStatus;
  exactMatch?: boolean;
  subject: string;
  body: string;
  resumeFile: string;
  resumeFileId?: string | null;
  portfolioUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  status: OutreachStatus;
  matchScore: number;
  matchReason?: string;
  sourceUrl: string;
  sourceEvidence?: string;
  createdAt: string;
  approvedAt?: string | null;
  scheduledAt?: string | null;
  sentAt?: string | null;
  failedAt?: string | null;
  lastContactAt?: string | null;
  nextEligibleAt?: string | null;
  lastError?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  provider?: string | null;
  senderEmail?: string | null;
  providerMessageId?: string | null;
  replyDetectedAt?: string | null;
  threadId?: string | null;
  notes?: string | null;
  updatedAt: string;
}

export interface OutreachStats {
  companiesResearched: number;
  publicEmailsFound: number;
  verifiedEmails: number;
  openApplicationOpportunities: number;
  aiMlOpportunities: number;
  draftsReady: number;
  scheduled: number;
  sentToday: number;
  totalSent: number;
  failed: number;
  replies: number;
  followUpPending: number;
  inCooldown: number;
  dailyLimitRemaining: number;
  dailyLimit: number;
}

export type OpportunityCategory =
  | 'AI / ML'
  | 'AI_ML'
  | 'Software Engineering'
  | 'SOFTWARE'
  | 'Backend'
  | 'BACKEND'
  | 'Frontend'
  | 'FRONTEND'
  | 'Full Stack'
  | 'FULL_STACK'
  | 'Mobile'
  | 'MOBILE'
  | 'Data Science'
  | 'DATA'
  | 'Data Analytics'
  | 'Data Engineering'
  | 'DevOps'
  | 'DEVOPS_CLOUD'
  | 'Cloud'
  | 'Cybersecurity'
  | 'QA / Testing'
  | 'QA'
  | 'Product'
  | 'PRODUCT'
  | 'Product Management'
  | 'Design'
  | 'DESIGN'
  | 'UI/UX'
  | 'Marketing'
  | 'MARKETING'
  | 'Sales'
  | 'SALES'
  | 'Business Development'
  | 'Operations'
  | 'OPERATIONS'
  | 'Finance'
  | 'FINANCE'
  | 'HR'
  | 'Recruiting'
  | 'Customer Success'
  | 'Content'
  | 'Research'
  | 'Legal'
  | 'Other'
  | 'OTHER'
  | 'UNKNOWN';

export type AiMlRelevance = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'CORE_AI_ML' | 'AI_APPLIED' | 'AI_ADJACENT' | 'NOT_AI';

export type ExperienceLevel =
  | 'INTERN'
  | 'FRESHER'
  | 'ENTRY_LEVEL'
  | 'JUNIOR'
  | 'MID'
  | 'SENIOR'
  | 'LEAD'
  | 'MANAGER'
  | 'DIRECTOR'
  | 'EXECUTIVE'
  | 'UNKNOWN';

export type RemotePolicy = 'REMOTE' | 'HYBRID' | 'ON_SITE' | 'UNKNOWN';

export type OpenApplicationStatus = 'OPEN' | 'ARCHIVED' | 'CONTACTED';

export type ApplicationType =
  | 'CURRENT_JOB'
  | 'CURRENT_INTERNSHIP'
  | 'OPEN_APPLICATION'
  | 'GENERAL_AI_ML_INQUIRY'
  | 'CURRENT_ROLE';

export type ApplicationStatus =
  | 'DRAFT'
  | 'READY_TO_SEND'
  | 'READY_TO_REVIEW'
  | 'APPROVED'
  | 'SENT'
  | 'FAILED'
  | 'REPLIED'
  | 'FOLLOW_UP'
  | 'REJECTED'
  | 'CLOSED';

export type EmailProviderType = 'SIMULATED_TEST_PROVIDER' | 'SMTP' | 'GMAIL' | 'RESEND';

export interface EmailProviderConfig {
  provider: EmailProviderType;
  senderName: string;
  senderEmail: string;
  dailySendLimit: number; // 5, 10, 20, 30, 50 (default 20)
  openAppCooldownDays: number; // default 30 days
  safetyDelayMs: number; // default 1500ms
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpSecure?: boolean;
  resendApiKey?: string;
  gmailAccessToken?: string;
}

export interface ResumeFile {
  fileId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  uploadedAt: string;
  version: number;
  isCurrent: boolean;
  extractedText?: string;
  extractedSkills?: string[];
  extractedProjects?: string[];
  extractedExperience?: string;
}

export interface CandidateProfile {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  portfolio: string;
  linkedin: string;
  github: string;
  targetFocus: string;
  skills: string[];
  education: string;
  bio: string;
  resumeFileId: string | null;
  resumeFileName: string | null;
  resumeMimeType?: string | null;
  resumeSize?: number | null;
  resumeStoragePath?: string | null;
  resumeUploadedAt: string | null;
  resumeUpdatedAt?: string | null;
  resumeContentText?: string | null;
  resumeSkills?: string[];
  resumeProjects?: string[];
  resumeExperience?: string;
  resumeHistory?: ResumeFile[];
}

export interface OpenApplication {
  id: string;
  companyId: string;
  companyName: string;
  location?: string;
  sourceMap?: StartupMapSource;
  sourceUrl: string;
  sourceText: string;
  evidence: string;
  contactEmail?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  verificationStatus: EmailVerificationStatus;
  relevanceScore: number; // 0 - 100
  status: OpenApplicationStatus;
  hasVerifiedEmail: boolean;
  discoveredAt: string;
  updatedAt: string;
}

export interface Application {
  id: string;
  companyId: string;
  companyName: string;
  location?: string;
  sourceMap?: StartupMapSource;
  opportunityId?: string | null;
  openApplicationId?: string | null;
  applicationType: ApplicationType;
  roleTitle: string;
  recipientEmail: string;
  recipientName?: string | null;
  recipientRole?: string | null;
  subject: string;
  body: string;
  resumeFile: string;
  resumeFileId?: string | null;
  sourceUrl: string;
  sourceEvidence?: string | null;
  status: ApplicationStatus;
  matchScore: number;
  matchReason?: string;
  createdAt: string;
  approvedAt?: string | null;
  sentAt?: string | null;
  providerMessageId?: string | null;
  error?: string | null;
  followUpAt?: string | null;
  notes?: string | null;
  updatedAt: string;
}

export interface SentEmailRecord {
  id: string;
  applicationId: string;
  companyId: string;
  companyName: string;
  opportunityId?: string | null;
  openApplicationId?: string | null;
  applicationType: ApplicationType;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  body: string;
  attachmentName: string;
  sourceUrl: string;
  sentAt: string;
  status: 'DELIVERED' | 'BOUNCED' | 'FAILED' | 'REPLIED';
  providerMessageId: string;
  followUpReminderDate?: string | null;
  followUpStatus?: 'PENDING' | 'DONE' | 'CANCELLED';
}

export interface MonitoringSource {
  id: string;
  companyId: string;
  companyName: string;
  sourceUrl: string;
  sourceType: string;
  contentHash?: string;
  lastCheckedAt: string;
  lastChangedAt?: string;
  consecutiveUnchangedCount?: number;
  status: 'ACTIVE' | 'ERROR';
}

export interface MonitoringRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status?: string;
  sourcesChecked: number;
  sourcesChanged?: number;
  newOpportunitiesFound?: number;
  newJobsFound?: number;
  newInternshipsFound?: number;
  newContactsFound?: number;
  contactsUpdated?: number;
  errors?: number;
  log?: string[];
  summary?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'NEW_JOB' | 'NEW_INTERNSHIP' | 'NEW_CONTACT' | 'NEW_DRAFT' | 'INFO' | 'NEW_JOB_DISCOVERED' | 'CONTACT_VERIFIED';
  link?: string;
  relatedCompanyId?: string;
  relatedOpportunityId?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
  read: boolean;
}

export interface SavedJobRecord {
  id: string;
  opportunityId: string;
  companyId: string;
  companyName: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
  status: 'SAVED' | 'READY_TO_APPLY' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
  savedAt: string;
  updatedAt: string;
}

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
  | 'DISCOVERED'
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'RESEARCHING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'
  | 'RETRYING';

export type EmailType =
  | 'CAREERS'
  | 'RECRUITING'
  | 'HR'
  | 'TALENT'
  | 'HIRING'
  | 'FOUNDER'
  | 'CAMPUS_HIRING'
  | 'GENERAL_COMPANY'
  | 'GENERAL_CONTACT'
  | 'UNKNOWN';

export type EmailSourceType =
  | 'OFFICIAL_CAREERS_PAGE'
  | 'OFFICIAL_CONTACT_PAGE'
  | 'OFFICIAL_JOB_POSTING'
  | 'OFFICIAL_TEAM_PAGE'
  | 'OFFICIAL_COMPANY_PAGE'
  | 'BANGALORE_STARTUP_MAP'
  | 'HYDERABAD_STARTUP_MAP'
  | 'PUBLIC_PROFESSIONAL_PROFILE'
  | 'PUBLIC_JOB_BOARD'
  | 'OTHER_PUBLIC_SOURCE'
  | 'MAILTO';

export type EmailVerificationStatus =
  | 'VERIFIED_PUBLIC'
  | 'PUBLIC_UNVERIFIED'
  | 'NEEDS_REVIEW'
  | 'SOURCE_REMOVED'
  | 'REJECTED'
  | 'NOT_FOUND';

export type ResearchStage =
  | 'DISCOVER_COMPANIES'
  | 'RESEARCH_COMPANY'
  | 'FIND_WEBSITE'
  | 'FIND_CAREERS'
  | 'DISCOVER_JOBS'
  | 'VERIFY_JOBS'
  | 'DISCOVER_EMAILS'
  | 'CALCULATE_RELEVANCE'
  | 'DRAFT_APPLICATION'
  | 'SEND_APPLICATION'
  | 'SAVE_RESULTS'
  | 'COMPLETE';

export interface Company {
  id: string;
  canonicalCompanyId?: string;
  name: string;
  canonicalName?: string;
  normalizedName?: string;
  officialDomain?: string;
  location: string;
  locations?: string[];
  sourceMap?: StartupMapSource;
  sourceUrl?: string;
  sourceMapUrl?: string;
  sourceCompanyUrl?: string;
  startupMapUrl: string;
  discoveredAt?: string;
  sources?: CompanySource[];
  companySources?: CompanySource[];
  officialWebsite: string | null;
  websiteVerified: boolean;
  websiteSourceUrl: string | null;
  description: string | null;
  sector: string | null;
  category: string | null;
  tags: string[];
  foundedYear: number | null;
  startupStage: string | null;
  teamSize: string | null;
  linkedinUrl: string | null;
  careersUrl: string | null;
  jobBoardUrl: string | null;
  atsProvider?: string | null;
  status: CompanyStatus;
  researchStatus?: CompanyStatus;
  lastResearchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  category?: OpportunityCategory;
  type: OpportunityType;
  employmentType: string;
  experienceLevel: ExperienceLevel;
  location: string;
  sourceMap?: StartupMapSource;
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
  aiMlRelevance?: AiMlRelevance;
  relevanceScore: number; // 0 - 100
  personalMatchScore?: number; // 0 - 100 candidate specific alignment
  jobFingerprint?: string;
  isNew?: boolean;
  status: OpportunityStatus;
  discoveredAt?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  lastVerifiedAt?: string;
  isSaved?: boolean;
  userApplicationStatus?: 'NEW' | 'SAVED' | 'READY_TO_APPLY' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
  userNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityFilter {
  companyId?: string;
  location?: LocationScope | string;
  category?: OpportunityCategory | 'ALL';
  type?: OpportunityType | 'ALL';
  experienceLevel?: ExperienceLevel | 'ALL';
  aiMlRelevance?: AiMlRelevance | 'ALL';
  remote?: RemotePolicy | 'ALL';
  status?: OpportunityStatus;
  verificationStatus?: VerificationStatus;
  minRelevance?: number;
  isFresherFriendly?: boolean;
  isInternship?: boolean;
  isNew?: boolean;
  isSaved?: boolean;
  userApplicationStatus?: string;
  search?: string;
}

export interface Contact {
  id: string;
  companyId: string;
  companyName: string;
  location?: string;
  sourceMap?: StartupMapSource;
  name?: string | null; // Named recruiter, talent partner, founder or null if generic inbox
  role?: string | null; // e.g. "Talent Acquisition Manager", "Founder & CEO"
  email: string; // Exact public email, or "NOT PUBLICLY AVAILABLE" if only person profile found
  emailType: EmailType;
  domain?: string | null;
  profileUrl?: string | null; // LinkedIn or bio URL
  sourceUrl: string;
  sourceTitle?: string | null;
  sourceType?: EmailSourceType;
  sourceText?: string; // Verifiable snippet / sentence where email or person was found
  evidenceFound?: string; // Exact snippet or mailto occurrence
  verificationStatus: EmailVerificationStatus;
  confidence?: number; // 0 to 100 quality score
  exactMatch?: boolean; // Must be true for verified email
  discoveredAt: string;
  lastVerifiedAt: string;
}

export interface ContactFilter {
  companyId?: string;
  location?: LocationScope | string;
  verificationStatus?: EmailVerificationStatus | 'ALL';
  emailType?: EmailType | 'ALL';
  search?: string;
  onlyWithEmail?: boolean;
}

export interface DashboardStats {
  totalCompanies: number;
  researchedCompanies: number;
  pendingCompanies: number;
  failedCompanies: number;
  totalOpportunities: number;
  totalJobs: number;
  totalInternships: number;
  openApplications: number;
  openApplicationsWithEmail: number;
  fresherRoles: number;
  aiMlRoles: number;
  aiMlInternships: number;
  softwareRoles: number;
  dataRoles: number;
  backendRoles: number;
  frontendRoles: number;
  productRoles: number;
  designRoles: number;
  marketingRoles: number;
  salesRoles: number;
  operationsRoles: number;
  financeRoles: number;
  hrRoles: number;
  otherRoles: number;
  verifiedOpportunities: number;
  publicEmails: number;
  verifiedPublicEmails: number;
  employeeContacts: number;
  careersEmails: number;
  talentEmails: number;
  recruitingEmails: number;
  hrEmails: number;
  unverifiedPublicEmails: number;
  removedEmails: number;
  rejectedEmails: number;
  unresolvedErrors: number;
  applicationsDraftCount: number;
  applicationsReadyCount: number;
  applicationsSentCount: number;
  todaySentCount: number;
  dailyLimitRemaining: number;
  savedJobsCount: number;
  appliedJobsCount: number;
  newJobsCount: number;
  // Location breakdowns
  bangaloreStats?: Partial<DashboardStats>;
  hyderabadStats?: Partial<DashboardStats>;
  totalCompaniesBangalore?: number;
  totalCompaniesHyderabad?: number;
  totalOpportunitiesBangalore?: number;
  totalOpportunitiesHyderabad?: number;
  totalContactsBangalore?: number;
  totalContactsHyderabad?: number;
  totalOutreachBangalore?: number;
  totalOutreachHyderabad?: number;
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
  location?: LocationScope;
  sourceMap?: StartupMapSource | 'BOTH';
  totalCompanies: number;
  completedCompanies: number;
  failedCompanies: number;
  jobsFound: number;
  internshipsFound: number;
  emailsFound: number;
  batchType: 'TEST_10' | 'FULL_MAP' | 'CUSTOM_SELECTION' | 'RETRY_FAILED' | 'RECHECK' | 'BANGALORE_MAP' | 'HYDERABAD_MAP' | 'BOTH_MAPS';
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
