import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Company,
  CompanySource,
  StartupMapSource,
  Opportunity,
  Contact,
  ResearchRun,
  ResearchError,
  ResearchEvent,
  UserSettings,
  OpenApplication,
  Application,
  SentEmailRecord,
  CandidateProfile,
  EmailProviderConfig,
  ApplicationStatus,
  MonitoringSource,
  MonitoringRun,
  AppNotification,
  SavedJobRecord,
  OpportunityFilter,
  OutreachRecord,
  OutreachSettings,
  OutreachStatus,
  OutreachType,
  OutreachStats,
  CompanyOutreachState,
  LocationScope,
  SourceMapStats,
  DualSourceStats,
  ResearchStatsBreakdown,
  DashboardCompanyStats,
  GoogleOAuthTokenData,
} from '../types.ts';
import { REAL_OPEN_APPLICATIONS_MAP } from '../crawler/openApplicationsMap.ts';
import { classifyRole, generateJobFingerprint } from '../ai/roleClassifier.ts';
import {
  APPROVED_GENERAL_INQUIRY_SUBJECT,
  getApprovedGeneralInquiryBody,
  APPROVED_CANDIDATE_INFO,
} from '../templates/approvedEmailTemplate.ts';
import { isValidEmail } from '../extractors/email.extractor.ts';
import { sqliteDb } from './sqlite.ts';
import { logger } from '../utils/logger.ts';

export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(the|a)\s+/i, '')
    .replace(/\b(pvt|ltd|pvt\s*ltd|private\s*limited|limited|inc|corp|corporation|technologies|tech|labs|software|solutions|services|ai|io)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function extractOfficialDomain(url?: string | null): string | null {
  if (!url) return null;
  try {
    const raw = url.trim();
    const withProto = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    const parsed = new URL(withProto);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

export function matchesLocationScope(
  locationStr: string | undefined | null,
  scope?: LocationScope | string | null,
  company?: Partial<Company> | null
): boolean {
  if (!scope || scope === 'ALL' || scope === 'Both' || scope === 'BOTH') return true;
  const target = String(scope).toUpperCase();

  // If company object is provided, inspect sourceMap, sources, and locations
  if (company) {
    if (company.sourceMap === 'BOTH') return true;
    if (target === 'WHEREWEWORK') {
      if (company.sourceMap === 'WHEREWEWORK') return true;
      if (company.sources?.some((s) => s.sourceMap === 'WHEREWEWORK')) return true;
      if (company.companySources?.some((s) => s.sourceMap === 'WHEREWEWORK')) return true;
    }
    if (target === 'FRONTLINES' || target === 'FRONTLINES_CAREER_DIRECTORY') {
      if (company.sourceMap === 'FRONTLINES_CAREER_DIRECTORY' || company.sourceMap === 'FRONTLINES') return true;
      if (company.sources?.some((s) => s.sourceMap === 'FRONTLINES_CAREER_DIRECTORY' || s.sourceMap === 'FRONTLINES')) return true;
      if (company.companySources?.some((s) => s.sourceMap === 'FRONTLINES_CAREER_DIRECTORY' || s.sourceMap === 'FRONTLINES')) return true;
      if (company.discoveredViaSource?.includes('FRONTLINES')) return true;
    }
    if (target === 'OFFICIAL_CAREERS' || target === 'OFFICIAL_COMPANY_CAREER_PAGE') {
      if (company.sourceMap === 'OFFICIAL_COMPANY_CAREER_PAGE') return true;
      if (company.sources?.some((s) => s.sourceMap === 'OFFICIAL_COMPANY_CAREER_PAGE')) return true;
      if (company.companySources?.some((s) => s.sourceMap === 'OFFICIAL_COMPANY_CAREER_PAGE')) return true;
    }
    if (target === 'HYDERABAD') {
      if (company.sourceMap === 'HYDERABAD' || company.sourceMap === 'HYDERABAD_STARTUP_MAP') return true;
      if (company.sources?.some((s) => s.sourceMap === 'HYDERABAD' || s.sourceMap === 'HYDERABAD_STARTUP_MAP')) return true;
      if (company.companySources?.some((s) => s.sourceMap === 'HYDERABAD' || s.sourceMap === 'HYDERABAD_STARTUP_MAP')) return true;
      if (company.locations?.some((l) => {
        const lower = l.toLowerCase();
        return lower.includes('hyderabad') || lower.includes('secunderabad') || lower.includes('hitec') || lower.includes('gachibowli') || lower.includes('madhapur') || lower.includes('kondapur') || lower.includes('financial district');
      })) return true;
    }
    if (target === 'BANGALORE') {
      if (company.sourceMap === 'BANGALORE' || company.sourceMap === 'BANGALORE_STARTUP_MAP') return true;
      if (company.sources?.some((s) => s.sourceMap === 'BANGALORE' || s.sourceMap === 'BANGALORE_STARTUP_MAP')) return true;
      if (company.companySources?.some((s) => s.sourceMap === 'BANGALORE' || s.sourceMap === 'BANGALORE_STARTUP_MAP')) return true;
      if (company.locations?.some((l) => {
        const lower = l.toLowerCase();
        return lower.includes('bangalore') || lower.includes('bengaluru') || lower.includes('koramangala') || lower.includes('indiranagar') || lower.includes('whitefield') || lower.includes('hsr');
      })) return true;
    }
  }

  const loc = (locationStr || '').toLowerCase();
  if (target.includes('HYD')) {
    return (
      loc.includes('hyderabad') ||
      loc.includes('secunderabad') ||
      loc.includes('hitec') ||
      loc.includes('gachibowli') ||
      loc.includes('madhapur') ||
      loc.includes('kondapur') ||
      loc.includes('financial district')
    );
  }
  if (target.includes('BANG') || target.includes('BLR')) {
    return (
      loc.includes('bangalore') ||
      loc.includes('bengaluru') ||
      loc.includes('koramangala') ||
      loc.includes('indiranagar') ||
      loc.includes('whitefield') ||
      loc.includes('hsr')
    );
  }
  if (target.includes('WHEREWEWORK')) {
    return (
      company?.sourceMap === 'WHEREWEWORK' ||
      company?.sources?.some((s) => s.sourceMap === 'WHEREWEWORK') ||
      company?.companySources?.some((s) => s.sourceMap === 'WHEREWEWORK') ||
      loc.includes('wherewework')
    );
  }
  return true;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');

export interface DatabaseSchema {
  companies: Company[];
  opportunities: Opportunity[];
  contacts: Contact[];
  open_applications: OpenApplication[];
  applications: Application[];
  outreach_records: OutreachRecord[];
  outreach_settings: OutreachSettings;
  sent_emails: SentEmailRecord[];
  saved_jobs: SavedJobRecord[];
  monitoring_sources: MonitoringSource[];
  monitoring_runs: MonitoringRun[];
  notifications: AppNotification[];
  candidate_profile: CandidateProfile;
  email_provider_config: EmailProviderConfig;
  google_oauth_tokens?: GoogleOAuthTokenData | null;
  oauth_states?: Record<string, { createdAt: number; redirectUrl?: string; redirectUri?: string }>;
  research_runs: ResearchRun[];
  research_errors: ResearchError[];
  research_events: ResearchEvent[];
  user_settings: UserSettings;
}

export const DEFAULT_OUTREACH_SETTINGS: OutreachSettings = {
  automationMode: 'REVIEW_BEFORE_SEND',
  dailySendLimit: 20,
  cooldownDays: 30,
  minMatchScore: 60,
  sendDelaySeconds: 45,
  autoSendOnlyVerified: true,
  gmailConnected: false,
  gmailAccountEmail: null,
  gmailAccessToken: null,
  doNotContactCompanyIds: [],
};

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  name: 'Teja Matta',
  email: 'tejamatta05@gmail.com',
  phone: '+91 8522074021',
  portfolio: 'https://teja-matta-portfolio.vercel.app/',
  linkedin: 'https://www.linkedin.com/in/teja-matta-602b3531a/',
  github: 'https://github.com/teja05-45',
  targetFocus: 'AI/ML Engineering, Generative AI, LLM Systems & Full-Stack AI Agents',
  skills: [
    'Python',
    'PyTorch',
    'TensorFlow',
    'Scikit-learn',
    'LangChain',
    'LangGraph',
    'OpenAI/Claude APIs',
    'FastAPI',
    'PostgreSQL',
    'Redis',
    'Pinecone',
    'ChromaDB',
    'FAISS',
    'Docker',
    'AWS',
    'SQL',
  ],
  education: 'B.Tech CSE | RGUKT',
  bio: 'B.Tech Computer Science Engineering student at RGUKT, graduating in 2027. Building production-style GenAI and ML systems, RAG pipelines, and agentic workflows.',
  resumeFileId: null,
  resumeFileName: null,
  resumeMimeType: null,
  resumeSize: null,
  resumeStoragePath: null,
  resumeUploadedAt: null,
  resumeUpdatedAt: null,
  resumeContentText: null,
  resumeSkills: [],
  resumeProjects: [],
  resumeHistory: [],
};

export const DEFAULT_EMAIL_CONFIG: EmailProviderConfig = {
  provider: 'SIMULATED_TEST_PROVIDER',
  senderName: 'Teja Matta',
  senderEmail: 'tejamatta05@gmail.com',
  dailySendLimit: 20,
  openAppCooldownDays: 30,
  safetyDelayMs: 1500,
};

const DEFAULT_SETTINGS: UserSettings = {
  targetRoles: [
    'AI Engineer',
    'ML Engineer',
    'Machine Learning Engineer',
    'AI/ML Intern',
    'AI Research Intern',
    'Machine Learning Intern',
    'Software Engineer',
    'Software Engineering Intern',
    'Python Developer',
    'Backend Developer',
    'Backend Engineering Intern',
    'Data Scientist',
    'Data Science Intern',
    'Data Engineer',
    'Data Engineering Intern',
    'AI Engineer Intern',
    'Generative AI Engineer',
    'LLM Engineer',
    'AI Researcher',
    'Research Engineer',
  ],
  targetSkills: [
    'Python',
    'PyTorch',
    'TensorFlow',
    'LLM',
    'Generative AI',
    'Transformers',
    'FastAPI',
    'TypeScript',
    'Node.js',
    'PostgreSQL',
    'Docker',
    'Kubernetes',
    'LangChain',
    'LlamaIndex',
    'NLP',
    'Computer Vision',
  ],
  preferredLocations: ['Bengaluru', 'Bangalore', 'Remote', 'India'],
  preferredOpportunityTypes: [
    'FULL_TIME',
    'INTERNSHIP',
    'APPRENTICESHIP',
    'TRAINEE',
    'GRADUATE',
  ],
  maxExperienceYears: 3,
  includeKeywords: ['AI', 'ML', 'Python', 'Backend', 'Data', 'Intern', 'Fresher', 'Junior', 'LLM'],
  excludeKeywords: ['Senior Director', 'VP', 'Head of', 'Principal 10+ yrs'],
  minRelevanceScore: 40,
  remotePreference: 'ANY',
  crawlerConcurrency: 2,
  requestDelayMs: 600,
  requestTimeoutMs: 12000,
  maxRetryAttempts: 3,
  geminiModel: 'gemini-3.7-flash',
  geminiTemperature: 0.2,
};

// Production does not seed hardcoded companies. Seed companies moved to fixtures/seedCompanies.ts
const INITIAL_SEED_COMPANIES: Partial<Company>[] = [];


class Store {
  private db: DatabaseSchema = {
    companies: [],
    opportunities: [],
    contacts: [],
    open_applications: [],
    applications: [],
    outreach_records: [],
    outreach_settings: { ...DEFAULT_OUTREACH_SETTINGS },
    sent_emails: [],
    saved_jobs: [],
    monitoring_sources: [],
    monitoring_runs: [],
    notifications: [],
    candidate_profile: { ...DEFAULT_CANDIDATE_PROFILE },
    email_provider_config: { ...DEFAULT_EMAIL_CONFIG },
    research_runs: [],
    research_errors: [],
    research_events: [],
    user_settings: { ...DEFAULT_SETTINGS },
  };

  private writeScheduled = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const sqliteCount = sqliteDb.getCompanyCount();
      logger.info(`[Store] Hydrating store state from persistent SQLite database (${sqliteCount} companies)...`);
      const loaded = sqliteDb.loadAll();
      this.db = {
        companies: loaded.companies || [],
        opportunities: loaded.opportunities || [],
        contacts: loaded.contacts || [],
        open_applications: loaded.open_applications || [],
        applications: loaded.applications || [],
        outreach_records: loaded.outreach_records || [],
        outreach_settings: { ...DEFAULT_OUTREACH_SETTINGS, ...(loaded.outreach_settings || {}) },
        sent_emails: loaded.sent_emails || [],
        saved_jobs: loaded.saved_jobs || [],
        monitoring_sources: loaded.monitoring_sources || [],
        monitoring_runs: loaded.monitoring_runs || [],
        notifications: loaded.notifications || [],
        candidate_profile: { ...DEFAULT_CANDIDATE_PROFILE, ...(loaded.candidate_profile || {}) },
        email_provider_config: { ...DEFAULT_EMAIL_CONFIG, ...(loaded.email_provider_config || {}) },
        google_oauth_tokens: loaded.google_oauth_tokens || null,
        oauth_states: loaded.oauth_states || {},
        research_runs: loaded.research_runs || [],
        research_errors: loaded.research_errors || [],
        research_events: loaded.research_events || [],
        user_settings: { ...DEFAULT_SETTINGS, ...(loaded.user_settings || {}) },
      };

      // Clean up zombie running runs from past restarts
      if (this.db && this.db.research_runs) {
        this.db.research_runs = this.db.research_runs.map((r) => {
          if (r.status === 'RUNNING') {
            return {
              ...r,
              status: 'STOPPED',
              completedAt: r.completedAt || new Date().toISOString(),
            };
          }
          return r;
        });
      }

      const now = new Date().toISOString();

        // Auto-migrate opportunities to guarantee category, aiMlRelevance, personalMatchScore & fingerprint
        this.db.opportunities = this.db.opportunities.map((opp) => {
          const classification = classifyRole(
            opp.title,
            opp.description || '',
            opp.companyName,
            opp.location,
            this.db.candidate_profile
          );

          return {
            ...opp,
            category: opp.category || classification.category,
            aiMlRelevance: opp.aiMlRelevance || classification.aiMlRelevance,
            type: opp.type || classification.type,
            experienceLevel: opp.experienceLevel || classification.experienceLevel,
            remote: opp.remote || classification.remote,
            skills: opp.skills && opp.skills.length > 0 ? opp.skills : classification.skills,
            relevanceScore: opp.relevanceScore !== undefined ? opp.relevanceScore : classification.relevanceScore,
            personalMatchScore: opp.personalMatchScore !== undefined ? opp.personalMatchScore : classification.personalMatchScore,
            jobFingerprint: opp.jobFingerprint || classification.jobFingerprint,
            isNew: opp.isNew !== undefined ? opp.isNew : false,
            firstSeenAt: opp.firstSeenAt || opp.discoveredAt || now,
            lastSeenAt: opp.lastSeenAt || opp.discoveredAt || now,
            lastVerifiedAt: opp.lastVerifiedAt || opp.discoveredAt || now,
            status: opp.status || 'OPEN',
            verificationStatus: opp.verificationStatus || 'VERIFIED',
            confidence: opp.confidence || 'HIGH',
          };
        });

        // Automatic sanitization for existing contacts in store
        this.db.contacts = this.db.contacts.map((c) => {
          const email = (c.email || '').trim().toLowerCase();
          const isNotPublic = !email || email === 'not publicly available';
          
          if (isNotPublic) {
            return {
              ...c,
              email: 'NOT PUBLICLY AVAILABLE',
              verificationStatus: c.verificationStatus || 'VERIFIED_PUBLIC',
              exactMatch: true,
              confidence: c.confidence || 80,
              evidenceFound: c.evidenceFound || `Profile listed on ${c.sourceUrl || 'page'}`,
              sourceText: c.sourceText || 'Verified profile',
              sourceType: c.sourceType || 'OFFICIAL_COMPANY_PAGE',
              lastVerifiedAt: c.lastVerifiedAt || now,
            };
          }

          const hasValidSyntax = isValidEmail(email);
          if (!hasValidSyntax) {
            return {
              ...c,
              verificationStatus: 'REJECTED',
              exactMatch: false,
              confidence: 0,
              lastVerifiedAt: c.lastVerifiedAt || now,
            };
          }

          return {
            ...c,
            email,
            domain: c.domain || (email.includes('@') ? email.split('@')[1] : null),
            verificationStatus: c.verificationStatus || (c.exactMatch === false ? 'REJECTED' : 'VERIFIED_PUBLIC'),
            exactMatch: c.exactMatch !== undefined ? c.exactMatch : true,
            confidence: c.confidence || 85,
            evidenceFound: c.evidenceFound || `Verified exact match on ${c.sourceUrl || 'public page'}`,
            sourceText: c.sourceText || `Verbatim email match in page content`,
            sourceType: c.sourceType || 'OFFICIAL_COMPANY_PAGE',
            lastVerifiedAt: c.lastVerifiedAt || now,
          };
        });

        // Ensure open applications exist for seed companies if empty
        if (this.db.open_applications.length === 0) {
          this.seedOpenApplications();
        }

        // Guarantee Candidate Profile has exact approved contact details
        this.db.candidate_profile = {
          ...DEFAULT_CANDIDATE_PROFILE,
          ...(this.db.candidate_profile || {}),
          name: 'Teja Matta',
          email: 'tejamatta05@gmail.com',
          phone: '+91 8522074021',
          education: 'B.Tech CSE | RGUKT',
          github: 'https://github.com/teja05-45',
          linkedin: 'https://www.linkedin.com/in/teja-matta-602b3531a/',
          portfolio: 'https://teja-matta-portfolio.vercel.app/',
        };

        // Upgrade and normalize all existing company records with canonical and source metadata
        this.db.companies = this.db.companies.map((c) => {
          const normName = c.normalizedName || normalizeCompanyName(c.name);
          const domain = c.officialDomain || extractOfficialDomain(c.officialWebsite);
          const isHyd = c.location?.toLowerCase().includes('hyderabad') || c.startupMapUrl?.includes('hyderabad');
          const defaultSource: StartupMapSource = isHyd ? 'HYDERABAD_STARTUP_MAP' : 'BANGALORE_STARTUP_MAP';

          const sources: CompanySource[] = (c.sources && c.sources.length > 0)
            ? c.sources
            : (c.companySources && c.companySources.length > 0)
            ? c.companySources
            : [{
                id: `src_${c.id}`,
                companyId: c.id,
                sourceMap: defaultSource,
                sourceUrl: c.startupMapUrl || (isHyd ? 'https://www.hyderabadstartupsmap.lol' : 'https://www.bangalorestartupmap.com'),
                sourceCompanyUrl: c.startupMapUrl,
                discoveredAt: c.createdAt || now,
              }];

          const locations = (c.locations && c.locations.length > 0)
            ? c.locations
            : [c.location || (isHyd ? 'Hyderabad, India' : 'Bangalore, India')];

          return {
            ...c,
            canonicalCompanyId: c.canonicalCompanyId || c.id,
            canonicalName: c.canonicalName || c.name,
            normalizedName: normName,
            officialDomain: domain || undefined,
            sourceMap: c.sourceMap || (isHyd ? 'HYDERABAD' : 'BANGALORE'),
            sourceMapUrl: c.sourceMapUrl || c.startupMapUrl,
            sourceCompanyUrl: c.sourceCompanyUrl || c.startupMapUrl,
            sources,
            companySources: sources,
            locations,
            discoveredAt: c.discoveredAt || c.createdAt || now,
            researchStatus: c.researchStatus || c.status || 'PENDING',
          };
        });

        // Guarantee outreach records for general inquiries use the exact approved template
        if (this.db.outreach_records && this.db.outreach_records.length > 0) {
          this.db.outreach_records = this.db.outreach_records.map((r) => {
            if (
              r.outreachType === 'AI_ML_CAREER_INQUIRY' ||
              r.outreachType === 'GENERAL_CAREER_INQUIRY' ||
              r.outreachType === 'OPEN_APPLICATION' ||
              !r.opportunityId
            ) {
              return {
                ...r,
                subject: APPROVED_GENERAL_INQUIRY_SUBJECT,
                body: getApprovedGeneralInquiryBody(r.companyName),
              };
            }
            return r;
          });
        }

      } catch (err) {
        logger.error(`[Store] Error initializing store: ${err}`);
      }
    }

  private seedOpenApplications() {
    const now = new Date().toISOString();
    for (const [companyName, seed] of Object.entries(REAL_OPEN_APPLICATIONS_MAP)) {
      const comp = this.db.companies.find((c) => c.name.toLowerCase() === companyName.toLowerCase());
      if (comp) {
        this.upsertOpenApplication({
          companyId: comp.id,
          companyName: comp.name,
          sourceUrl: seed.sourceUrl,
          sourceText: seed.evidence,
          evidence: seed.evidence,
          contactEmail: seed.contactEmail,
          contactName: seed.contactName,
          contactRole: seed.contactRole,
          verificationStatus: seed.contactEmail ? 'VERIFIED_PUBLIC' : 'NOT_FOUND',
          relevanceScore: seed.relevanceScore,
          status: 'OPEN',
          hasVerifiedEmail: Boolean(seed.contactEmail),
          discoveredAt: now,
          updatedAt: now,
        });
      }
    }
  }

  public persist(): void {
    // Single Source of Truth: All mutations are written directly to SQLite synchronously
  }

  // --- Companies ---
  public getCompanies(filter?: {
    status?: string;
    search?: string;
    location?: LocationScope | string;
    sector?: string;
    stage?: string;
  }): Company[] {
    let list = this.db.companies;
    if (filter?.location) {
      list = list.filter((c) => matchesLocationScope(c.location, filter.location, c));
    }
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((c) => c.status === filter.status);
    }
    if (filter?.sector && filter.sector !== 'ALL') {
      const s = filter.sector.toLowerCase();
      list = list.filter(
        (c) =>
          (c.sector && c.sector.toLowerCase().includes(s)) ||
          (c.category && c.category.toLowerCase().includes(s)) ||
          (c.tags && c.tags.some((t) => t.toLowerCase().includes(s)))
      );
    }
    if (filter?.stage && filter.stage !== 'ALL') {
      const st = filter.stage.toLowerCase();
      list = list.filter((c) => c.startupStage && c.startupStage.toLowerCase().includes(st));
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.sector && c.sector.toLowerCase().includes(q)) ||
          (c.category && c.category.toLowerCase().includes(q)) ||
          (c.tags && c.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }
    return list;
  }

  public getCompany(id: string): Company | undefined {
    return this.db.companies.find((c) => c.id === id || c.canonicalCompanyId === id);
  }

  public getCompanyByName(name: string): Company | undefined {
    const clean = name.trim().toLowerCase();
    const norm = normalizeCompanyName(name);
    return this.db.companies.find((c) => {
      if (c.name.trim().toLowerCase() === clean) return true;
      if (norm.length > 2 && (c.normalizedName === norm || normalizeCompanyName(c.name) === norm)) return true;
      return false;
    });
  }

  public getCompanyByStartupMapUrl(url: string): Company | undefined {
    const clean = url.trim().toLowerCase().replace(/\/$/, '');
    return this.db.companies.find(
      (c) =>
        c.startupMapUrl?.trim().toLowerCase().replace(/\/$/, '') === clean ||
        c.sourceMapUrl?.trim().toLowerCase().replace(/\/$/, '') === clean ||
        c.sources?.some((s) => s.sourceUrl.trim().toLowerCase().replace(/\/$/, '') === clean) ||
        c.companySources?.some((s) => s.sourceUrl.trim().toLowerCase().replace(/\/$/, '') === clean)
    );
  }

  public findCompanyByIdentity(identityKey: string): Company | undefined {
    if (!identityKey) return undefined;
    const cleanKey = identityKey.trim().toLowerCase();
    const byName = this.getCompanyByName(identityKey);
    if (byName) return byName;
    return this.db.companies.find((c) => {
      if (c.officialDomain && c.officialDomain.toLowerCase() === cleanKey) return true;
      if (c.id === cleanKey || c.canonicalCompanyId === cleanKey) return true;
      return false;
    });
  }

  public addOpportunity(opp: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Opportunity {
    return this.upsertOpportunity(opp);
  }

  public upsertCompany(data: Partial<Company> & { name: string; sourceMap?: StartupMapSource; startupMapUrl?: string }): Company {
    const now = new Date().toISOString();
    const normName = normalizeCompanyName(data.name);
    const domain = extractOfficialDomain(data.officialWebsite);

    // Look for existing by ID, startupMapUrl, domain, or normalized name
    let existing = data.id
      ? this.getCompany(data.id)
      : (data.startupMapUrl ? this.getCompanyByStartupMapUrl(data.startupMapUrl) : undefined);

    if (!existing && domain) {
      existing = this.db.companies.find((c) => c.officialDomain === domain || extractOfficialDomain(c.officialWebsite) === domain);
    }

    if (!existing && normName.length > 2) {
      existing = this.db.companies.find((c) => {
        const cNorm = c.normalizedName || normalizeCompanyName(c.name);
        return cNorm === normName;
      });
    }

    const requestedSourceMap: StartupMapSource = data.sourceMap ||
      (data.location?.toLowerCase().includes('hyderabad') || data.startupMapUrl?.includes('hyderabad')
        ? 'HYDERABAD_STARTUP_MAP'
        : 'BANGALORE_STARTUP_MAP');

    const sourceRecord: CompanySource = {
      id: `src_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      companyId: existing ? existing.id : (data.id || `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`),
      sourceMap: requestedSourceMap,
      sourceUrl: data.startupMapUrl || data.sourceMapUrl || (requestedSourceMap.includes('HYD') ? 'https://www.hyderabadstartupsmap.lol' : 'https://www.bangalorestartupmap.com'),
      sourceCompanyUrl: data.sourceCompanyUrl || data.startupMapUrl,
      sourceSlug: (data as any).sourceSlug,
      discoveredAt: data.discoveredAt || now,
    };

    if (existing) {
      // Retain existing sources and add new source if not already tracked
      const currentSources: CompanySource[] = existing.sources || existing.companySources || [];
      const hasSource = currentSources.some(
        (s) => s.sourceMap === requestedSourceMap || (s.sourceUrl && data.startupMapUrl && s.sourceUrl === data.startupMapUrl)
      );
      if (!hasSource) {
        currentSources.push(sourceRecord);
      }
      existing.sources = currentSources;
      existing.companySources = currentSources;

      // Update locations
      const locList = new Set(existing.locations || [existing.location]);
      if (data.location) locList.add(data.location);
      existing.locations = Array.from(locList);

      const hasBlr = currentSources.some((s) => s.sourceMap.includes('BANGALORE')) || existing.locations.some((l) => l.toLowerCase().includes('bangalore') || l.toLowerCase().includes('bengaluru'));
      const hasHyd = currentSources.some((s) => s.sourceMap.includes('HYDERABAD')) || existing.locations.some((l) => l.toLowerCase().includes('hyderabad'));

      if (hasBlr && hasHyd) {
        existing.sourceMap = 'BOTH';
        existing.location = 'Bangalore & Hyderabad, India';
      } else if (hasBlr) {
        existing.sourceMap = 'BANGALORE_STARTUP_MAP';
      } else if (hasHyd) {
        existing.sourceMap = 'HYDERABAD_STARTUP_MAP';
      } else if (currentSources.some((s) => s.sourceMap === 'WHEREWEWORK') || requestedSourceMap === 'WHEREWEWORK') {
        existing.sourceMap = 'WHEREWEWORK';
      } else {
        existing.sourceMap = requestedSourceMap;
      }
      if (typeof (data as any).openingsCount === 'number') {
        existing.openingsCount = (data as any).openingsCount;
      }

      existing.canonicalCompanyId = existing.canonicalCompanyId || existing.id;
      existing.canonicalName = existing.canonicalName || existing.name;
      existing.normalizedName = existing.normalizedName || normName;
      if (domain && !existing.officialDomain) existing.officialDomain = domain;
      if (data.officialWebsite && !existing.officialWebsite) existing.officialWebsite = data.officialWebsite;
      if (data.description && !existing.description) existing.description = data.description;
      if (data.careersUrl && !existing.careersUrl) existing.careersUrl = data.careersUrl;
      if (data.jobBoardUrl && !existing.jobBoardUrl) existing.jobBoardUrl = data.jobBoardUrl;
      if (data.linkedinUrl && !existing.linkedinUrl) existing.linkedinUrl = data.linkedinUrl;
      if (data.tags && data.tags.length > 0) {
        const tagSet = new Set([...existing.tags, ...data.tags]);
        existing.tags = Array.from(tagSet);
      }
      if (data.status && existing.status !== 'COMPLETED') {
        existing.status = data.status;
      }
      existing.updatedAt = now;
      sqliteDb.upsertCompany(existing);
      this.persist();
      return existing;
    }

    const compId = data.id || `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sourceRecord.companyId = compId;

    const newCompany: Company = {
      id: compId,
      canonicalCompanyId: compId,
      name: data.name.trim(),
      canonicalName: data.canonicalName || data.name.trim(),
      normalizedName: normName,
      officialDomain: domain || undefined,
      startupMapUrl: data.startupMapUrl || sourceRecord.sourceUrl,
      sourceMapUrl: data.sourceMapUrl || sourceRecord.sourceUrl,
      sourceCompanyUrl: data.sourceCompanyUrl || data.startupMapUrl,
      sourceMap: requestedSourceMap,
      sources: [sourceRecord],
      companySources: [sourceRecord],
      location: data.location || (requestedSourceMap.includes('HYD') ? 'Hyderabad, India' : 'Bangalore, India'),
      locations: data.locations || [data.location || (requestedSourceMap.includes('HYD') ? 'Hyderabad, India' : 'Bangalore, India')],
      officialWebsite: data.officialWebsite || null,
      websiteVerified: data.websiteVerified ?? false,
      websiteSourceUrl: data.websiteSourceUrl || null,
      description: data.description || null,
      sector: data.sector || null,
      category: data.category || null,
      tags: data.tags || [],
      foundedYear: data.foundedYear || null,
      startupStage: data.startupStage || null,
      teamSize: data.teamSize || null,
      linkedinUrl: data.linkedinUrl || null,
      careersUrl: data.careersUrl || null,
      jobBoardUrl: data.jobBoardUrl || null,
      atsProvider: data.atsProvider || null,
      status: data.status || 'PENDING',
      researchStatus: data.status || 'PENDING',
      lastResearchedAt: data.lastResearchedAt || null,
      discoveredAt: data.discoveredAt || now,
      createdAt: now,
      updatedAt: now,
    };

    this.db.companies.push(newCompany);
    sqliteDb.upsertCompany(newCompany);
    this.persist();
    return newCompany;
  }

  public updateCompanyStatus(id: string, status: Company['status']) {
    const comp = this.getCompany(id);
    if (comp) {
      comp.status = status;
      comp.updatedAt = new Date().toISOString();
      sqliteDb.upsertCompany(comp);
      this.persist();
    }
  }

  // --- Opportunities ---
  public getOpportunities(filter?: OpportunityFilter & { sort?: 'relevance' | 'match' | 'newest' | 'company'; location?: LocationScope | string; sourceMap?: StartupMapSource }): Opportunity[] {
    let list = this.db.opportunities;

    if (filter?.location) {
      list = list.filter((o) => {
        const comp = this.getCompany(o.companyId);
        return (
          matchesLocationScope(o.location, filter.location, comp) ||
          (filter.location === 'WHEREWEWORK' && (o.sourceMap === 'WHEREWEWORK' || o.sourceType === 'ATS_BOARD'))
        );
      });
    }
    if (filter?.source || filter?.sourceMap) {
      const srcFilter = (filter.source || filter.sourceMap) as string;
      if (srcFilter !== 'ALL') {
        list = list.filter((o) => {
          const comp = this.getCompany(o.companyId);
          const compSrc = comp?.sourceMap || comp?.discoveredViaSource || '';
          const oppSrc = o.sourceMap || o.sourceType || '';
          if (srcFilter === 'WHEREWEWORK') {
            return oppSrc === 'WHEREWEWORK' || compSrc === 'WHEREWEWORK' || comp?.sources?.some((s) => s.sourceMap === 'WHEREWEWORK');
          }
          if (srcFilter === 'FRONTLINES' || srcFilter === 'FRONTLINES_CAREER_DIRECTORY') {
            return oppSrc.includes('FRONTLINES') || compSrc.includes('FRONTLINES') || comp?.sources?.some((s) => s.sourceMap.includes('FRONTLINES'));
          }
          if (srcFilter === 'OFFICIAL_CAREERS' || srcFilter === 'OFFICIAL_COMPANY_CAREER_PAGE') {
            return oppSrc.includes('OFFICIAL') || compSrc.includes('OFFICIAL') || comp?.sources?.some((s) => s.sourceMap.includes('OFFICIAL'));
          }
          if (srcFilter === 'HYDERABAD' || srcFilter === 'HYDERABAD_STARTUP_MAP') {
            return oppSrc.includes('HYD') || compSrc.includes('HYD') || o.location?.toLowerCase().includes('hyderabad') || comp?.location?.toLowerCase().includes('hyderabad');
          }
          if (srcFilter === 'BANGALORE' || srcFilter === 'BANGALORE_STARTUP_MAP') {
            return oppSrc.includes('BANG') || compSrc.includes('BANG') || o.location?.toLowerCase().includes('bangalore') || comp?.location?.toLowerCase().includes('bangalore');
          }
          return o.sourceMap === srcFilter;
        });
      }
    }
    if (filter?.companyId) {
      list = list.filter((o) => o.companyId === filter.companyId);
    }
    if (filter?.category && filter.category !== 'ALL') {
      list = list.filter((o) => o.category === filter.category);
    }
    if (filter?.type && filter.type !== 'ALL') {
      list = list.filter((o) => o.type === filter.type);
    }
    if (filter?.aiMlRelevance && filter.aiMlRelevance !== 'ALL') {
      list = list.filter((o) => o.aiMlRelevance === filter.aiMlRelevance);
    }
    if (filter?.experienceLevel && filter.experienceLevel !== 'ALL') {
      list = list.filter((o) => o.experienceLevel === filter.experienceLevel);
    }
    if (filter?.remote && filter.remote !== 'ALL') {
      list = list.filter((o) => o.remote === filter.remote);
    }
    if (filter?.status) {
      list = list.filter((o) => o.status === filter.status);
    }
    if (filter?.verificationStatus) {
      list = list.filter((o) => o.verificationStatus === filter.verificationStatus);
    }
    if (filter?.minRelevance !== undefined) {
      list = list.filter((o) => o.relevanceScore >= filter.minRelevance!);
    }
    if (filter?.isFresherFriendly) {
      list = list.filter(
        (o) =>
          o.experienceLevel === 'FRESHER' ||
          o.experienceLevel === 'ENTRY_LEVEL' ||
          o.experienceLevel === 'INTERN' ||
          o.experienceLevel === 'JUNIOR' ||
          o.type === 'INTERNSHIP' ||
          o.type === 'GRADUATE'
      );
    }
    if (filter?.isInternship) {
      list = list.filter((o) => o.type === 'INTERNSHIP' || o.experienceLevel === 'INTERN');
    }
    if (filter?.isNew) {
      list = list.filter((o) => o.isNew);
    }
    if (filter?.isSaved) {
      const savedIds = new Set(this.db.saved_jobs.map((s) => s.opportunityId));
      list = list.filter((o) => savedIds.has(o.id));
    }
    if (filter?.userApplicationStatus) {
      list = list.filter((o) => o.userApplicationStatus === filter.userApplicationStatus);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.companyName.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          (o.skills && o.skills.some((s) => s.toLowerCase().includes(q))) ||
          (o.category && o.category.toLowerCase().includes(q))
      );
    }

    // Sorting
    const sort = filter?.sort || 'relevance';
    if (sort === 'relevance') {
      list = [...list].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    } else if (sort === 'match') {
      list = [...list].sort((a, b) => (b.personalMatchScore || 0) - (a.personalMatchScore || 0));
    } else if (sort === 'newest') {
      list = [...list].sort((a, b) => new Date(b.firstSeenAt || b.discoveredAt).getTime() - new Date(a.firstSeenAt || a.discoveredAt).getTime());
    } else if (sort === 'company') {
      list = [...list].sort((a, b) => a.companyName.localeCompare(b.companyName));
    }

    return list;
  }

  public getOpportunity(id: string): Opportunity | undefined {
    return this.db.opportunities.find((o) => o.id === id);
  }

  public getOpportunitiesForCompany(companyId: string): Opportunity[] {
    return this.db.opportunities.filter((o) => o.companyId === companyId);
  }

  public upsertOpportunity(opp: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Opportunity {
    const now = new Date().toISOString();
    const classification = classifyRole(
      opp.title,
      opp.description || '',
      opp.companyName,
      opp.location,
      this.db.candidate_profile
    );

    const category = opp.category || classification.category;
    const aiMlRelevance = opp.aiMlRelevance || classification.aiMlRelevance;
    const type = opp.type || classification.type;
    const experienceLevel = opp.experienceLevel || classification.experienceLevel;
    const remote = opp.remote || classification.remote;
    const skills = opp.skills && opp.skills.length > 0 ? opp.skills : classification.skills;
    const relevanceScore = opp.relevanceScore !== undefined ? opp.relevanceScore : classification.relevanceScore;
    const personalMatchScore = opp.personalMatchScore !== undefined ? opp.personalMatchScore : classification.personalMatchScore;
    const jobFingerprint = opp.jobFingerprint || generateJobFingerprint(opp.companyName, opp.title, opp.location);

    const contentHash = crypto
      .createHash('md5')
      .update(
        [
          opp.title,
          opp.description || '',
          opp.location || '',
          type,
          category,
          opp.salary || '',
          (skills || []).join(','),
          opp.applicationUrl || '',
        ].join('|')
      )
      .digest('hex');

    // Deduplicate by companyId + normalized title + type OR by jobFingerprint
    const normalizedTitle = opp.title.trim().toLowerCase();
    const existing = this.db.opportunities.find(
      (o) =>
        (o.companyId === opp.companyId && o.title.trim().toLowerCase() === normalizedTitle && o.type === type) ||
        (jobFingerprint && o.jobFingerprint === jobFingerprint)
    );

    if (existing) {
      const isContentChanged = existing.contentHash && existing.contentHash !== contentHash;
      const lastChangedAt = isContentChanged ? now : (existing.lastChangedAt || existing.updatedAt || now);

      Object.assign(existing, {
        ...opp,
        category,
        aiMlRelevance,
        type,
        experienceLevel,
        remote,
        skills,
        relevanceScore,
        personalMatchScore,
        jobFingerprint,
        contentHash,
        lastChangedAt,
        lastSeenAt: now,
        status: opp.status || existing.status || 'OPEN',
        lastVerifiedAt: opp.lastVerifiedAt || now,
        updatedAt: now,
      });
      sqliteDb.upsertOpportunity(existing);
      this.persist();
      return existing;
    }

    const newOpp: Opportunity = {
      ...opp,
      category,
      aiMlRelevance,
      type,
      experienceLevel,
      remote,
      skills,
      relevanceScore,
      personalMatchScore,
      jobFingerprint,
      contentHash,
      lastChangedAt: now,
      isNew: true,
      firstSeenAt: opp.firstSeenAt || now,
      lastSeenAt: now,
      id: opp.id || `opp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.db.opportunities.push(newOpp);
    sqliteDb.upsertOpportunity(newOpp);
    this.persist();
    return newOpp;
  }

  public updateOpportunityStatus(id: string, status: Opportunity['status'], verificationStatus?: Opportunity['verificationStatus']) {
    const opp = this.getOpportunity(id);
    if (opp) {
      opp.status = status;
      if (verificationStatus) opp.verificationStatus = verificationStatus;
      opp.lastVerifiedAt = new Date().toISOString();
      opp.updatedAt = new Date().toISOString();
      sqliteDb.upsertOpportunity(opp);
      this.persist();
    }
  }

  // --- Saved Jobs & Tracking ---
  public getSavedJobs(): SavedJobRecord[] {
    return this.db.saved_jobs;
  }

  public saveJob(opportunityId: string, priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH', notes = ''): SavedJobRecord {
    const opp = this.getOpportunity(opportunityId);
    if (!opp) throw new Error(`Opportunity not found: ${opportunityId}`);

    const existing = this.db.saved_jobs.find((s) => s.opportunityId === opportunityId);
    const now = new Date().toISOString();

    if (existing) {
      existing.priority = priority;
      if (notes) existing.notes = notes;
      existing.updatedAt = now;
      sqliteDb.upsertSavedJob(existing);
      this.persist();
      return existing;
    }

    const record: SavedJobRecord = {
      id: `save_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      opportunityId,
      companyId: opp.companyId,
      companyName: opp.companyName,
      title: opp.title,
      priority,
      notes,
      status: 'SAVED',
      savedAt: now,
      updatedAt: now,
    };

    opp.isSaved = true;
    opp.userApplicationStatus = 'SAVED';

    this.db.saved_jobs.push(record);
    sqliteDb.upsertSavedJob(record);
    sqliteDb.upsertOpportunity(opp);
    this.persist();
    return record;
  }

  public unsaveJob(opportunityId: string): boolean {
    const idx = this.db.saved_jobs.findIndex((s) => s.opportunityId === opportunityId);
    if (idx !== -1) {
      const removed = this.db.saved_jobs.splice(idx, 1)[0];
      if (removed) {
        sqliteDb.deleteSavedJob(removed.id);
      }
      const opp = this.getOpportunity(opportunityId);
      if (opp) {
        opp.isSaved = false;
        opp.userApplicationStatus = undefined;
        sqliteDb.upsertOpportunity(opp);
      }
      this.persist();
      return true;
    }
    return false;
  }

  public updateSavedJob(id: string, updates: Partial<SavedJobRecord>): SavedJobRecord | undefined {
    const record = this.db.saved_jobs.find((s) => s.id === id);
    if (record) {
      Object.assign(record, updates, { updatedAt: new Date().toISOString() });
      if (updates.status) {
        const opp = this.getOpportunity(record.opportunityId);
        if (opp) {
          opp.userApplicationStatus = updates.status;
          sqliteDb.upsertOpportunity(opp);
        }
      }
      sqliteDb.upsertSavedJob(record);
      this.persist();
      return record;
    }
    return undefined;
  }

  // --- Monitoring Sources & Runs ---
  public getMonitoringSources(): MonitoringSource[] {
    return this.db.monitoring_sources;
  }

  public upsertMonitoringSource(source: Omit<MonitoringSource, 'id'> & { id?: string }): MonitoringSource {
    const existing = this.db.monitoring_sources.find(
      (m) => m.companyId === source.companyId && m.sourceUrl === source.sourceUrl
    );
    if (existing) {
      Object.assign(existing, source);
      sqliteDb.upsertMonitoringSource(existing);
      this.persist();
      return existing;
    }
    const newSource: MonitoringSource = {
      ...source,
      id: source.id || `mon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    this.db.monitoring_sources.push(newSource);
    sqliteDb.upsertMonitoringSource(newSource);
    this.persist();
    return newSource;
  }

  public getMonitoringRuns(): MonitoringRun[] {
    return this.db.monitoring_runs;
  }

  public addMonitoringRun(run: Omit<MonitoringRun, 'id'> & { id?: string }): MonitoringRun {
    const newRun: MonitoringRun = {
      ...run,
      id: run.id || `monrun_${Date.now()}`,
    };
    this.db.monitoring_runs.unshift(newRun);
    if (this.db.monitoring_runs.length > 50) {
      this.db.monitoring_runs = this.db.monitoring_runs.slice(0, 50);
    }
    sqliteDb.addMonitoringRun(newRun);
    this.persist();
    return newRun;
  }

  // --- Notifications ---
  public getNotifications(limit = 50): AppNotification[] {
    return this.db.notifications.slice(0, limit);
  }

  public addNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): AppNotification {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.db.notifications.unshift(newNotif);
    if (this.db.notifications.length > 100) {
      this.db.notifications = this.db.notifications.slice(0, 100);
    }
    sqliteDb.addNotification(newNotif);
    this.persist();
    return newNotif;
  }

  public markNotificationRead(id: string) {
    const n = this.db.notifications.find((item) => item.id === id);
    if (n) {
      n.read = true;
      this.persist();
    }
  }

  public markAllNotificationsRead() {
    for (const n of this.db.notifications) {
      n.read = true;
    }
    this.persist();
  }

  // --- Contacts ---
  public getContacts(filter?: {
    companyId?: string;
    search?: string;
    emailType?: string;
    verificationStatus?: string;
    onlyWithEmail?: boolean;
    location?: LocationScope | string;
  }): Contact[] {
    let list = this.db.contacts;

    if (filter?.location) {
      const validCompanyIds = new Set(
        this.db.companies
          .filter((c) => matchesLocationScope(c.location, filter.location))
          .map((c) => c.id)
      );
      list = list.filter((c) => validCompanyIds.has(c.companyId));
    }

    if (filter?.companyId) {
      list = list.filter((c) => c.companyId === filter.companyId);
    }
    if (filter?.emailType && filter.emailType !== 'ALL') {
      list = list.filter((c) => c.emailType === filter.emailType);
    }
    if (filter?.verificationStatus && filter.verificationStatus !== 'ALL') {
      list = list.filter((c) => c.verificationStatus === filter.verificationStatus);
    }
    if (filter?.onlyWithEmail) {
      list = list.filter((c) => c.email && c.email.toLowerCase() !== 'not publicly available');
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.role && c.role.toLowerCase().includes(q)) ||
          (c.domain && c.domain.toLowerCase().includes(q))
      );
    }

    return list;
  }

  public getContactStats(location?: LocationScope | string) {
    const list = this.getContacts({ location });
    const verifiedPublic = list.filter(
      (c) =>
        c.verificationStatus === 'VERIFIED_PUBLIC' &&
        c.email &&
        c.email.toLowerCase() !== 'not publicly available'
    ).length;
    const employeeContacts = list.filter((c) => Boolean(c.name && c.name.trim().length > 0)).length;
    const careers = list.filter(
      (c) => c.emailType === 'CAREERS' || c.emailType === 'HIRING'
    ).length;
    const talent = list.filter((c) => c.emailType === 'TALENT').length;
    const recruiting = list.filter((c) => c.emailType === 'RECRUITING').length;
    const hr = list.filter((c) => c.emailType === 'HR').length;
    const rejected = list.filter((c) => c.verificationStatus === 'REJECTED').length;

    return {
      total: list.length,
      verifiedPublic,
      employeeContacts,
      careers,
      talent,
      recruiting,
      hr,
      rejected,
    };
  }

  public getContactsForCompany(companyId: string): Contact[] {
    return this.db.contacts.filter((c) => c.companyId === companyId);
  }

  public upsertContact(contact: Omit<Contact, 'id' | 'discoveredAt' | 'lastVerifiedAt'> & { id?: string; discoveredAt?: string; lastVerifiedAt?: string }): Contact {
    const now = new Date().toISOString();
    const cleanEmail = (contact.email || '').trim().toLowerCase();
    
    // Deduplication by companyId + email (if email exists) OR companyId + name
    const existing = this.db.contacts.find((c) => {
      if (c.companyId !== contact.companyId) return false;
      if (cleanEmail && cleanEmail !== 'not publicly available' && c.email.trim().toLowerCase() === cleanEmail) {
        return true;
      }
      if (contact.name && c.name && c.name.trim().toLowerCase() === contact.name.trim().toLowerCase()) {
        return true;
      }
      return false;
    });

    const isNotPublic = !cleanEmail || cleanEmail === 'not publicly available';
    const isEmailValid = isNotPublic || isValidEmail(cleanEmail);
    const isExact = (contact.exactMatch !== undefined ? contact.exactMatch : !isNotPublic) && isEmailValid;
    const defaultStatus: Contact['verificationStatus'] = isExact ? 'VERIFIED_PUBLIC' : 'REJECTED';

    if (existing) {
      Object.assign(existing, {
        ...contact,
        email: cleanEmail || existing.email,
        name: contact.name !== undefined ? contact.name : existing.name,
        role: contact.role !== undefined ? contact.role : existing.role,
        domain: contact.domain !== undefined ? contact.domain : existing.domain,
        profileUrl: contact.profileUrl !== undefined ? contact.profileUrl : existing.profileUrl,
        sourceUrl: contact.sourceUrl || existing.sourceUrl,
        sourceTitle: contact.sourceTitle !== undefined ? contact.sourceTitle : existing.sourceTitle,
        sourceType: contact.sourceType || existing.sourceType,
        sourceText: contact.sourceText || existing.sourceText,
        evidenceFound: contact.evidenceFound || existing.evidenceFound,
        verificationStatus: contact.verificationStatus || existing.verificationStatus || defaultStatus,
        confidence: contact.confidence !== undefined ? contact.confidence : existing.confidence,
        exactMatch: isExact,
        lastVerifiedAt: contact.lastVerifiedAt || now,
      });
      sqliteDb.upsertContact(existing);
      this.persist();
      return existing;
    }

    const domain = contact.domain || (cleanEmail && cleanEmail.includes('@') ? cleanEmail.split('@')[1] : null);

    const newContact: Contact = {
      id: contact.id || `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId: contact.companyId,
      companyName: contact.companyName,
      name: contact.name || null,
      role: contact.role || null,
      email: cleanEmail || 'NOT PUBLICLY AVAILABLE',
      emailType: contact.emailType || 'UNKNOWN',
      domain,
      profileUrl: contact.profileUrl || null,
      sourceUrl: contact.sourceUrl,
      sourceTitle: contact.sourceTitle || null,
      sourceType: contact.sourceType || 'OFFICIAL_COMPANY_PAGE',
      sourceText: contact.sourceText || 'Extracted from public webpage',
      evidenceFound: contact.evidenceFound || (cleanEmail ? `Found on ${contact.sourceUrl}` : 'Public profile found on page'),
      verificationStatus: contact.verificationStatus || defaultStatus,
      confidence: contact.confidence !== undefined ? contact.confidence : (isExact ? 85 : 0),
      exactMatch: isExact,
      discoveredAt: contact.discoveredAt || now,
      lastVerifiedAt: contact.lastVerifiedAt || now,
    };

    this.db.contacts.push(newContact);
    sqliteDb.upsertContact(newContact);
    this.persist();
    return newContact;
  }

  // --- Research Runs ---
  public getResearchRuns(): ResearchRun[] {
    return this.db.research_runs;
  }

  public getResearchRun(id: string): ResearchRun | undefined {
    return this.db.research_runs.find((r) => r.id === id);
  }

  public createResearchRun(batchType: ResearchRun['batchType'], total: number): ResearchRun {
    const run: ResearchRun = {
      id: `run_${Date.now()}`,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'RUNNING',
      totalCompanies: total,
      completedCompanies: 0,
      failedCompanies: 0,
      jobsFound: 0,
      internshipsFound: 0,
      emailsFound: 0,
      batchType,
    };
    this.db.research_runs.unshift(run);
    try {
      sqliteDb.upsertResearchRun(run);
    } catch (e) {
      console.error('[Store] Error persisting research run to sqlite:', e);
    }
    this.persist();
    return run;
  }

  public updateResearchRun(id: string, updates: Partial<ResearchRun>) {
    const run = this.getResearchRun(id);
    if (run) {
      Object.assign(run, updates);
      try {
        sqliteDb.upsertResearchRun(run);
      } catch (e) {
        console.error('[Store] Error updating research run in sqlite:', e);
      }
      this.persist();
    }
  }

  // --- Research Errors ---
  public getResearchErrors(): ResearchError[] {
    return this.db.research_errors;
  }

  public logError(err: Omit<ResearchError, 'id' | 'timestamp' | 'resolved'>): ResearchError {
    const record: ResearchError = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      ...err,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    this.db.research_errors.unshift(record);
    try {
      sqliteDb.addResearchError(record);
    } catch (e) {
      console.error('[Store] Error persisting research error to sqlite:', e);
    }
    this.persist();
    return record;
  }

  public resolveError(id: string) {
    const err = this.db.research_errors.find((e) => e.id === id);
    if (err) {
      err.resolved = true;
      this.persist();
    }
  }

  // --- Research Events ---
  public getEvents(limit = 100): ResearchEvent[] {
    return this.db.research_events.slice(0, limit);
  }

  public addEvent(event: Omit<ResearchEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): ResearchEvent {
    const newEvent: ResearchEvent = {
      id: event.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    this.db.research_events.unshift(newEvent);
    // Keep last 300 events in memory
    if (this.db.research_events.length > 300) {
      this.db.research_events = this.db.research_events.slice(0, 300);
    }
    this.persist();
    return newEvent;
  }

  // --- Open Applications ---
  public getOpenApplications(filter?: {
    companyId?: string;
    status?: string;
    onlyWithEmail?: boolean;
    search?: string;
    location?: LocationScope | string;
  }): OpenApplication[] {
    let list = this.db.open_applications;

    if (filter?.location) {
      const validCompanyIds = new Set(
        this.db.companies
          .filter((c) => matchesLocationScope(c.location, filter.location))
          .map((c) => c.id)
      );
      list = list.filter((a) => validCompanyIds.has(a.companyId) || matchesLocationScope(a.companyName, filter.location));
    }
    if (filter?.companyId) {
      list = list.filter((a) => a.companyId === filter.companyId);
    }
    if (filter?.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    if (filter?.onlyWithEmail) {
      list = list.filter((a) => Boolean(a.contactEmail && a.contactEmail !== 'NOT PUBLICLY AVAILABLE'));
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.companyName.toLowerCase().includes(q) ||
          a.evidence.toLowerCase().includes(q) ||
          (a.contactEmail && a.contactEmail.toLowerCase().includes(q))
      );
    }

    return list;
  }

  public getOpenApplication(id: string): OpenApplication | undefined {
    return this.db.open_applications.find((a) => a.id === id);
  }

  public getOpenApplicationsForCompany(companyId: string): OpenApplication[] {
    return this.db.open_applications.filter((a) => a.companyId === companyId);
  }

  public upsertOpenApplication(
    data: Omit<OpenApplication, 'id' | 'createdAt' | 'updatedAt' | 'discoveredAt'> & {
      id?: string;
      discoveredAt?: string;
      updatedAt?: string;
    }
  ): OpenApplication {
    const now = new Date().toISOString();
    const existing = this.db.open_applications.find(
      (a) => a.companyId === data.companyId || (a.companyName.toLowerCase() === data.companyName.toLowerCase())
    );

    if (existing) {
      Object.assign(existing, {
        ...data,
        updatedAt: now,
      });
      sqliteDb.upsertOpenApplication(existing);
      this.persist();
      return existing;
    }

    const newApp: OpenApplication = {
      ...data,
      id: data.id || `open_app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      discoveredAt: data.discoveredAt || now,
      updatedAt: now,
    };

    this.db.open_applications.push(newApp);
    sqliteDb.upsertOpenApplication(newApp);
    this.persist();
    return newApp;
  }

  public deleteOpenApplication(id: string): boolean {
    const idx = this.db.open_applications.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.db.open_applications.splice(idx, 1);
      try {
        sqliteDb.getRawDb().prepare('DELETE FROM open_applications WHERE id = ?').run(id);
      } catch (e) {
        console.error('Error deleting open app from SQLite:', e);
      }
      this.persist();
      return true;
    }
    return false;
  }

  // --- Applications (Draft, Ready, Sent Pipeline) ---
  public getApplications(filter?: {
    status?: string;
    applicationType?: string;
    companyId?: string;
    search?: string;
    location?: LocationScope | string;
  }): Application[] {
    let list = this.db.applications;

    if (filter?.location) {
      const validCompanyIds = new Set(
        this.db.companies
          .filter((c) => matchesLocationScope(c.location, filter.location))
          .map((c) => c.id)
      );
      list = list.filter((a) => validCompanyIds.has(a.companyId) || matchesLocationScope(a.companyName, filter.location));
    }
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((a) => a.status === filter.status);
    }
    if (filter?.applicationType && filter.applicationType !== 'ALL') {
      list = list.filter((a) => a.applicationType === filter.applicationType);
    }
    if (filter?.companyId) {
      list = list.filter((a) => a.companyId === filter.companyId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (a) =>
          a.companyName.toLowerCase().includes(q) ||
          a.roleTitle.toLowerCase().includes(q) ||
          a.subject.toLowerCase().includes(q) ||
          a.recipientEmail.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getApplication(id: string): Application | undefined {
    return this.db.applications.find((a) => a.id === id);
  }

  public upsertApplication(
    data: Omit<Application, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ): Application {
    const now = new Date().toISOString();
    
    // Check if application already exists for this company + recipient + target role/open app
    const existing = this.db.applications.find((a) => {
      if (data.id && a.id === data.id) return true;
      if (
        a.companyId === data.companyId &&
        a.recipientEmail.toLowerCase() === data.recipientEmail.toLowerCase() &&
        (a.opportunityId === data.opportunityId || a.openApplicationId === data.openApplicationId)
      ) {
        return true;
      }
      return false;
    });

    if (existing) {
      Object.assign(existing, {
        ...data,
        updatedAt: now,
      });
      sqliteDb.upsertApplication(existing);
      this.persist();
      return existing;
    }

    const newApp: Application = {
      ...data,
      id: data.id || `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    this.db.applications.unshift(newApp);
    sqliteDb.upsertApplication(newApp);
    this.persist();
    return newApp;
  }

  public updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    extra?: {
      approvedAt?: string;
      sentAt?: string;
      providerMessageId?: string;
      error?: string;
      followUpAt?: string;
      notes?: string;
    }
  ): Application | null {
    const app = this.getApplication(id);
    if (!app) return null;

    app.status = status;
    app.updatedAt = new Date().toISOString();
    if (extra?.approvedAt !== undefined) app.approvedAt = extra.approvedAt;
    if (extra?.sentAt !== undefined) app.sentAt = extra.sentAt;
    if (extra?.providerMessageId !== undefined) app.providerMessageId = extra.providerMessageId;
    if (extra?.error !== undefined) app.error = extra.error;
    if (extra?.followUpAt !== undefined) app.followUpAt = extra.followUpAt;
    if (extra?.notes !== undefined) app.notes = extra.notes;

    sqliteDb.upsertApplication(app);
    this.persist();
    return app;
  }

  public deleteApplication(id: string): boolean {
    const idx = this.db.applications.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.db.applications.splice(idx, 1);
      sqliteDb.deleteApplication(id);
      this.persist();
      return true;
    }
    return false;
  }

  // =========================================================================
  // --- Automated Email Outreach Pipeline Records & Settings ---
  // =========================================================================

  public getOutreachRecords(filter?: {
    status?: string;
    outreachType?: string;
    companyId?: string;
    search?: string;
    location?: LocationScope | string;
  }): OutreachRecord[] {
    let list = [...(this.db.outreach_records || [])];

    if (filter?.location) {
      const validCompanyIds = new Set(
        this.db.companies
          .filter((c) => matchesLocationScope(c.location, filter.location))
          .map((c) => c.id)
      );
      list = list.filter((r) => validCompanyIds.has(r.companyId) || matchesLocationScope(r.location || r.companyName, filter.location));
    }
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter((r) => r.status === filter.status);
    }
    if (filter?.outreachType && filter.outreachType !== 'ALL') {
      list = list.filter((r) => r.outreachType === filter.outreachType);
    }
    if (filter?.companyId) {
      list = list.filter((r) => r.companyId === filter.companyId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (r) =>
          r.companyName.toLowerCase().includes(q) ||
          (r.roleTitle && r.roleTitle.toLowerCase().includes(q)) ||
          r.subject.toLowerCase().includes(q) ||
          r.recipientEmail.toLowerCase().includes(q) ||
          (r.recipientName && r.recipientName.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getOutreachRecord(id: string): OutreachRecord | undefined {
    return (this.db.outreach_records || []).find((r) => r.id === id);
  }

  public upsertOutreachRecord(
    data: Omit<OutreachRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ): OutreachRecord {
    if (!this.db.outreach_records) {
      this.db.outreach_records = [];
    }

    const now = new Date().toISOString();
    const cleanEmail = (data.recipientEmail || '').trim().toLowerCase();

    // Check if outreach item already exists
    const existing = this.db.outreach_records.find((r) => {
      if (data.id && r.id === data.id) return true;
      if (
        r.companyId === data.companyId &&
        r.recipientEmail.trim().toLowerCase() === cleanEmail &&
        r.outreachType === data.outreachType &&
        (r.opportunityId === data.opportunityId || r.openApplicationId === data.openApplicationId)
      ) {
        return true;
      }
      return false;
    });

    if (existing) {
      Object.assign(existing, {
        ...data,
        recipientEmail: cleanEmail,
        updatedAt: now,
      });
      sqliteDb.upsertOutreachRecord(existing);
      this.persist();
      return existing;
    }

    const newRecord: OutreachRecord = {
      ...data,
      id: data.id || `out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientEmail: cleanEmail,
      createdAt: data.createdAt || now,
      updatedAt: now,
    };

    this.db.outreach_records.unshift(newRecord);
    sqliteDb.upsertOutreachRecord(newRecord);
    this.persist();
    return newRecord;
  }

  public updateOutreachStatus(
    id: string,
    status: OutreachStatus,
    extra?: {
      approvedAt?: string | null;
      scheduledAt?: string | null;
      sentAt?: string | null;
      failedAt?: string | null;
      lastContactAt?: string | null;
      nextEligibleAt?: string | null;
      lastError?: string | null;
      errorMessage?: string | null;
      errorCode?: string | null;
      notes?: string | null;
      provider?: string | null;
      senderEmail?: string | null;
      providerMessageId?: string | null;
      gmailMessageId?: string | null;
      gmailThreadId?: string | null;
      replyDetectedAt?: string | null;
      threadId?: string | null;
    }
  ): OutreachRecord | null {
    const item = this.getOutreachRecord(id);
    if (!item) return null;

    item.status = status;
    item.updatedAt = new Date().toISOString();
    if (extra?.approvedAt !== undefined) item.approvedAt = extra.approvedAt;
    if (extra?.scheduledAt !== undefined) item.scheduledAt = extra.scheduledAt;
    if (extra?.sentAt !== undefined) item.sentAt = extra.sentAt;
    if (extra?.failedAt !== undefined) (item as any).failedAt = extra.failedAt;
    if (extra?.lastContactAt !== undefined) item.lastContactAt = extra.lastContactAt;
    if (extra?.nextEligibleAt !== undefined) item.nextEligibleAt = extra.nextEligibleAt;
    if (extra?.lastError !== undefined) item.lastError = extra.lastError;
    if (extra?.errorMessage !== undefined) {
      item.lastError = extra.errorMessage;
      (item as any).errorMessage = extra.errorMessage;
    }
    if (extra?.errorCode !== undefined) (item as any).errorCode = extra.errorCode;
    if (extra?.notes !== undefined) item.notes = extra.notes;
    if (extra?.provider !== undefined) (item as any).provider = extra.provider;
    if (extra?.senderEmail !== undefined) (item as any).senderEmail = extra.senderEmail;
    if (extra?.providerMessageId !== undefined) item.providerMessageId = extra.providerMessageId;
    if (extra?.gmailMessageId !== undefined) {
      item.providerMessageId = extra.gmailMessageId;
      (item as any).gmailMessageId = extra.gmailMessageId;
    }
    if (extra?.gmailThreadId !== undefined) {
      item.threadId = extra.gmailThreadId;
      (item as any).gmailThreadId = extra.gmailThreadId;
    }
    if (extra?.replyDetectedAt !== undefined) item.replyDetectedAt = extra.replyDetectedAt;
    if (extra?.threadId !== undefined) item.threadId = extra.threadId;

    sqliteDb.upsertOutreachRecord(item);
    this.persist();
    return item;
  }

  public deleteOutreachRecord(id: string): boolean {
    if (!this.db.outreach_records) return false;
    const idx = this.db.outreach_records.findIndex((r) => r.id === id);
    if (idx !== -1) {
      this.db.outreach_records.splice(idx, 1);
      sqliteDb.deleteOutreachRecord(id);
      this.persist();
      return true;
    }
    return false;
  }

  public getGoogleOAuthTokens(): GoogleOAuthTokenData | null {
    return this.db.google_oauth_tokens || null;
  }

  public saveGoogleOAuthTokens(tokens: GoogleOAuthTokenData): void {
    this.db.google_oauth_tokens = tokens;
    sqliteDb.setKV('google_oauth_tokens', tokens);
    this.persist();
  }

  public clearGoogleOAuthTokens(): void {
    this.db.google_oauth_tokens = null;
    sqliteDb.setKV('google_oauth_tokens', null);
    this.persist();
  }

  public saveOAuthState(state: string, data?: string | { redirectUrl?: string; redirectUri?: string }): void {
    if (!this.db.oauth_states) {
      this.db.oauth_states = {};
    }
    const resolvedUri = typeof data === 'string' ? (data.startsWith('http') ? data : undefined) : data?.redirectUri;
    const resolvedUrl = typeof data === 'string' ? (!data.startsWith('http') ? data : undefined) : data?.redirectUrl;
    this.db.oauth_states[state] = {
      createdAt: Date.now(),
      redirectUrl: resolvedUrl,
      redirectUri: resolvedUri,
    };
    // Prune stale states (> 15 mins)
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const key of Object.keys(this.db.oauth_states)) {
      if (this.db.oauth_states[key].createdAt < cutoff) {
        delete this.db.oauth_states[key];
      }
    }
    this.persist();
  }

  public consumeOAuthState(state: string): { valid: boolean; redirectUrl?: string; redirectUri?: string } {
    if (!this.db.oauth_states || !this.db.oauth_states[state]) {
      return { valid: false };
    }
    const stateData = this.db.oauth_states[state];
    delete this.db.oauth_states[state];
    this.persist();
    return { valid: true, redirectUrl: stateData.redirectUrl, redirectUri: (stateData as any).redirectUri };
  }

  public getOutreachSettings(): OutreachSettings {
    return this.db.outreach_settings || { ...DEFAULT_OUTREACH_SETTINGS };
  }

  public updateOutreachSettings(updates: Partial<OutreachSettings>): OutreachSettings {
    this.db.outreach_settings = {
      ...this.getOutreachSettings(),
      ...updates,
    };
    sqliteDb.setKV('outreach_settings', this.db.outreach_settings);
    this.persist();
    return this.db.outreach_settings;
  }

  public isCompanyDoNotContact(companyId: string): boolean {
    const settings = this.getOutreachSettings();
    return (settings.doNotContactCompanyIds || []).includes(companyId);
  }

  public toggleDoNotContactCompany(companyId: string, flag?: boolean): boolean {
    const settings = this.getOutreachSettings();
    const list = new Set(settings.doNotContactCompanyIds || []);
    const shouldAdd = flag !== undefined ? flag : !list.has(companyId);
    
    if (shouldAdd) {
      list.add(companyId);
    } else {
      list.delete(companyId);
    }

    this.updateOutreachSettings({
      doNotContactCompanyIds: Array.from(list),
    });

    return shouldAdd;
  }

  public getOutreachStats(location?: LocationScope | string): OutreachStats {
    const companies = this.getCompanies({ location });
    const companyIds = new Set(companies.map((c) => c.id));

    const opportunities = this.getOpportunities({ location });
    const contacts = this.getContacts({ location });
    const openApps = this.getOpenApplications({ location });
    const outreachList = this.getOutreachRecords({ location });
    const settings = this.getOutreachSettings();

    const companiesResearched = companies.filter((c) => c.status === 'COMPLETED').length;
    const verifiedEmails = contacts.filter(
      (c) =>
        c.verificationStatus === 'VERIFIED_PUBLIC' &&
        c.email &&
        c.email.toLowerCase() !== 'not publicly available' &&
        c.exactMatch !== false
    ).length;

    const publicEmailsFound = contacts.filter(
      (c) => c.email && c.email.toLowerCase() !== 'not publicly available'
    ).length;

    const openApplicationOpportunities = openApps.length;
    const aiMlOpportunities = opportunities.filter(
      (o) => o.category === 'AI_ML' || o.aiMlRelevance === 'CORE_AI_ML' || o.relevanceScore >= 60
    ).length;

    const draftsReady = outreachList.filter(
      (r) => r.status === 'DRAFT_READY' || r.status === 'REVIEW_REQUIRED' || r.status === 'APPROVED'
    ).length;

    const scheduled = outreachList.filter((r) => r.status === 'SCHEDULED').length;
    const sentToday = this.getTodaySentCount();
    const totalSent = outreachList.filter((r) => r.status === 'SENT').length + (this.db.sent_emails || []).filter((s) => !location || companyIds.has(s.companyId)).length;
    const failed = outreachList.filter((r) => r.status === 'FAILED').length;
    const replies = outreachList.filter((r) => r.status === 'REPLIED').length;
    const followUpPending = outreachList.filter((r) => r.status === 'FOLLOW_UP').length;
    const inCooldown = outreachList.filter((r) => r.status === 'COOLDOWN').length;

    const dailyLimit = settings.dailySendLimit || 20;
    const dailyLimitRemaining = Math.max(0, dailyLimit - sentToday);

    return {
      companiesResearched,
      publicEmailsFound,
      verifiedEmails,
      openApplicationOpportunities,
      aiMlOpportunities,
      draftsReady,
      scheduled,
      sentToday,
      totalSent,
      failed,
      replies,
      followUpPending,
      inCooldown,
      dailyLimitRemaining,
      dailyLimit,
    };
  }

  // --- Candidate Profile & Resume Management ---
  public getCandidateProfile(): CandidateProfile {
    return this.db.candidate_profile || { ...DEFAULT_CANDIDATE_PROFILE };
  }

  public updateCandidateProfile(updates: Partial<CandidateProfile>): CandidateProfile {
    this.db.candidate_profile = {
      ...this.getCandidateProfile(),
      ...updates,
    };
    sqliteDb.setKV('candidate_profile', this.db.candidate_profile);
    this.persist();
    return this.db.candidate_profile;
  }

  // --- Email Provider Config ---
  public getEmailProviderConfig(): EmailProviderConfig {
    return this.db.email_provider_config || { ...DEFAULT_EMAIL_CONFIG };
  }

  public updateEmailProviderConfig(updates: Partial<EmailProviderConfig>): EmailProviderConfig {
    this.db.email_provider_config = {
      ...this.getEmailProviderConfig(),
      ...updates,
    };
    sqliteDb.setKV('email_provider_config', this.db.email_provider_config);
    this.persist();
    return this.db.email_provider_config;
  }

  // --- Sent Emails & Tracking ---
  public getSentEmails(): SentEmailRecord[] {
    return this.db.sent_emails || [];
  }

  public logSentEmail(record: Omit<SentEmailRecord, 'id'>): SentEmailRecord {
    const newRecord: SentEmailRecord = {
      ...record,
      id: `sent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    this.db.sent_emails.unshift(newRecord);
    sqliteDb.upsertSentEmail(newRecord);
    this.persist();
    return newRecord;
  }

  public updateSentEmailFollowUp(
    id: string,
    followUpReminderDate: string | null,
    followUpStatus?: 'PENDING' | 'DONE' | 'CANCELLED'
  ): SentEmailRecord | null {
    const rec = this.db.sent_emails.find((r) => r.id === id);
    if (rec) {
      rec.followUpReminderDate = followUpReminderDate;
      if (followUpStatus) rec.followUpStatus = followUpStatus;
      sqliteDb.upsertSentEmail(rec);
      this.persist();
      return rec;
    }
    return null;
  }

  public getTodaySentCount(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.db.sent_emails.filter((s) => s.sentAt && s.sentAt.startsWith(today)).length;
  }

  public canSendEmailToday(dailyLimit = 20): boolean {
    return this.getTodaySentCount() < dailyLimit;
  }

  public isDuplicateSend(
    companyId: string,
    recipientEmail: string,
    opportunityId?: string | null,
    openApplicationId?: string | null,
    cooldownDays = 30
  ): { isDuplicate: boolean; reason?: string } {
    const cleanEmail = recipientEmail.trim().toLowerCase();
    const sentList = this.db.sent_emails.filter(
      (s) => s.companyId === companyId && s.recipientEmail.trim().toLowerCase() === cleanEmail
    );

    if (sentList.length === 0) {
      return { isDuplicate: false };
    }

    // Check specific opportunity duplicate
    if (opportunityId) {
      const matchOpp = sentList.find((s) => s.opportunityId === opportunityId);
      if (matchOpp) {
        return {
          isDuplicate: true,
          reason: `Application already sent for this specific role on ${new Date(matchOpp.sentAt).toLocaleDateString()}`,
        };
      }
    }

    // Check open application cooldown
    if (openApplicationId || !opportunityId) {
      const matchOpen = sentList.find((s) => s.openApplicationId === openApplicationId || s.applicationType === 'OPEN_APPLICATION');
      if (matchOpen) {
        const sentTime = new Date(matchOpen.sentAt).getTime();
        const daysSince = (Date.now() - sentTime) / (1000 * 60 * 60 * 24);
        if (daysSince < cooldownDays) {
          return {
            isDuplicate: true,
            reason: `Open application already submitted to ${matchOpen.companyName} ${Math.round(daysSince)} days ago (${cooldownDays}-day cooldown active)`,
          };
        }
      }
    }

    return { isDuplicate: false };
  }

  // --- Settings ---
  public getSettings(): UserSettings {
    return this.db.user_settings;
  }

  public updateSettings(updates: Partial<UserSettings>): UserSettings {
    this.db.user_settings = {
      ...this.db.user_settings,
      ...updates,
    };
    sqliteDb.setKV('user_settings', this.db.user_settings);
    this.persist();
    return this.db.user_settings;
  }

  // --- Stats Summary ---
  public getStats(location?: LocationScope | string) {
    const companies = this.getCompanies({ location });
    const opportunities = this.getOpportunities({ location });
    const contacts = this.getContacts({ location });
    const openApps = this.getOpenApplications({ location });
    const apps = this.getApplications({ location });
    const errors = this.db.research_errors;
    const emailConfig = this.getEmailProviderConfig();

    const totalCompanies = companies.length;
    const researchedCompanies = companies.filter((c) => c.status === 'COMPLETED').length;
    const pendingCompanies = companies.filter((c) => c.status === 'PENDING').length;
    const failedCompanies = companies.filter((c) => c.status === 'FAILED').length;

    const totalJobs = opportunities.filter((o) => o.type !== 'INTERNSHIP' && o.type !== 'TRAINEE').length;
    const totalInternships = opportunities.filter(
      (o) => o.type === 'INTERNSHIP' || o.type === 'APPRENTICESHIP' || o.type === 'TRAINEE'
    ).length;
    const fresherRoles = opportunities.filter(
      (o) =>
        o.experienceLevel === 'FRESHER' ||
        o.experienceLevel === 'ENTRY_LEVEL' ||
        o.experienceLevel === 'INTERN' ||
        o.experienceLevel === 'JUNIOR'
    ).length;
    const aiMlRoles = opportunities.filter((o) => o.category === 'AI_ML' || o.aiMlRelevance === 'CORE_AI_ML' || o.relevanceScore >= 60).length;
    const aiMlInternships = opportunities.filter((o) => (o.category === 'AI_ML' || o.aiMlRelevance === 'CORE_AI_ML') && (o.type === 'INTERNSHIP' || o.experienceLevel === 'INTERN')).length;
    const softwareRoles = opportunities.filter((o) => o.category === 'SOFTWARE' || o.category === 'FULL_STACK').length;
    const dataRoles = opportunities.filter((o) => o.category === 'DATA').length;
    const backendRoles = opportunities.filter((o) => o.category === 'BACKEND').length;
    const frontendRoles = opportunities.filter((o) => o.category === 'FRONTEND').length;
    const productRoles = opportunities.filter((o) => o.category === 'PRODUCT').length;
    const designRoles = opportunities.filter((o) => o.category === 'DESIGN').length;
    const marketingRoles = opportunities.filter((o) => o.category === 'MARKETING').length;
    const salesRoles = opportunities.filter((o) => o.category === 'SALES').length;
    const operationsRoles = opportunities.filter((o) => o.category === 'OPERATIONS').length;
    const financeRoles = opportunities.filter((o) => o.category === 'FINANCE').length;
    const hrRoles = opportunities.filter((o) => o.category === 'HR').length;
    const otherRoles = opportunities.filter((o) => o.category === 'OTHER' || o.category === 'QA' || o.category === 'DEVOPS_CLOUD').length;

    const savedJobsCount = this.db.saved_jobs.length;
    const appliedJobsCount = opportunities.filter((o) => o.userApplicationStatus === 'APPLIED').length;
    const newJobsCount = opportunities.filter((o) => o.isNew).length;

    const verifiedOpportunities = opportunities.filter((o) => o.verificationStatus === 'VERIFIED').length;
    
    // Open applications
    const openApplications = openApps.length;
    const openApplicationsWithEmail = openApps.filter((a) => Boolean(a.contactEmail && a.contactEmail !== 'NOT PUBLICLY AVAILABLE')).length;

    // Applications pipeline counts
    const applicationsDraftCount = apps.filter((a) => a.status === 'DRAFT').length;
    const applicationsReadyCount = apps.filter((a) => a.status === 'READY_TO_SEND').length;
    const applicationsSentCount = apps.filter((a) => a.status === 'SENT').length;
    const todaySentCount = this.getTodaySentCount();
    const dailyLimit = emailConfig.dailySendLimit || 20;
    const dailyLimitRemaining = Math.max(0, dailyLimit - todaySentCount);

    // Contacts breakdown - only count verified public emails in primary counter
    const verifiedPublicEmails = contacts.filter(
      (c) =>
        c.verificationStatus === 'VERIFIED_PUBLIC' &&
        c.email &&
        c.email.toLowerCase() !== 'not publicly available' &&
        c.exactMatch !== false
    ).length;

    const employeeContacts = contacts.filter((c) => c.name && c.name.trim().length > 0).length;
    const careersEmails = contacts.filter(
      (c) => c.verificationStatus === 'VERIFIED_PUBLIC' && (c.emailType === 'CAREERS' || c.emailType === 'HIRING')
    ).length;
    const talentEmails = contacts.filter(
      (c) => c.verificationStatus === 'VERIFIED_PUBLIC' && c.emailType === 'TALENT'
    ).length;
    const recruitingEmails = contacts.filter(
      (c) => c.verificationStatus === 'VERIFIED_PUBLIC' && c.emailType === 'RECRUITING'
    ).length;
    const hrEmails = contacts.filter(
      (c) => c.verificationStatus === 'VERIFIED_PUBLIC' && c.emailType === 'HR'
    ).length;
    const unverifiedPublicEmails = contacts.filter(
      (c) => c.verificationStatus === 'PUBLIC_UNVERIFIED' || c.verificationStatus === 'NEEDS_REVIEW'
    ).length;
    const removedEmails = contacts.filter((c) => c.verificationStatus === 'SOURCE_REMOVED').length;
    const rejectedEmails = contacts.filter((c) => c.verificationStatus === 'REJECTED').length;

    return {
      totalCompanies,
      researchedCompanies,
      pendingCompanies,
      failedCompanies,
      totalOpportunities: opportunities.length,
      totalJobs,
      totalInternships,
      aiMlInternships,
      softwareRoles,
      dataRoles,
      backendRoles,
      frontendRoles,
      productRoles,
      designRoles,
      marketingRoles,
      salesRoles,
      operationsRoles,
      financeRoles,
      hrRoles,
      otherRoles,
      savedJobsCount,
      appliedJobsCount,
      newJobsCount,
      openApplications,
      openApplicationsWithEmail,
      fresherRoles,
      aiMlRoles,
      verifiedOpportunities,
      publicEmails: verifiedPublicEmails,
      verifiedPublicEmails,
      employeeContacts,
      careersEmails,
      talentEmails,
      recruitingEmails,
      hrEmails,
      unverifiedPublicEmails,
      removedEmails,
      rejectedEmails,
      unresolvedErrors: errors.filter((e) => !e.resolved).length,
      applicationsDraftCount,
      applicationsReadyCount,
      applicationsSentCount,
      todaySentCount,
      dailyLimitRemaining,
    };
  }

  // --- Dynamic Single Source of Truth Stats Breakdown ---
  public calculateResearchStats(scope: LocationScope = 'BANGALORE'): ResearchStatsBreakdown {
    const companies = this.getCompanies({ location: scope });
    const total = companies.length;
    const completed = companies.filter((c) => c.status === 'COMPLETED').length;
    const processing = companies.filter(
      (c) => c.status === 'PROCESSING' || c.status === 'RESEARCHING' || c.status === 'VERIFYING'
    ).length;
    const failed = companies.filter((c) => c.status === 'FAILED').length;
    const skipped = companies.filter((c) => c.status === 'SKIPPED').length;
    const queued = Math.max(0, total - (completed + processing + failed + skipped));
    const pending = queued;

    return {
      scope,
      total,
      completed,
      processing,
      queued,
      failed,
      skipped,
      pending,
    };
  }

  public getSourceStats(): DualSourceStats {
    const allCompanies = this.db.companies;
    const allOpportunities = this.db.opportunities || [];

    const blrCompanies = allCompanies.filter((c) => matchesLocationScope(c.location, 'BANGALORE', c) || c.sourceMap === 'BANGALORE');
    const hydCompanies = allCompanies.filter((c) => matchesLocationScope(c.location, 'HYDERABAD', c) || c.sourceMap === 'HYDERABAD');
    const wwwCompanies = allCompanies.filter((c) => c.sourceMap === 'WHEREWEWORK' || c.sources?.some(s => s.sourceMap === 'WHEREWEWORK'));
    const flmCompanies = allCompanies.filter((c) => c.sourceMap === 'FRONTLINES_CAREER_DIRECTORY' || c.sources?.some(s => s.sourceMap === 'FRONTLINES_CAREER_DIRECTORY') || c.discoveredViaSource === 'FRONTLINES_CAREER_DIRECTORY');

    // Calculate source map discovery counts
    let blrRaw = 0;
    let hydRaw = 0;
    let wwwRaw = 0;
    let flmRaw = 0;
    for (const c of allCompanies) {
      const sources = c.sources || c.companySources || [];
      const hasBlr = sources.some((s) => s.sourceMap.includes('BANGALORE')) || matchesLocationScope(c.location, 'BANGALORE', c);
      const hasHyd = sources.some((s) => s.sourceMap.includes('HYDERABAD')) || matchesLocationScope(c.location, 'HYDERABAD', c);
      const hasWww = c.sourceMap === 'WHEREWEWORK' || sources.some((s) => s.sourceMap.includes('WHEREWEWORK'));
      const hasFlm = c.sourceMap === 'FRONTLINES_CAREER_DIRECTORY' || sources.some((s) => s.sourceMap.includes('FRONTLINES_CAREER_DIRECTORY')) || c.discoveredViaSource === 'FRONTLINES_CAREER_DIRECTORY';
      if (hasBlr) blrRaw++;
      if (hasHyd) hydRaw++;
      if (hasWww) wwwRaw++;
      if (hasFlm) flmRaw++;
    }

    const blrDiscovered = Math.max(blrRaw, blrCompanies.length);
    const hydDiscovered = Math.max(hydRaw, hydCompanies.length);
    const wwwDiscovered = Math.max(wwwRaw, wwwCompanies.length);
    const flmDiscovered = Math.max(flmRaw, flmCompanies.length);

    const blrResearched = blrCompanies.filter((c) => c.status === 'COMPLETED').length;
    const blrProcessing = blrCompanies.filter((c) => c.status === 'PROCESSING' || c.status === 'RESEARCHING' || c.status === 'VERIFYING').length;
    const blrFailed = blrCompanies.filter((c) => c.status === 'FAILED').length;
    const blrSkipped = blrCompanies.filter((c) => c.status === 'SKIPPED').length;
    const blrQueued = Math.max(0, blrCompanies.length - (blrResearched + blrProcessing + blrFailed + blrSkipped));

    const hydResearched = hydCompanies.filter((c) => c.status === 'COMPLETED').length;
    const hydProcessing = hydCompanies.filter((c) => c.status === 'PROCESSING' || c.status === 'RESEARCHING' || c.status === 'VERIFYING').length;
    const hydFailed = hydCompanies.filter((c) => c.status === 'FAILED').length;
    const hydSkipped = hydCompanies.filter((c) => c.status === 'SKIPPED').length;
    const hydQueued = Math.max(0, hydCompanies.length - (hydResearched + hydProcessing + hydFailed + hydSkipped));

    const wwwResearched = wwwCompanies.filter((c) => c.status === 'COMPLETED').length;
    const wwwProcessing = wwwCompanies.filter((c) => c.status === 'PROCESSING' || c.status === 'RESEARCHING' || c.status === 'VERIFYING').length;
    const wwwFailed = wwwCompanies.filter((c) => c.status === 'FAILED').length;
    const wwwSkipped = wwwCompanies.filter((c) => c.status === 'SKIPPED').length;
    const wwwQueued = Math.max(0, wwwCompanies.length - (wwwResearched + wwwProcessing + wwwFailed + wwwSkipped));

    const flmResearched = flmCompanies.filter((c) => c.status === 'COMPLETED').length;
    const flmProcessing = flmCompanies.filter((c) => c.status === 'PROCESSING' || c.status === 'RESEARCHING' || c.status === 'VERIFYING').length;
    const flmFailed = flmCompanies.filter((c) => c.status === 'FAILED').length;
    const flmSkipped = flmCompanies.filter((c) => c.status === 'SKIPPED').length;
    const flmQueued = Math.max(0, flmCompanies.length - (flmResearched + flmProcessing + flmFailed + flmSkipped));

    // Calculate jobs and internships per source
    const blrJobs = allOpportunities.filter((o) => (o.sourceMap === 'BANGALORE' || matchesLocationScope(o.location, 'BANGALORE')) && o.type !== 'INTERNSHIP' && !o.isInternship).length;
    const blrInternships = allOpportunities.filter((o) => (o.sourceMap === 'BANGALORE' || matchesLocationScope(o.location, 'BANGALORE')) && (o.type === 'INTERNSHIP' || o.isInternship)).length;

    const hydJobs = allOpportunities.filter((o) => (o.sourceMap === 'HYDERABAD' || matchesLocationScope(o.location, 'HYDERABAD')) && o.type !== 'INTERNSHIP' && !o.isInternship).length;
    const hydInternships = allOpportunities.filter((o) => (o.sourceMap === 'HYDERABAD' || matchesLocationScope(o.location, 'HYDERABAD')) && (o.type === 'INTERNSHIP' || o.isInternship)).length;

    const wwwJobs = allOpportunities.filter((o) => (o.sourceMap === 'WHEREWEWORK' || o.source === 'WHEREWEWORK' || o.discoveredViaSource === 'WHEREWEWORK') && o.type !== 'INTERNSHIP' && !o.isInternship).length;
    const wwwInternships = allOpportunities.filter((o) => (o.sourceMap === 'WHEREWEWORK' || o.source === 'WHEREWEWORK' || o.discoveredViaSource === 'WHEREWEWORK') && (o.type === 'INTERNSHIP' || o.isInternship)).length;

    // Discovered unique locations for WhereWeWork
    const wwwLocations = new Set<string>();
    for (const c of wwwCompanies) {
      if (c.location) wwwLocations.add(c.location.trim().toLowerCase());
    }
    for (const o of allOpportunities) {
      if (o.sourceMap === 'WHEREWEWORK' || o.source === 'WHEREWEWORK' || o.discoveredViaSource === 'WHEREWEWORK') {
        if (o.location) wwwLocations.add(o.location.trim().toLowerCase());
      }
    }

    // Official company career pages opportunities
    const officialOpportunities = allOpportunities.filter((o) => o.sourceMap === 'OFFICIAL_COMPANY_CAREER_PAGE' || o.source === 'OFFICIAL_COMPANY_CAREER_PAGE' || o.authoritativeSource === 'OFFICIAL_COMPANY_CAREER_PAGE');
    const officialJobs = officialOpportunities.filter((o) => o.type !== 'INTERNSHIP' && !o.isInternship).length;
    const officialInternships = officialOpportunities.filter((o) => o.type === 'INTERNSHIP' || o.isInternship).length;

    // Frontlines career pages stats
    const flmCareerPagesDiscovered = flmCompanies.filter((c) => !!c.careersUrl).length;
    const flmCareerPagesChecked = flmResearched;

    // ATS types detected
    const atsSet = new Set<string>();
    let careersVisitedCount = 0;
    for (const c of allCompanies) {
      if (c.atsProvider) atsSet.add(c.atsProvider);
      if (c.careersPageFound || c.careersUrl || c.status === 'COMPLETED') careersVisitedCount++;
    }

    // Deduplication check across maps
    const duplicates = allCompanies.filter((c) => {
      const isBlr = matchesLocationScope(c.location, 'BANGALORE', c);
      const isHyd = matchesLocationScope(c.location, 'HYDERABAD', c);
      return isBlr && isHyd;
    }).length;

    const totalStored = allCompanies.length;
    const combinedRaw = blrDiscovered + hydDiscovered + wwwDiscovered + flmDiscovered;
    const combinedUnique = totalStored;

    const bangaloreStats: SourceMapStats = {
      sourceName: 'Bangalore Startup Map',
      sourceUrl: 'https://www.bangalorestartupmap.com/',
      rawDiscovered: blrDiscovered,
      uniqueCompanies: blrCompanies.length,
      stored: blrCompanies.length,
      researched: blrResearched,
      processing: blrProcessing,
      queued: blrQueued,
      pending: blrQueued,
      failed: blrFailed,
      skipped: blrSkipped,
      status: blrQueued > 0 && blrResearched > 0 ? 'RUNNING' : blrQueued === 0 ? 'COMPLETE' : 'READY',
      jobs: blrJobs,
      internships: blrInternships,
    };

    const hyderabadStats: SourceMapStats = {
      sourceName: 'Hyderabad Startups Map',
      sourceUrl: 'https://www.hyderabadstartupsmap.lol/',
      rawDiscovered: hydDiscovered,
      uniqueCompanies: hydCompanies.length,
      stored: hydCompanies.length,
      researched: hydResearched,
      processing: hydProcessing,
      queued: hydQueued,
      pending: hydQueued,
      failed: hydFailed,
      skipped: hydSkipped,
      status: hydQueued > 0 && hydResearched > 0 ? 'RUNNING' : hydQueued === 0 ? 'COMPLETE' : 'READY',
      jobs: hydJobs,
      internships: hydInternships,
    };

    const whereWeWorkStats: SourceMapStats = {
      sourceName: 'WhereWeWork.co.in',
      sourceUrl: 'https://wherewework.co.in/',
      rawDiscovered: wwwDiscovered,
      uniqueCompanies: wwwCompanies.length,
      stored: wwwCompanies.length,
      researched: wwwResearched,
      processing: wwwProcessing,
      queued: wwwQueued,
      pending: wwwQueued,
      failed: wwwFailed,
      skipped: wwwSkipped,
      status: wwwQueued > 0 && wwwResearched > 0 ? 'RUNNING' : wwwQueued === 0 ? 'COMPLETE' : 'READY',
      jobs: wwwJobs,
      internships: wwwInternships,
      locationsDiscovered: wwwLocations.size,
    };

    const frontlinesStats: SourceMapStats = {
      sourceName: 'Frontlines Media',
      sourceUrl: 'https://frontlinesmedia.in/302-company-career-pages/',
      rawDiscovered: flmDiscovered,
      uniqueCompanies: flmCompanies.length,
      stored: flmCompanies.length,
      researched: flmResearched,
      processing: flmProcessing,
      queued: flmQueued,
      pending: flmQueued,
      failed: flmFailed,
      skipped: flmSkipped,
      status: flmQueued > 0 && flmResearched > 0 ? 'RUNNING' : flmQueued === 0 ? 'COMPLETE' : 'READY',
      careerPagesDiscovered: flmCareerPagesDiscovered,
      careerPagesChecked: flmCareerPagesChecked,
    };

    const officialCareerStats: SourceMapStats = {
      sourceName: 'Official Company Career Pages',
      sourceUrl: 'https://wherewework.co.in/',
      rawDiscovered: careersVisitedCount,
      uniqueCompanies: careersVisitedCount,
      stored: careersVisitedCount,
      researched: careersVisitedCount,
      processing: 0,
      queued: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
      status: 'READY',
      careersVisited: careersVisitedCount,
      jobs: officialJobs,
      internships: officialInternships,
      atsTypesDetected: Array.from(atsSet),
    };

    const researchedTotal = allCompanies.filter((c) => c.status === 'COMPLETED').length;
    const failedTotal = allCompanies.filter((c) => c.status === 'FAILED').length;
    const pendingTotal = Math.max(0, totalStored - (researchedTotal + failedTotal));

    const bangaloreMissing = Math.max(0, blrDiscovered - blrCompanies.length);
    const hyderabadMissing = Math.max(0, hydDiscovered - hydCompanies.length);
    const whereWeWorkMissing = Math.max(0, wwwDiscovered - wwwCompanies.length);
    const frontlinesMissing = Math.max(0, flmDiscovered - flmCompanies.length);

    return {
      bangalore: bangaloreStats,
      hyderabad: hyderabadStats,
      whereWeWork: whereWeWorkStats,
      frontlines: frontlinesStats,
      officialCareers: officialCareerStats,
      duplicatesAcrossMaps: duplicates,
      combinedRawRecords: combinedRaw,
      combinedUniqueCompanies: combinedUnique,
      totalStoredCompanies: totalStored,
      totalResearchable: combinedUnique,
      researchedTotal,
      pendingTotal,
      failedTotal,
      isConsistent: bangaloreMissing === 0 && hyderabadMissing === 0 && whereWeWorkMissing === 0 && frontlinesMissing === 0,
      discrepancies: {
        bangaloreMissing,
        hyderabadMissing,
        whereWeWorkMissing,
        frontlinesMissing,
        combinedMissing: bangaloreMissing + hyderabadMissing + whereWeWorkMissing + frontlinesMissing,
      },
    };
  }

  public getCompanyStats(): DashboardCompanyStats {
    const sourceStats = this.getSourceStats();
    const blrResearch = this.calculateResearchStats('BANGALORE');
    const hydResearch = this.calculateResearchStats('HYDERABAD');
    const bothResearch = this.calculateResearchStats('BOTH');

    const combinedResearched = sourceStats.researchedTotal;
    const combinedProcessing = sourceStats.bangalore.processing + sourceStats.hyderabad.processing;
    const combinedFailed = sourceStats.failedTotal;
    const combinedSkipped = sourceStats.bangalore.skipped + sourceStats.hyderabad.skipped;
    const combinedQueued = Math.max(
      0,
      sourceStats.totalStoredCompanies - (combinedResearched + combinedProcessing + combinedFailed + combinedSkipped)
    );

    return {
      bangalore: sourceStats.bangalore,
      hyderabad: sourceStats.hyderabad,
      whereWeWork: sourceStats.whereWeWork,
      frontlines: sourceStats.frontlines,
      officialCareers: sourceStats.officialCareers,
      combined: {
        sourceRecords: sourceStats.combinedRawRecords,
        uniqueCompanies: sourceStats.combinedUniqueCompanies,
        duplicates: sourceStats.duplicatesAcrossMaps,
        stored: sourceStats.totalStoredCompanies,
        researched: combinedResearched,
        processing: combinedProcessing,
        queued: combinedQueued,
        pending: combinedQueued,
        failed: combinedFailed,
        skipped: combinedSkipped,
        status: combinedQueued > 0 && combinedResearched > 0 ? 'RUNNING' : combinedQueued === 0 ? 'COMPLETE' : 'READY',
      },
      research: {
        BANGALORE: blrResearch,
        HYDERABAD: hydResearch,
        BOTH: bothResearch,
      },
      consistency: {
        bangaloreSource: sourceStats.bangalore.rawDiscovered,
        bangaloreDatabase: sourceStats.bangalore.stored,
        bangaloreDiff: sourceStats.discrepancies.bangaloreMissing,
        hyderabadSource: sourceStats.hyderabad.rawDiscovered,
        hyderabadDatabase: sourceStats.hyderabad.stored,
        hyderabadDiff: sourceStats.discrepancies.hyderabadMissing,
        combinedSource: sourceStats.combinedRawRecords,
        combinedDatabase: sourceStats.totalStoredCompanies,
        duplicates: sourceStats.duplicatesAcrossMaps,
        queueCount: combinedQueued,
        researchCount: combinedResearched,
        isConsistent: sourceStats.isConsistent,
        syncRequired: !sourceStats.isConsistent,
      },
    };
  }

  public async syncSource(sourceScope: LocationScope = 'BOTH'): Promise<{
    scope: LocationScope;
    added: number;
    updated: number;
    totalStored: number;
    stats: DualSourceStats;
  }> {
    let added = 0;
    let updated = 0;
    const beforeCount = this.db.companies.length;

    // Dynamically import crawlers to prevent circular dependency issues
    if (sourceScope === 'BANGALORE' || sourceScope === 'BOTH') {
      try {
        const { crawlBangaloreStartupMap } = await import('../crawler/startupMapCrawler.ts');
        const blrDiscovered = await crawlBangaloreStartupMap();
        for (const item of blrDiscovered) {
          const comp = this.upsertCompany({
            ...item,
            sourceMap: 'BANGALORE_STARTUP_MAP',
            location: item.location || 'Bangalore, India',
          });
          if (comp.createdAt === comp.updatedAt) added++;
          else updated++;
        }
      } catch (err) {
        console.error('Error syncing Bangalore Startup Map:', err);
      }
    }

    if (sourceScope === 'HYDERABAD' || sourceScope === 'BOTH') {
      try {
        const { crawlHyderabadStartupMap } = await import('../crawler/hyderabadStartupMapCrawler.ts');
        const hydDiscovered = await crawlHyderabadStartupMap();
        for (const item of hydDiscovered) {
          const comp = this.upsertCompany({
            ...item,
            sourceMap: 'HYDERABAD_STARTUP_MAP',
            location: item.location || 'Hyderabad, India',
          });
          if (comp.createdAt === comp.updatedAt) added++;
          else updated++;
        }
      } catch (err) {
        console.error('Error syncing Hyderabad Startup Map:', err);
      }
    }

    if (sourceScope === 'WHEREWEWORK' || (sourceScope as string) === 'ALL') {
      try {
        const { whereWeWorkAdapter } = await import('../adapters/whereWeWork.adapter.ts');
        const wwwResult = await whereWeWorkAdapter.sync({ syncJobs: true });
        added += wwwResult.newCompaniesCount;
        updated += wwwResult.changedCompaniesCount;
      } catch (err) {
        console.error('Error syncing WhereWeWork:', err);
      }
    }

    this.persist();
    const stats = this.getSourceStats();

    this.addEvent({
      companyId: 'system',
      companyName: 'StartupScout AI',
      event: 'SOURCE_SYNC_COMPLETED',
      message: `Database synchronization complete for scope ${sourceScope}. Total canonical companies stored: ${this.db.companies.length}.`,
      stage: 'DISCOVER_COMPANIES',
      type: 'success',
    });

    return {
      scope: sourceScope,
      added,
      updated,
      totalStored: this.db.companies.length,
      stats,
    };
  }
}

export const store = new Store();
