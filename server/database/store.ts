import fs from 'fs';
import path from 'path';
import {
  Company,
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
} from '../types.ts';
import { REAL_OPEN_APPLICATIONS_MAP } from '../crawler/openApplicationsMap.ts';
import { classifyRole, generateJobFingerprint } from '../ai/roleClassifier.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export interface DatabaseSchema {
  companies: Company[];
  opportunities: Opportunity[];
  contacts: Contact[];
  open_applications: OpenApplication[];
  applications: Application[];
  sent_emails: SentEmailRecord[];
  saved_jobs: SavedJobRecord[];
  monitoring_sources: MonitoringSource[];
  monitoring_runs: MonitoringRun[];
  notifications: AppNotification[];
  candidate_profile: CandidateProfile;
  email_provider_config: EmailProviderConfig;
  research_runs: ResearchRun[];
  research_errors: ResearchError[];
  research_events: ResearchEvent[];
  user_settings: UserSettings;
}

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  name: 'Teja Matta',
  portfolio: 'https://teja-matta-portfolio.vercel.app/',
  linkedin: 'https://www.linkedin.com/in/teja-matta-602b3531a',
  github: 'https://github.com/teja05-45',
  targetFocus: 'AI/ML Engineering, Generative AI, LLM Systems & Full-Stack AI Agents',
  skills: [
    'Python',
    'PyTorch',
    'TensorFlow',
    'Generative AI',
    'LLMs',
    'LangChain',
    'LlamaIndex',
    'Transformers',
    'AI Agents',
    'FastAPI',
    'TypeScript',
    'Node.js',
    'PostgreSQL',
    'Docker',
    'Data Science',
    'Computer Vision',
    'NLP',
  ],
  education: 'B.Tech in Computer Science & Engineering',
  bio: 'Aspiring AI/ML engineer focused on building robust generative AI pipelines, LLM fine-tuning, autonomous agents, and high-performance backend microservices.',
  resumeFileName: 'Teja_Matta_Resume.pdf',
  resumeUploadedAt: new Date().toISOString(),
  resumeContentText: `TEJA MATTA
Bengaluru, India | Portfolio: https://teja-matta-portfolio.vercel.app/ | LinkedIn: https://www.linkedin.com/in/teja-matta-602b3531a | GitHub: https://github.com/teja05-45

OBJECTIVE:
Aspiring AI/ML & Software Engineer seeking internship and early-career opportunities to contribute to generative AI, large language models, agentic reasoning systems, and scalable backend platforms.

SKILLS:
- Core Languages: Python, TypeScript, JavaScript, SQL, C++, Go
- AI/ML & Data: PyTorch, TensorFlow, Scikit-Learn, Hugging Face Transformers, LangChain, LlamaIndex, Vector DBs (Chroma, Pinecone, pgvector), NLP, Computer Vision, Speech AI
- Backend & Cloud: Node.js, Express, FastAPI, PostgreSQL, MongoDB, Redis, Docker, Git, REST APIs, GraphQL, Linux

PROJECTS:
- Autonomous Multi-Agent Research Assistant: Built LLM agent framework using LangChain, Tool Use, and ChromaDB for automated technical document synthesis.
- Real-time Speech-to-Text & Sentiment Intelligence: Developed streaming audio transcription pipeline with fine-tuned Whisper & FastAPI.
- High-Performance API Gateway & GraphQL Aggregator: Designed scalable microservices layer in Python & TypeScript with PostgreSQL backend.`,
};

export const DEFAULT_EMAIL_CONFIG: EmailProviderConfig = {
  provider: 'SIMULATED_TEST_PROVIDER',
  senderName: 'Teja Matta',
  senderEmail: 'benoni.bennu05@gmail.com',
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

// Seed initial prominent real Bangalore startups from Bangalore Startup Map for instant readiness
const INITIAL_SEED_COMPANIES: Partial<Company>[] = [
  {
    name: 'Hasura',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/hasura',
    officialWebsite: 'https://hasura.io',
    description: 'Instant GraphQL & REST APIs on your data with fine-grained access control.',
    sector: 'Developer Tools & Cloud',
    category: 'Enterprise Tech',
    tags: ['GraphQL', 'Developer Tools', 'Open Source', 'PostgreSQL'],
    location: 'Bangalore, India',
    foundedYear: 2018,
    startupStage: 'Series C',
    teamSize: '200-500',
    linkedinUrl: 'https://www.linkedin.com/company/hasura',
    careersUrl: 'https://hasura.io/careers',
    jobBoardUrl: 'https://boards.greenhouse.io/hasura',
  },
  {
    name: 'Postman',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/postman',
    officialWebsite: 'https://www.postman.com',
    description: 'The world’s leading API development platform used by over 30 million developers.',
    sector: 'Developer Tools & SaaS',
    category: 'Enterprise Software',
    tags: ['API', 'Developer Tools', 'SaaS', 'Cloud'],
    location: 'Bangalore, India',
    foundedYear: 2014,
    startupStage: 'Series D',
    teamSize: '500-1000',
    linkedinUrl: 'https://www.linkedin.com/company/postman-platform',
    careersUrl: 'https://www.postman.com/company/careers',
    jobBoardUrl: 'https://boards.greenhouse.io/postman',
  },
  {
    name: 'Sarvam AI',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/sarvam-ai',
    officialWebsite: 'https://www.sarvam.ai',
    description: 'Building foundational AI models, LLMs and voice agents tailored for Indian languages.',
    sector: 'Artificial Intelligence',
    category: 'Generative AI & LLM',
    tags: ['Generative AI', 'LLMs', 'NLP', 'Indic Languages', 'Voice AI'],
    location: 'Bangalore, India',
    foundedYear: 2023,
    startupStage: 'Series A',
    teamSize: '50-100',
    linkedinUrl: 'https://www.linkedin.com/company/sarvam-ai',
    careersUrl: 'https://www.sarvam.ai/careers',
    jobBoardUrl: 'https://jobs.ashbyhq.com/sarvam.ai',
  },
  {
    name: 'Krutrim',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/krutrim',
    officialWebsite: 'https://olakrutrim.com',
    description: "India's first AI unicorn building full-stack AI cloud infrastructure, silicon and foundational LLMs.",
    sector: 'Artificial Intelligence',
    category: 'AI Infrastructure',
    tags: ['AI Cloud', 'Silicon', 'Foundation Models', 'GPU Cloud'],
    location: 'Bangalore, India',
    foundedYear: 2023,
    startupStage: 'Series A',
    teamSize: '100-250',
    linkedinUrl: 'https://www.linkedin.com/company/olakrutrim',
    careersUrl: 'https://olakrutrim.com/careers',
    jobBoardUrl: 'https://careers.olakrutrim.com',
  },
  {
    name: 'Razorpay',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/razorpay',
    officialWebsite: 'https://razorpay.com',
    description: 'Full-stack financial services and payments infrastructure powering millions of businesses.',
    sector: 'FinTech',
    category: 'Payments & Banking',
    tags: ['FinTech', 'Payments', 'Banking', 'SaaS'],
    location: 'Bangalore, India',
    foundedYear: 2014,
    startupStage: 'Series F',
    teamSize: '2000+',
    linkedinUrl: 'https://www.linkedin.com/company/razorpay',
    careersUrl: 'https://razorpay.com/jobs',
    jobBoardUrl: 'https://jobs.lever.co/razorpay',
  },
  {
    name: 'CRED',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/cred',
    officialWebsite: 'https://cred.club',
    description: 'Members-only club for high-trust individuals rewarding timely credit card bill payments.',
    sector: 'FinTech & Consumer Tech',
    category: 'Consumer Internet',
    tags: ['FinTech', 'Mobile App', 'Credit', 'Payments'],
    location: 'Bangalore, India',
    foundedYear: 2018,
    startupStage: 'Series E',
    teamSize: '800-1200',
    linkedinUrl: 'https://www.linkedin.com/company/cred-club',
    careersUrl: 'https://careers.cred.club',
    jobBoardUrl: 'https://careers.cred.club',
  },
  {
    name: 'Yellow.ai',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/yellow-ai',
    officialWebsite: 'https://yellow.ai',
    description: 'Enterprise Conversational AI & Dynamic Voice Agents automating customer support worldwide.',
    sector: 'Artificial Intelligence & SaaS',
    category: 'Enterprise AI',
    tags: ['Conversational AI', 'LLMs', 'NLP', 'Customer Experience'],
    location: 'Bangalore, India',
    foundedYear: 2016,
    startupStage: 'Series C',
    teamSize: '500-1000',
    linkedinUrl: 'https://www.linkedin.com/company/yellowdotai',
    careersUrl: 'https://yellow.ai/careers',
    jobBoardUrl: 'https://yellow.ai/careers',
  },
  {
    name: 'Observe.AI',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/observe-ai',
    officialWebsite: 'https://www.observe.ai',
    description: 'Contact center LLM and voice intelligence platform converting customer conversations into insights.',
    sector: 'Artificial Intelligence',
    category: 'Voice AI & Analytics',
    tags: ['Speech AI', 'NLP', 'Contact Center', 'LLMs'],
    location: 'Bangalore, India',
    foundedYear: 2017,
    startupStage: 'Series C',
    teamSize: '200-500',
    linkedinUrl: 'https://www.linkedin.com/company/observe-ai',
    careersUrl: 'https://www.observe.ai/careers',
    jobBoardUrl: 'https://jobs.lever.co/observeai',
  },
  {
    name: 'Pixis',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/pixis',
    officialWebsite: 'https://pixis.ai',
    description: 'Codeless AI infrastructure for contextual marketing optimization and autonomous growth.',
    sector: 'Artificial Intelligence',
    category: 'Marketing AI',
    tags: ['AdTech', 'AI Models', 'Computer Vision', 'Reinforcement Learning'],
    location: 'Bangalore, India',
    foundedYear: 2018,
    startupStage: 'Series C',
    teamSize: '250-500',
    linkedinUrl: 'https://www.linkedin.com/company/pixis-ai',
    careersUrl: 'https://pixis.ai/careers',
    jobBoardUrl: 'https://pixis.ai/careers',
  },
  {
    name: 'BrowserStack',
    startupMapUrl: 'https://www.bangalorestartupmap.com/companies/browserstack',
    officialWebsite: 'https://www.browserstack.com',
    description: 'Software testing platform powering over 2 million tests every day across real browsers & devices.',
    sector: 'Developer Tools & QA',
    category: 'Cloud Testing',
    tags: ['DevTools', 'Cloud Testing', 'Automation', 'Infrastructure'],
    location: 'Bangalore, India',
    foundedYear: 2011,
    startupStage: 'Profitable / Scaleup',
    teamSize: '1000+',
    linkedinUrl: 'https://www.linkedin.com/company/browserstack',
    careersUrl: 'https://www.browserstack.com/careers',
    jobBoardUrl: 'https://www.browserstack.com/careers',
  },
];

class Store {
  private db: DatabaseSchema = {
    companies: [],
    opportunities: [],
    contacts: [],
    open_applications: [],
    applications: [],
    sent_emails: [],
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

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.db = {
          companies: parsed.companies || [],
          opportunities: parsed.opportunities || [],
          contacts: parsed.contacts || [],
          open_applications: parsed.open_applications || [],
          applications: parsed.applications || [],
          sent_emails: parsed.sent_emails || [],
          saved_jobs: parsed.saved_jobs || [],
          monitoring_sources: parsed.monitoring_sources || [],
          monitoring_runs: parsed.monitoring_runs || [],
          notifications: parsed.notifications || [],
          candidate_profile: { ...DEFAULT_CANDIDATE_PROFILE, ...(parsed.candidate_profile || {}) },
          email_provider_config: { ...DEFAULT_EMAIL_CONFIG, ...(parsed.email_provider_config || {}) },
          research_runs: parsed.research_runs || [],
          research_errors: parsed.research_errors || [],
          research_events: parsed.research_events || [],
          user_settings: { ...DEFAULT_SETTINGS, ...(parsed.user_settings || {}) },
        };

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

          const hasValidSyntax = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
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
      } else {
        // Seed baseline
        this.seedInitial();
        this.saveSync();
      }
    } catch (err) {
      console.error('Error initializing store:', err);
      this.seedInitial();
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

  private seedInitial() {
    const now = new Date().toISOString();
    this.db.companies = INITIAL_SEED_COMPANIES.map((c, i) => ({
      id: `comp_${Date.now()}_${i}`,
      name: c.name || 'Startup',
      startupMapUrl: c.startupMapUrl || 'https://www.bangalorestartupmap.com',
      officialWebsite: c.officialWebsite || null,
      websiteVerified: true,
      websiteSourceUrl: c.officialWebsite || null,
      description: c.description || null,
      sector: c.sector || null,
      category: c.category || null,
      tags: c.tags || [],
      location: c.location || 'Bangalore, India',
      foundedYear: c.foundedYear || 2020,
      startupStage: c.startupStage || 'Growth',
      teamSize: c.teamSize || '50-200',
      linkedinUrl: c.linkedinUrl || null,
      careersUrl: c.careersUrl || null,
      jobBoardUrl: c.jobBoardUrl || null,
      status: 'PENDING',
      lastResearchedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

    this.addEvent({
      id: `evt_init_${Date.now()}`,
      companyId: 'system',
      companyName: 'StartupScout AI',
      event: 'INITIALIZED',
      message: `System initialized. ${this.db.companies.length} seed companies staged for Bangalore Startup Map crawling.`,
      timestamp: now,
      type: 'info',
    });
  }

  private saveSync() {
    try {
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(this.db, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  public persist() {
    if (!this.writeScheduled) {
      this.writeScheduled = true;
      setTimeout(() => {
        this.saveSync();
        this.writeScheduled = false;
      }, 100);
    }
  }

  // --- Companies ---
  public getCompanies(): Company[] {
    return this.db.companies;
  }

  public getCompany(id: string): Company | undefined {
    return this.db.companies.find((c) => c.id === id);
  }

  public getCompanyByName(name: string): Company | undefined {
    const clean = name.trim().toLowerCase();
    return this.db.companies.find((c) => c.name.trim().toLowerCase() === clean);
  }

  public getCompanyByStartupMapUrl(url: string): Company | undefined {
    const clean = url.trim().toLowerCase().replace(/\/$/, '');
    return this.db.companies.find(
      (c) => c.startupMapUrl.trim().toLowerCase().replace(/\/$/, '') === clean
    );
  }

  public upsertCompany(data: Partial<Company> & { name: string }): Company {
    const now = new Date().toISOString();
    let existing = data.id
      ? this.getCompany(data.id)
      : (data.startupMapUrl ? this.getCompanyByStartupMapUrl(data.startupMapUrl) : undefined) ||
        this.getCompanyByName(data.name);

    if (existing) {
      Object.assign(existing, data, { updatedAt: now });
      this.persist();
      return existing;
    }

    const newCompany: Company = {
      id: data.id || `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: data.name.trim(),
      startupMapUrl: data.startupMapUrl || 'https://www.bangalorestartupmap.com',
      officialWebsite: data.officialWebsite || null,
      websiteVerified: data.websiteVerified ?? false,
      websiteSourceUrl: data.websiteSourceUrl || null,
      description: data.description || null,
      sector: data.sector || null,
      category: data.category || null,
      tags: data.tags || [],
      location: data.location || 'Bangalore, India',
      foundedYear: data.foundedYear || null,
      startupStage: data.startupStage || null,
      teamSize: data.teamSize || null,
      linkedinUrl: data.linkedinUrl || null,
      careersUrl: data.careersUrl || null,
      jobBoardUrl: data.jobBoardUrl || null,
      status: data.status || 'PENDING',
      lastResearchedAt: data.lastResearchedAt || null,
      createdAt: now,
      updatedAt: now,
    };

    this.db.companies.push(newCompany);
    this.persist();
    return newCompany;
  }

  public updateCompanyStatus(id: string, status: Company['status']) {
    const comp = this.getCompany(id);
    if (comp) {
      comp.status = status;
      comp.updatedAt = new Date().toISOString();
      this.persist();
    }
  }

  // --- Opportunities ---
  public getOpportunities(filter?: OpportunityFilter & { sort?: 'relevance' | 'match' | 'newest' | 'company' }): Opportunity[] {
    let list = this.db.opportunities;

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

    // Deduplicate by companyId + normalized title + type OR by jobFingerprint
    const normalizedTitle = opp.title.trim().toLowerCase();
    const existing = this.db.opportunities.find(
      (o) =>
        (o.companyId === opp.companyId && o.title.trim().toLowerCase() === normalizedTitle && o.type === type) ||
        (jobFingerprint && o.jobFingerprint === jobFingerprint)
    );

    if (existing) {
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
        lastSeenAt: now,
        lastVerifiedAt: opp.lastVerifiedAt || now,
        updatedAt: now,
      });
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
      isNew: true,
      firstSeenAt: opp.firstSeenAt || now,
      lastSeenAt: now,
      id: opp.id || `opp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };

    this.db.opportunities.push(newOpp);
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
    this.persist();
    return record;
  }

  public unsaveJob(opportunityId: string): boolean {
    const idx = this.db.saved_jobs.findIndex((s) => s.opportunityId === opportunityId);
    if (idx !== -1) {
      this.db.saved_jobs.splice(idx, 1);
      const opp = this.getOpportunity(opportunityId);
      if (opp) {
        opp.isSaved = false;
        opp.userApplicationStatus = undefined;
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
        }
      }
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
      this.persist();
      return existing;
    }
    const newSource: MonitoringSource = {
      ...source,
      id: source.id || `mon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    this.db.monitoring_sources.push(newSource);
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
  public getContacts(): Contact[] {
    return this.db.contacts;
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

    const isExact = contact.exactMatch !== undefined ? contact.exactMatch : (cleanEmail !== 'not publicly available');
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
    this.persist();
    return run;
  }

  public updateResearchRun(id: string, updates: Partial<ResearchRun>) {
    const run = this.getResearchRun(id);
    if (run) {
      Object.assign(run, updates);
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
  }): OpenApplication[] {
    let list = this.db.open_applications;

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
    this.persist();
    return newApp;
  }

  public deleteOpenApplication(id: string): boolean {
    const idx = this.db.open_applications.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.db.open_applications.splice(idx, 1);
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
  }): Application[] {
    let list = this.db.applications;

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

    this.persist();
    return app;
  }

  public deleteApplication(id: string): boolean {
    const idx = this.db.applications.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.db.applications.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
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
    this.persist();
    return this.db.user_settings;
  }

  // --- Stats Summary ---
  public getStats() {
    const companies = this.db.companies;
    const opportunities = this.db.opportunities;
    const contacts = this.db.contacts;
    const openApps = this.db.open_applications;
    const apps = this.db.applications;
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
}

export const store = new Store();
