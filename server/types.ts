export type OpportunityType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'INTERNSHIP'
  | 'CONTRACT'
  | 'APPRENTICESHIP'
  | 'TRAINEE'
  | 'GRADUATE'
  | 'OTHER';

export type OpportunityCategory =
  | 'AI / ML'
  | 'Software Engineering'
  | 'Backend'
  | 'Frontend'
  | 'Full Stack'
  | 'Mobile'
  | 'Data Science'
  | 'Data Analytics'
  | 'Data Engineering'
  | 'DevOps'
  | 'Cloud'
  | 'Cybersecurity'
  | 'QA / Testing'
  | 'Product'
  | 'Product Management'
  | 'Design'
  | 'UI/UX'
  | 'Marketing'
  | 'Sales'
  | 'Business Development'
  | 'Operations'
  | 'Finance'
  | 'HR'
  | 'Recruiting'
  | 'Customer Success'
  | 'Content'
  | 'Research'
  | 'Legal'
  | 'Other'
  | 'UNKNOWN';

export type AiMlRelevance = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

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

export interface CandidateProfile {
  name: string;
  portfolio: string;
  linkedin: string;
  github: string;
  targetFocus: string;
  skills: string[];
  education: string;
  bio: string;
  resumeFileName: string | null;
  resumeUploadedAt: string | null;
  resumeContentText?: string | null;
}

export interface OpenApplication {
  id: string;
  companyId: string;
  companyName: string;
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
  contentHash: string;
  lastCheckedAt: string;
  lastChangedAt: string;
  consecutiveUnchangedCount: number;
  status: 'ACTIVE' | 'ERROR';
}

export interface MonitoringRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  sourcesChecked: number;
  sourcesChanged: number;
  newJobsFound: number;
  newInternshipsFound: number;
  newContactsFound: number;
  errors: number;
  log: string[];
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'NEW_JOB' | 'NEW_INTERNSHIP' | 'NEW_CONTACT' | 'NEW_DRAFT' | 'INFO';
  link?: string;
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
  | 'PENDING'
  | 'DISCOVERING'
  | 'RESEARCHING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
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
  category: OpportunityCategory;
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
  aiMlRelevance: AiMlRelevance;
  relevanceScore: number; // 0 - 100
  personalMatchScore: number; // 0 - 100 candidate specific alignment
  jobFingerprint: string;
  isNew: boolean;
  status: OpportunityStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  lastVerifiedAt: string;
  isSaved?: boolean;
  userApplicationStatus?: 'NEW' | 'SAVED' | 'READY_TO_APPLY' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
  userNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityFilter {
  companyId?: string;
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
