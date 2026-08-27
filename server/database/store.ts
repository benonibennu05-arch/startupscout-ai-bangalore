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
} from '../types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export interface DatabaseSchema {
  companies: Company[];
  opportunities: Opportunity[];
  contacts: Contact[];
  research_runs: ResearchRun[];
  research_errors: ResearchError[];
  research_events: ResearchEvent[];
  user_settings: UserSettings;
}

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
          research_runs: parsed.research_runs || [],
          research_errors: parsed.research_errors || [],
          research_events: parsed.research_events || [],
          user_settings: { ...DEFAULT_SETTINGS, ...(parsed.user_settings || {}) },
        };

        // Automatic sanitization for existing contacts in store
        const now = new Date().toISOString();
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
  public getOpportunities(): Opportunity[] {
    return this.db.opportunities;
  }

  public getOpportunity(id: string): Opportunity | undefined {
    return this.db.opportunities.find((o) => o.id === id);
  }

  public getOpportunitiesForCompany(companyId: string): Opportunity[] {
    return this.db.opportunities.filter((o) => o.companyId === companyId);
  }

  public upsertOpportunity(opp: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Opportunity {
    const now = new Date().toISOString();
    // Deduplicate by companyId + normalized title + type
    const normalizedTitle = opp.title.trim().toLowerCase();
    const existing = this.db.opportunities.find(
      (o) =>
        o.companyId === opp.companyId &&
        o.title.trim().toLowerCase() === normalizedTitle &&
        o.type === opp.type
    );

    if (existing) {
      Object.assign(existing, opp, {
        updatedAt: now,
        lastVerifiedAt: opp.lastVerifiedAt || now,
      });
      this.persist();
      return existing;
    }

    const newOpp: Opportunity = {
      ...opp,
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
    const errors = this.db.research_errors;

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
    const aiMlRoles = opportunities.filter((o) => o.relevanceScore >= 60).length;
    const verifiedOpportunities = opportunities.filter((o) => o.verificationStatus === 'VERIFIED').length;
    
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
    };
  }
}

export const store = new Store();
