import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import {
  Company,
  CompanySource,
  Opportunity,
  Contact,
  OpenApplication,
  Application,
  OutreachRecord,
  SentEmailRecord,
  SavedJobRecord,
  MonitoringSource,
  MonitoringRun,
  AppNotification,
  ResearchRun,
  ResearchError,
  ResearchEvent,
  CandidateProfile,
  EmailProviderConfig,
  UserSettings,
  OutreachSettings,
  GoogleOAuthTokenData,
} from '../types.ts';
import { logger } from '../utils/logger.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'startupscout.db');

export interface FullDatabaseState {
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
  oauth_states?: Record<string, { createdAt: number; redirectUrl?: string }>;
  research_runs: ResearchRun[];
  research_errors: ResearchError[];
  research_events: ResearchEvent[];
  user_settings: UserSettings;
}

export class SQLiteDatabase {
  private db: DatabaseSync;
  private initialized = false;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    logger.info(`[SQLite] Connecting to persistent database at: ${DB_PATH}`);
    this.db = new DatabaseSync(DB_PATH);
    this.initPragmas();
    this.createTables();
    this.initialized = true;
  }

  private initPragmas() {
    try {
      this.db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA temp_store = MEMORY;
        PRAGMA busy_timeout = 30000;
      `);
    } catch (e: any) {
      logger.warn(`[SQLite] Pragma init note: ${e?.message}`);
    }
  }

  private createTables() {
    this.db.exec(`
      -- Companies Table
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        canonical_company_id TEXT,
        name TEXT NOT NULL,
        canonical_name TEXT,
        normalized_name TEXT,
        official_domain TEXT,
        startup_map_url TEXT,
        source_map_url TEXT,
        source_company_url TEXT,
        source_map TEXT NOT NULL,
        location TEXT,
        official_website TEXT,
        website_verified INTEGER DEFAULT 0,
        website_source_url TEXT,
        description TEXT,
        sector TEXT,
        category TEXT,
        tags TEXT,
        founded_year INTEGER,
        startup_stage TEXT,
        team_size TEXT,
        linkedin_url TEXT,
        careers_url TEXT,
        job_board_url TEXT,
        ats_provider TEXT,
        status TEXT DEFAULT 'PENDING',
        research_status TEXT DEFAULT 'PENDING',
        last_researched_at TEXT,
        discovered_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        sources_json TEXT,
        locations_json TEXT,
        raw_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
      CREATE INDEX IF NOT EXISTS idx_companies_norm_name ON companies(normalized_name);
      CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(official_domain);
      CREATE INDEX IF NOT EXISTS idx_companies_source_map ON companies(source_map);
      CREATE INDEX IF NOT EXISTS idx_companies_location ON companies(location);
      CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

      -- Company Sources Table (for tracking multi-source discovery & hashes)
      CREATE TABLE IF NOT EXISTS company_sources (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        source_map TEXT NOT NULL,
        source_url TEXT,
        source_company_url TEXT,
        source_slug TEXT,
        discovered_at TEXT,
        last_seen_at TEXT,
        last_changed_at TEXT,
        content_hash TEXT,
        etag TEXT,
        last_modified TEXT,
        discovery_status TEXT,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_company_sources_comp ON company_sources(company_id);
      CREATE INDEX IF NOT EXISTS idx_company_sources_map ON company_sources(source_map);

      -- Opportunities Table
      CREATE TABLE IF NOT EXISTS opportunities (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        title TEXT NOT NULL,
        location TEXT,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        requirements TEXT,
        skills TEXT,
        url TEXT,
        source TEXT,
        status TEXT DEFAULT 'OPEN',
        relevance_score INTEGER DEFAULT 0,
        ai_ml_relevance TEXT,
        experience_level TEXT,
        remote TEXT,
        personal_match_score INTEGER DEFAULT 0,
        job_fingerprint TEXT,
        is_new INTEGER DEFAULT 0,
        is_saved INTEGER DEFAULT 0,
        user_application_status TEXT,
        discovered_at TEXT,
        first_seen_at TEXT,
        last_seen_at TEXT,
        last_verified_at TEXT,
        verification_status TEXT DEFAULT 'VERIFIED',
        confidence TEXT DEFAULT 'HIGH',
        created_at TEXT,
        updated_at TEXT,
        raw_json TEXT NOT NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_opps_company ON opportunities(company_id);
      CREATE INDEX IF NOT EXISTS idx_opps_type ON opportunities(type);
      CREATE INDEX IF NOT EXISTS idx_opps_category ON opportunities(category);
      CREATE INDEX IF NOT EXISTS idx_opps_status ON opportunities(status);
      CREATE INDEX IF NOT EXISTS idx_opps_fingerprint ON opportunities(job_fingerprint);

      -- Contacts Table
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        name TEXT,
        role TEXT,
        email TEXT NOT NULL,
        email_type TEXT,
        domain TEXT,
        profile_url TEXT,
        source_url TEXT,
        source_title TEXT,
        source_type TEXT,
        source_text TEXT,
        evidence_found TEXT,
        verification_status TEXT NOT NULL,
        confidence INTEGER DEFAULT 0,
        exact_match INTEGER DEFAULT 1,
        discovered_at TEXT,
        last_verified_at TEXT,
        raw_json TEXT NOT NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_verif ON contacts(verification_status);

      -- Open Applications Table
      CREATE TABLE IF NOT EXISTS open_applications (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        source_url TEXT,
        source_text TEXT,
        evidence TEXT,
        contact_email TEXT,
        contact_name TEXT,
        contact_role TEXT,
        verification_status TEXT,
        relevance_score INTEGER DEFAULT 0,
        status TEXT,
        has_verified_email INTEGER DEFAULT 0,
        discovered_at TEXT,
        updated_at TEXT,
        raw_json TEXT NOT NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_open_app_company ON open_applications(company_id);

      -- Applications Table
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        opportunity_id TEXT,
        open_application_id TEXT,
        role_title TEXT,
        application_type TEXT,
        recipient_email TEXT,
        recipient_name TEXT,
        recipient_role TEXT,
        status TEXT,
        email_subject TEXT,
        email_body TEXT,
        error_message TEXT,
        sent_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        raw_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_app_company ON applications(company_id);
      CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);

      -- Outreach Records Table
      CREATE TABLE IF NOT EXISTS outreach_records (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        opportunity_id TEXT,
        open_application_id TEXT,
        recipient_email TEXT,
        recipient_name TEXT,
        recipient_role TEXT,
        email_type TEXT,
        outreach_type TEXT,
        status TEXT,
        match_score INTEGER DEFAULT 0,
        is_ai_ml INTEGER DEFAULT 0,
        subject TEXT,
        body TEXT,
        gmail_message_id TEXT,
        gmail_thread_id TEXT,
        scheduled_for TEXT,
        sent_at TEXT,
        error_message TEXT,
        created_at TEXT,
        updated_at TEXT,
        raw_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_outreach_company ON outreach_records(company_id);
      CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_records(status);

      -- Sent Emails Table
      CREATE TABLE IF NOT EXISTS sent_emails (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        recipient_email TEXT,
        recipient_name TEXT,
        recipient_role TEXT,
        subject TEXT,
        body TEXT,
        application_type TEXT,
        opportunity_id TEXT,
        sent_at TEXT,
        email_provider TEXT,
        delivery_status TEXT,
        reply_status TEXT,
        follow_up_status TEXT,
        next_follow_up_date TEXT,
        raw_json TEXT NOT NULL
      );

      -- Saved Jobs Table
      CREATE TABLE IF NOT EXISTS saved_jobs (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        title TEXT NOT NULL,
        priority TEXT,
        notes TEXT,
        status TEXT,
        saved_at TEXT,
        updated_at TEXT,
        raw_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_saved_jobs_opp ON saved_jobs(opportunity_id);

      -- Monitoring Sources Table
      CREATE TABLE IF NOT EXISTS monitoring_sources (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        company_name TEXT NOT NULL,
        source_type TEXT,
        source_url TEXT NOT NULL,
        status TEXT,
        last_checked_at TEXT,
        last_changed_at TEXT,
        check_interval_hours INTEGER DEFAULT 24,
        failure_count INTEGER DEFAULT 0,
        last_error TEXT,
        raw_json TEXT NOT NULL
      );

      -- Monitoring Runs Table
      CREATE TABLE IF NOT EXISTS monitoring_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT,
        completed_at TEXT,
        status TEXT,
        sources_checked INTEGER DEFAULT 0,
        new_opportunities_found INTEGER DEFAULT 0,
        new_internships_found INTEGER DEFAULT 0,
        contacts_updated INTEGER DEFAULT 0,
        summary TEXT,
        raw_json TEXT NOT NULL
      );

      -- Notifications Table
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT,
        related_company_id TEXT,
        related_opportunity_id TEXT,
        read INTEGER DEFAULT 0,
        created_at TEXT,
        raw_json TEXT NOT NULL
      );

      -- Research Runs Table
      CREATE TABLE IF NOT EXISTS research_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT,
        completed_at TEXT,
        status TEXT,
        total_companies INTEGER DEFAULT 0,
        completed_companies INTEGER DEFAULT 0,
        failed_companies INTEGER DEFAULT 0,
        jobs_found INTEGER DEFAULT 0,
        internships_found INTEGER DEFAULT 0,
        emails_found INTEGER DEFAULT 0,
        batch_type TEXT,
        mode TEXT,
        concurrency INTEGER,
        location TEXT,
        raw_json TEXT NOT NULL
      );

      -- Research Errors Table
      CREATE TABLE IF NOT EXISTS research_errors (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        company_name TEXT,
        stage TEXT,
        error TEXT,
        attempt INTEGER DEFAULT 1,
        timestamp TEXT,
        raw_json TEXT NOT NULL
      );

      -- Research Events Table
      CREATE TABLE IF NOT EXISTS research_events (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        company_name TEXT,
        event TEXT,
        message TEXT,
        stage TEXT,
        type TEXT,
        timestamp TEXT,
        raw_json TEXT NOT NULL
      );

      -- App Key-Value Store for Settings, OAuth, Profile, and Engine State
      CREATE TABLE IF NOT EXISTS app_kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT
      );
    `);
  }

  public getCompanyCount(): number {
    try {
      const row = this.db.prepare('SELECT count(*) as count FROM companies').get() as { count: number };
      return row ? row.count : 0;
    } catch {
      return 0;
    }
  }

  // --- Bulk Migration from database.json into SQLite ---
  public migrateFromJSON(data: FullDatabaseState): void {
    logger.info(`[SQLite] Migrating state into persistent SQLite: ${data.companies?.length || 0} companies, ${data.opportunities?.length || 0} opportunities, ${data.contacts?.length || 0} contacts...`);
    
    this.db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Companies
      const insCompany = this.db.prepare(`
        INSERT OR REPLACE INTO companies (
          id, canonical_company_id, name, canonical_name, normalized_name, official_domain,
          startup_map_url, source_map_url, source_company_url, source_map, location,
          official_website, website_verified, website_source_url, description, sector,
          category, tags, founded_year, startup_stage, team_size, linkedin_url,
          careers_url, job_board_url, ats_provider, status, research_status,
          last_researched_at, discovered_at, created_at, updated_at, sources_json, locations_json, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `);

      for (const c of data.companies || []) {
        insCompany.run(
          c.id,
          c.canonicalCompanyId || null,
          c.name,
          c.canonicalName || c.name,
          c.normalizedName || '',
          c.officialDomain || null,
          c.startupMapUrl || null,
          c.sourceMapUrl || null,
          c.sourceCompanyUrl || null,
          c.sourceMap || 'BANGALORE',
          c.location || null,
          c.officialWebsite || null,
          c.websiteVerified ? 1 : 0,
          c.websiteSourceUrl || null,
          c.description || null,
          c.sector || null,
          c.category || null,
          JSON.stringify(c.tags || []),
          c.foundedYear || null,
          c.startupStage || null,
          c.teamSize || null,
          c.linkedinUrl || null,
          c.careersUrl || null,
          c.jobBoardUrl || null,
          c.atsProvider || null,
          c.status || 'PENDING',
          c.researchStatus || c.status || 'PENDING',
          c.lastResearchedAt || null,
          c.discoveredAt || null,
          c.createdAt || new Date().toISOString(),
          c.updatedAt || new Date().toISOString(),
          JSON.stringify(c.sources || []),
          JSON.stringify(c.locations || []),
          JSON.stringify(c)
        );
      }

      // 2. Opportunities
      const insOpp = this.db.prepare(`
        INSERT OR REPLACE INTO opportunities (
          id, company_id, company_name, title, location, type, category,
          description, requirements, skills, url, source, status, relevance_score,
          ai_ml_relevance, experience_level, remote, personal_match_score, job_fingerprint,
          is_new, is_saved, user_application_status, discovered_at, first_seen_at, last_seen_at,
          last_verified_at, verification_status, confidence, created_at, updated_at, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      for (const o of data.opportunities || []) {
        insOpp.run(
          o.id,
          o.companyId,
          o.companyName,
          o.title,
          o.location || null,
          o.type,
          o.category,
          o.description || null,
          JSON.stringify(o.requirements || []),
          JSON.stringify(o.skills || []),
          (o as any).url || o.sourceUrl || o.applicationUrl || null,
          (o as any).source || o.sourceType || null,
          o.status || 'OPEN',
          o.relevanceScore || 0,
          o.aiMlRelevance || null,
          o.experienceLevel || null,
          o.remote || null,
          o.personalMatchScore || 0,
          o.jobFingerprint || null,
          o.isNew ? 1 : 0,
          o.isSaved ? 1 : 0,
          o.userApplicationStatus || null,
          o.discoveredAt || null,
          o.firstSeenAt || null,
          o.lastSeenAt || null,
          o.lastVerifiedAt || null,
          o.verificationStatus || 'VERIFIED',
          o.confidence || 'HIGH',
          o.createdAt || new Date().toISOString(),
          o.updatedAt || new Date().toISOString(),
          JSON.stringify(o)
        );
      }

      // 3. Contacts
      const insContact = this.db.prepare(`
        INSERT OR REPLACE INTO contacts (
          id, company_id, company_name, name, role, email, email_type, domain,
          profile_url, source_url, source_title, source_type, source_text, evidence_found,
          verification_status, confidence, exact_match, discovered_at, last_verified_at, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      for (const ct of data.contacts || []) {
        insContact.run(
          ct.id,
          ct.companyId,
          ct.companyName,
          ct.name || null,
          ct.role || null,
          ct.email,
          ct.emailType || null,
          ct.domain || null,
          ct.profileUrl || null,
          ct.sourceUrl || null,
          ct.sourceTitle || null,
          ct.sourceType || null,
          ct.sourceText || null,
          ct.evidenceFound || null,
          ct.verificationStatus,
          ct.confidence || 0,
          ct.exactMatch !== false ? 1 : 0,
          ct.discoveredAt || null,
          ct.lastVerifiedAt || null,
          JSON.stringify(ct)
        );
      }

      // 4. Open Applications
      const insOpenApp = this.db.prepare(`
        INSERT OR REPLACE INTO open_applications (
          id, company_id, company_name, source_url, source_text, evidence,
          contact_email, contact_name, contact_role, verification_status,
          relevance_score, status, has_verified_email, discovered_at, updated_at, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      for (const oa of data.open_applications || []) {
        insOpenApp.run(
          oa.id,
          oa.companyId,
          oa.companyName,
          oa.sourceUrl || null,
          oa.sourceText || null,
          oa.evidence || null,
          oa.contactEmail || null,
          oa.contactName || null,
          oa.contactRole || null,
          oa.verificationStatus || null,
          oa.relevanceScore || 0,
          oa.status || 'OPEN',
          oa.hasVerifiedEmail ? 1 : 0,
          oa.discoveredAt || null,
          oa.updatedAt || null,
          JSON.stringify(oa)
        );
      }

      // 5. Applications
      const insApp = this.db.prepare(`
        INSERT OR REPLACE INTO applications (
          id, company_id, company_name, opportunity_id, open_application_id, role_title,
          application_type, recipient_email, recipient_name, recipient_role, status,
          email_subject, email_body, error_message, sent_at, created_at, updated_at, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `);

      for (const ap of data.applications || []) {
        insApp.run(
          ap.id,
          ap.companyId,
          ap.companyName,
          ap.opportunityId || null,
          ap.openApplicationId || null,
          ap.roleTitle || null,
          ap.applicationType || null,
          ap.recipientEmail || null,
          ap.recipientName || null,
          ap.recipientRole || null,
          ap.status || 'DRAFT',
          ap.subject || null,
          ap.body || null,
          ap.error || (ap as any).errorMessage || null,
          ap.sentAt || null,
          ap.createdAt || new Date().toISOString(),
          ap.updatedAt || new Date().toISOString(),
          JSON.stringify(ap)
        );
      }

      // 6. Outreach Records
      const insOutreach = this.db.prepare(`
        INSERT OR REPLACE INTO outreach_records (
          id, company_id, company_name, opportunity_id, open_application_id,
          recipient_email, recipient_name, recipient_role, email_type, outreach_type,
          status, match_score, is_ai_ml, subject, body, gmail_message_id, gmail_thread_id,
          scheduled_for, sent_at, error_message, created_at, updated_at, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?
        )
      `);

      for (const rec of data.outreach_records || []) {
        insOutreach.run(
          rec.id,
          rec.companyId,
          rec.companyName,
          rec.opportunityId || null,
          rec.openApplicationId || null,
          rec.recipientEmail || null,
          rec.recipientName || null,
          rec.recipientRole || null,
          rec.emailType || null,
          rec.outreachType || null,
          rec.status || 'DRAFT',
          rec.matchScore || 0,
          (rec as any).isAiMl ? 1 : 0,
          rec.subject || null,
          rec.body || null,
          rec.gmailMessageId || null,
          rec.gmailThreadId || null,
          rec.scheduledAt || null,
          rec.sentAt || null,
          rec.lastError || null,
          rec.createdAt || new Date().toISOString(),
          rec.updatedAt || new Date().toISOString(),
          JSON.stringify(rec)
        );
      }

      // 7. Sent Emails
      const insSent = this.db.prepare(`
        INSERT OR REPLACE INTO sent_emails (
          id, company_id, company_name, recipient_email, recipient_name, recipient_role,
          subject, body, application_type, opportunity_id, sent_at, email_provider,
          delivery_status, reply_status, follow_up_status, next_follow_up_date, raw_json
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `);

      for (const se of data.sent_emails || []) {
        insSent.run(
          se.id,
          se.companyId,
          se.companyName,
          se.recipientEmail,
          se.recipientName || null,
          (se as any).recipientRole || null,
          se.subject || '',
          se.body || '',
          se.applicationType,
          se.opportunityId || null,
          se.sentAt,
          (se as any).emailProvider || 'GMAIL',
          (se as any).deliveryStatus || se.status || 'DELIVERED',
          (se as any).replyStatus || (se.status === 'REPLIED' ? 'REPLIED' : 'NO_REPLY'),
          se.followUpStatus || 'PENDING',
          (se as any).nextFollowUpDate || se.followUpReminderDate || null,
          JSON.stringify(se)
        );
      }

      // 8. Saved Jobs
      const insSaved = this.db.prepare(`
        INSERT OR REPLACE INTO saved_jobs (
          id, opportunity_id, company_id, company_name, title, priority, notes,
          status, saved_at, updated_at, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const sj of data.saved_jobs || []) {
        insSaved.run(
          sj.id,
          sj.opportunityId,
          sj.companyId,
          sj.companyName,
          sj.title,
          sj.priority || null,
          sj.notes || null,
          sj.status || null,
          sj.savedAt,
          sj.updatedAt,
          JSON.stringify(sj)
        );
      }

      // 9. Monitoring Sources
      const insMonSrc = this.db.prepare(`
        INSERT OR REPLACE INTO monitoring_sources (
          id, company_id, company_name, source_type, source_url, status,
          last_checked_at, last_changed_at, check_interval_hours, failure_count, last_error, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ms of data.monitoring_sources || []) {
        insMonSrc.run(
          ms.id,
          ms.companyId,
          ms.companyName,
          ms.sourceType,
          ms.sourceUrl,
          ms.status,
          ms.lastCheckedAt || null,
          ms.lastChangedAt || null,
          (ms as any).checkIntervalHours || 24,
          (ms as any).failureCount || 0,
          (ms as any).lastError || null,
          JSON.stringify(ms)
        );
      }

      // 10. Monitoring Runs
      const insMonRun = this.db.prepare(`
        INSERT OR REPLACE INTO monitoring_runs (
          id, started_at, completed_at, status, sources_checked, new_opportunities_found,
          new_internships_found, contacts_updated, summary, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const mr of data.monitoring_runs || []) {
        insMonRun.run(
          mr.id,
          mr.startedAt,
          mr.completedAt || null,
          mr.status,
          mr.sourcesChecked,
          mr.newOpportunitiesFound,
          mr.newInternshipsFound,
          mr.contactsUpdated,
          mr.summary || null,
          JSON.stringify(mr)
        );
      }

      // 11. Notifications
      const insNotif = this.db.prepare(`
        INSERT OR REPLACE INTO notifications (
          id, type, title, message, priority, related_company_id, related_opportunity_id,
          read, created_at, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const nf of data.notifications || []) {
        insNotif.run(
          nf.id,
          nf.type,
          nf.title,
          nf.message,
          nf.priority,
          nf.relatedCompanyId || null,
          nf.relatedOpportunityId || null,
          nf.read ? 1 : 0,
          nf.createdAt,
          JSON.stringify(nf)
        );
      }

      // 12. Research Runs
      const insRun = this.db.prepare(`
        INSERT OR REPLACE INTO research_runs (
          id, started_at, completed_at, status, total_companies, completed_companies,
          failed_companies, jobs_found, internships_found, emails_found, batch_type,
          mode, concurrency, location, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const rr of data.research_runs || []) {
        insRun.run(
          rr.id,
          rr.startedAt,
          rr.completedAt || null,
          rr.status,
          rr.totalCompanies,
          rr.completedCompanies,
          rr.failedCompanies,
          rr.jobsFound,
          rr.internshipsFound,
          rr.emailsFound,
          rr.batchType,
          rr.mode || null,
          rr.concurrency || null,
          rr.location || null,
          JSON.stringify(rr)
        );
      }

      // 13. Research Errors
      const insErr = this.db.prepare(`
        INSERT OR REPLACE INTO research_errors (
          id, company_id, company_name, stage, error, attempt, timestamp, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const er of data.research_errors || []) {
        insErr.run(
          er.id,
          er.companyId,
          er.companyName,
          er.stage,
          er.error,
          er.attempt,
          er.timestamp,
          JSON.stringify(er)
        );
      }

      // 14. Research Events
      const insEvt = this.db.prepare(`
        INSERT OR REPLACE INTO research_events (
          id, company_id, company_name, event, message, stage, type, timestamp, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const ev of data.research_events || []) {
        insEvt.run(
          ev.id,
          ev.companyId,
          ev.companyName,
          ev.event,
          ev.message,
          ev.stage,
          ev.type,
          ev.timestamp,
          JSON.stringify(ev)
        );
      }

      // 15. Key-Value entries
      this.setKV('outreach_settings', data.outreach_settings);
      this.setKV('candidate_profile', data.candidate_profile);
      this.setKV('email_provider_config', data.email_provider_config);
      this.setKV('user_settings', data.user_settings);
      if (data.google_oauth_tokens) {
        this.setKV('google_oauth_tokens', data.google_oauth_tokens);
      }
      if (data.oauth_states) {
        this.setKV('oauth_states', data.oauth_states);
      }

      this.db.exec('COMMIT;');
      logger.info(`[SQLite] Database migration completed successfully! Total companies indexed in SQLite: ${this.getCompanyCount()}`);
    } catch (err: any) {
      this.db.exec('ROLLBACK;');
      logger.error(`[SQLite] Migration failed, rolled back: ${err?.message}`);
      throw err;
    }
  }

  // --- Load all data from SQLite into state memory ---
  public loadAll(): FullDatabaseState {
    const parseAll = <T>(tableName: string): T[] => {
      try {
        const rows = this.db.prepare(`SELECT raw_json FROM ${tableName}`).all() as Array<{ raw_json: string }>;
        return rows.map((r) => JSON.parse(r.raw_json) as T);
      } catch (e: any) {
        logger.warn(`[SQLite] Error querying table ${tableName}: ${e?.message}`);
        return [];
      }
    };

    return {
      companies: parseAll<Company>('companies'),
      opportunities: parseAll<Opportunity>('opportunities'),
      contacts: parseAll<Contact>('contacts'),
      open_applications: parseAll<OpenApplication>('open_applications'),
      applications: parseAll<Application>('applications'),
      outreach_records: parseAll<OutreachRecord>('outreach_records'),
      sent_emails: parseAll<SentEmailRecord>('sent_emails'),
      saved_jobs: parseAll<SavedJobRecord>('saved_jobs'),
      monitoring_sources: parseAll<MonitoringSource>('monitoring_sources'),
      monitoring_runs: parseAll<MonitoringRun>('monitoring_runs'),
      notifications: parseAll<AppNotification>('notifications'),
      research_runs: parseAll<ResearchRun>('research_runs'),
      research_errors: parseAll<ResearchError>('research_errors'),
      research_events: parseAll<ResearchEvent>('research_events'),
      outreach_settings: this.getKV<OutreachSettings>('outreach_settings')!,
      candidate_profile: this.getKV<CandidateProfile>('candidate_profile')!,
      email_provider_config: this.getKV<EmailProviderConfig>('email_provider_config')!,
      user_settings: this.getKV<UserSettings>('user_settings')!,
      google_oauth_tokens: this.getKV<GoogleOAuthTokenData>('google_oauth_tokens'),
      oauth_states: this.getKV<Record<string, { createdAt: number; redirectUrl?: string }>>('oauth_states') || {},
    };
  }

  // --- Upsert Single Entity Methods (Instant Persistent Writes) ---
  public upsertCompany(c: Company): void {
    const ins = this.db.prepare(`
      INSERT INTO companies (
        id, canonical_company_id, name, canonical_name, normalized_name, official_domain,
        startup_map_url, source_map_url, source_company_url, source_map, location,
        official_website, website_verified, website_source_url, description, sector,
        category, tags, founded_year, startup_stage, team_size, linkedin_url,
        careers_url, job_board_url, ats_provider, status, research_status,
        last_researched_at, discovered_at, created_at, updated_at, sources_json, locations_json, raw_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        canonical_company_id = excluded.canonical_company_id,
        name = excluded.name,
        canonical_name = excluded.canonical_name,
        normalized_name = excluded.normalized_name,
        official_domain = excluded.official_domain,
        startup_map_url = excluded.startup_map_url,
        source_map_url = excluded.source_map_url,
        source_company_url = excluded.source_company_url,
        source_map = excluded.source_map,
        location = excluded.location,
        official_website = excluded.official_website,
        website_verified = excluded.website_verified,
        website_source_url = excluded.website_source_url,
        description = excluded.description,
        sector = excluded.sector,
        category = excluded.category,
        tags = excluded.tags,
        founded_year = excluded.founded_year,
        startup_stage = excluded.startup_stage,
        team_size = excluded.team_size,
        linkedin_url = excluded.linkedin_url,
        careers_url = excluded.careers_url,
        job_board_url = excluded.job_board_url,
        ats_provider = excluded.ats_provider,
        status = excluded.status,
        research_status = excluded.research_status,
        last_researched_at = excluded.last_researched_at,
        updated_at = excluded.updated_at,
        sources_json = excluded.sources_json,
        locations_json = excluded.locations_json,
        raw_json = excluded.raw_json
    `);

    ins.run(
      c.id,
      c.canonicalCompanyId || null,
      c.name,
      c.canonicalName || c.name,
      c.normalizedName || '',
      c.officialDomain || null,
      c.startupMapUrl || null,
      c.sourceMapUrl || null,
      c.sourceCompanyUrl || null,
      c.sourceMap || 'BANGALORE',
      c.location || null,
      c.officialWebsite || null,
      c.websiteVerified ? 1 : 0,
      c.websiteSourceUrl || null,
      c.description || null,
      c.sector || null,
      c.category || null,
      JSON.stringify(c.tags || []),
      c.foundedYear || null,
      c.startupStage || null,
      c.teamSize || null,
      c.linkedinUrl || null,
      c.careersUrl || null,
      c.jobBoardUrl || null,
      c.atsProvider || null,
      c.status || 'PENDING',
      c.researchStatus || c.status || 'PENDING',
      c.lastResearchedAt || null,
      c.discoveredAt || null,
      c.createdAt || new Date().toISOString(),
      c.updatedAt || new Date().toISOString(),
      JSON.stringify(c.sources || []),
      JSON.stringify(c.locations || []),
      JSON.stringify(c)
    );
  }

  public upsertOpportunity(o: Opportunity): void {
    const ins = this.db.prepare(`
      INSERT INTO opportunities (
        id, company_id, company_name, title, location, type, category,
        description, requirements, skills, url, source, status, relevance_score,
        ai_ml_relevance, experience_level, remote, personal_match_score, job_fingerprint,
        is_new, is_saved, user_application_status, discovered_at, first_seen_at, last_seen_at,
        last_verified_at, verification_status, confidence, created_at, updated_at, raw_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        company_name = excluded.company_name,
        title = excluded.title,
        location = excluded.location,
        type = excluded.type,
        category = excluded.category,
        description = excluded.description,
        requirements = excluded.requirements,
        skills = excluded.skills,
        url = excluded.url,
        source = excluded.source,
        status = excluded.status,
        relevance_score = excluded.relevance_score,
        ai_ml_relevance = excluded.ai_ml_relevance,
        experience_level = excluded.experience_level,
        remote = excluded.remote,
        personal_match_score = excluded.personal_match_score,
        job_fingerprint = excluded.job_fingerprint,
        is_new = excluded.is_new,
        is_saved = excluded.is_saved,
        user_application_status = excluded.user_application_status,
        last_seen_at = excluded.last_seen_at,
        last_verified_at = excluded.last_verified_at,
        verification_status = excluded.verification_status,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    ins.run(
      o.id,
      o.companyId,
      o.companyName,
      o.title,
      o.location || null,
      o.type,
      o.category,
      o.description || null,
      JSON.stringify(o.requirements || []),
      JSON.stringify(o.skills || []),
      (o as any).url || o.sourceUrl || o.applicationUrl || null,
      (o as any).source || o.sourceType || null,
      o.status || 'OPEN',
      o.relevanceScore || 0,
      o.aiMlRelevance || null,
      o.experienceLevel || null,
      o.remote || null,
      o.personalMatchScore || 0,
      o.jobFingerprint || null,
      o.isNew ? 1 : 0,
      o.isSaved ? 1 : 0,
      o.userApplicationStatus || null,
      o.discoveredAt || null,
      o.firstSeenAt || null,
      o.lastSeenAt || null,
      o.lastVerifiedAt || null,
      o.verificationStatus || 'VERIFIED',
      o.confidence || 'HIGH',
      o.createdAt || new Date().toISOString(),
      o.updatedAt || new Date().toISOString(),
      JSON.stringify(o)
    );
  }

  public upsertContact(ct: Contact): void {
    const ins = this.db.prepare(`
      INSERT INTO contacts (
        id, company_id, company_name, name, role, email, email_type, domain,
        profile_url, source_url, source_title, source_type, source_text, evidence_found,
        verification_status, confidence, exact_match, discovered_at, last_verified_at, raw_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        company_name = excluded.company_name,
        name = excluded.name,
        role = excluded.role,
        email = excluded.email,
        email_type = excluded.email_type,
        domain = excluded.domain,
        profile_url = excluded.profile_url,
        source_url = excluded.source_url,
        source_title = excluded.source_title,
        source_type = excluded.source_type,
        source_text = excluded.source_text,
        evidence_found = excluded.evidence_found,
        verification_status = excluded.verification_status,
        confidence = excluded.confidence,
        exact_match = excluded.exact_match,
        last_verified_at = excluded.last_verified_at,
        raw_json = excluded.raw_json
    `);

    ins.run(
      ct.id,
      ct.companyId,
      ct.companyName,
      ct.name || null,
      ct.role || null,
      ct.email,
      ct.emailType || null,
      ct.domain || null,
      ct.profileUrl || null,
      ct.sourceUrl || null,
      ct.sourceTitle || null,
      ct.sourceType || null,
      ct.sourceText || null,
      ct.evidenceFound || null,
      ct.verificationStatus,
      ct.confidence || 0,
      ct.exactMatch !== false ? 1 : 0,
      ct.discoveredAt || null,
      ct.lastVerifiedAt || null,
      JSON.stringify(ct)
    );
  }

  public upsertOpenApplication(oa: OpenApplication): void {
    const ins = this.db.prepare(`
      INSERT INTO open_applications (
        id, company_id, company_name, source_url, source_text, evidence,
        contact_email, contact_name, contact_role, verification_status,
        relevance_score, status, has_verified_email, discovered_at, updated_at, raw_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        company_name = excluded.company_name,
        source_url = excluded.source_url,
        source_text = excluded.source_text,
        evidence = excluded.evidence,
        contact_email = excluded.contact_email,
        contact_name = excluded.contact_name,
        contact_role = excluded.contact_role,
        verification_status = excluded.verification_status,
        relevance_score = excluded.relevance_score,
        status = excluded.status,
        has_verified_email = excluded.has_verified_email,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    ins.run(
      oa.id,
      oa.companyId,
      oa.companyName,
      oa.sourceUrl || null,
      oa.sourceText || null,
      oa.evidence || null,
      oa.contactEmail || null,
      oa.contactName || null,
      oa.contactRole || null,
      oa.verificationStatus || null,
      oa.relevanceScore || 0,
      oa.status || 'OPEN',
      oa.hasVerifiedEmail ? 1 : 0,
      oa.discoveredAt || null,
      oa.updatedAt || null,
      JSON.stringify(oa)
    );
  }

  public upsertApplication(ap: Application): void {
    const ins = this.db.prepare(`
      INSERT INTO applications (
        id, company_id, company_name, opportunity_id, open_application_id, role_title,
        application_type, recipient_email, recipient_name, recipient_role, status,
        email_subject, email_body, error_message, sent_at, created_at, updated_at, raw_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        company_name = excluded.company_name,
        opportunity_id = excluded.opportunity_id,
        open_application_id = excluded.open_application_id,
        role_title = excluded.role_title,
        application_type = excluded.application_type,
        recipient_email = excluded.recipient_email,
        recipient_name = excluded.recipient_name,
        recipient_role = excluded.recipient_role,
        status = excluded.status,
        email_subject = excluded.email_subject,
        email_body = excluded.email_body,
        error_message = excluded.error_message,
        sent_at = excluded.sent_at,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    ins.run(
      ap.id,
      ap.companyId,
      ap.companyName,
      ap.opportunityId || null,
      ap.openApplicationId || null,
      ap.roleTitle || null,
      ap.applicationType || null,
      ap.recipientEmail || null,
      ap.recipientName || null,
      ap.recipientRole || null,
      ap.status || 'DRAFT',
      ap.subject || null,
      ap.body || null,
      ap.error || (ap as any).errorMessage || null,
      ap.sentAt || null,
      ap.createdAt || new Date().toISOString(),
      ap.updatedAt || new Date().toISOString(),
      JSON.stringify(ap)
    );
  }

  public deleteApplication(id: string): void {
    this.db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  }

  public upsertOutreachRecord(rec: OutreachRecord): void {
    const ins = this.db.prepare(`
      INSERT INTO outreach_records (
        id, company_id, company_name, opportunity_id, open_application_id,
        recipient_email, recipient_name, recipient_role, email_type, outreach_type,
        status, match_score, is_ai_ml, subject, body, gmail_message_id, gmail_thread_id,
        scheduled_for, sent_at, error_message, created_at, updated_at, raw_json
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        company_id = excluded.company_id,
        company_name = excluded.company_name,
        opportunity_id = excluded.opportunity_id,
        open_application_id = excluded.open_application_id,
        recipient_email = excluded.recipient_email,
        recipient_name = excluded.recipient_name,
        recipient_role = excluded.recipient_role,
        email_type = excluded.email_type,
        outreach_type = excluded.outreach_type,
        status = excluded.status,
        match_score = excluded.match_score,
        is_ai_ml = excluded.is_ai_ml,
        subject = excluded.subject,
        body = excluded.body,
        gmail_message_id = excluded.gmail_message_id,
        gmail_thread_id = excluded.gmail_thread_id,
        scheduled_for = excluded.scheduled_for,
        sent_at = excluded.sent_at,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    ins.run(
      rec.id,
      rec.companyId,
      rec.companyName,
      rec.opportunityId || null,
      rec.openApplicationId || null,
      rec.recipientEmail || null,
      rec.recipientName || null,
      rec.recipientRole || null,
      rec.emailType || null,
      rec.outreachType || null,
      rec.status || 'DRAFT',
      rec.matchScore || 0,
      (rec as any).isAiMl ? 1 : 0,
      rec.subject || null,
      rec.body || null,
      rec.gmailMessageId || null,
      rec.gmailThreadId || null,
      rec.scheduledAt || null,
      rec.sentAt || null,
      rec.lastError || null,
      rec.createdAt || new Date().toISOString(),
      rec.updatedAt || new Date().toISOString(),
      JSON.stringify(rec)
    );
  }

  public deleteOutreachRecord(id: string): void {
    this.db.prepare('DELETE FROM outreach_records WHERE id = ?').run(id);
  }

  public upsertSentEmail(se: SentEmailRecord): void {
    const ins = this.db.prepare(`
      INSERT INTO sent_emails (
        id, company_id, company_name, recipient_email, recipient_name, recipient_role,
        subject, body, application_type, opportunity_id, sent_at, email_provider,
        delivery_status, reply_status, follow_up_status, next_follow_up_date, raw_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        delivery_status = excluded.delivery_status,
        reply_status = excluded.reply_status,
        follow_up_status = excluded.follow_up_status,
        next_follow_up_date = excluded.next_follow_up_date,
        raw_json = excluded.raw_json
    `);

    ins.run(
      se.id,
      se.companyId,
      se.companyName,
      se.recipientEmail,
      se.recipientName || null,
      (se as any).recipientRole || null,
      se.subject || '',
      se.body || '',
      se.applicationType,
      se.opportunityId || null,
      se.sentAt,
      (se as any).emailProvider || 'GMAIL',
      (se as any).deliveryStatus || se.status || 'DELIVERED',
      (se as any).replyStatus || (se.status === 'REPLIED' ? 'REPLIED' : 'NO_REPLY'),
      se.followUpStatus || 'PENDING',
      (se as any).nextFollowUpDate || se.followUpReminderDate || null,
      JSON.stringify(se)
    );
  }

  public upsertSavedJob(sj: SavedJobRecord): void {
    const ins = this.db.prepare(`
      INSERT INTO saved_jobs (
        id, opportunity_id, company_id, company_name, title, priority, notes,
        status, saved_at, updated_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        priority = excluded.priority,
        notes = excluded.notes,
        status = excluded.status,
        updated_at = excluded.updated_at,
        raw_json = excluded.raw_json
    `);

    ins.run(
      sj.id,
      sj.opportunityId,
      sj.companyId,
      sj.companyName,
      sj.title,
      sj.priority || null,
      sj.notes || null,
      sj.status || null,
      sj.savedAt,
      sj.updatedAt,
      JSON.stringify(sj)
    );
  }

  public deleteSavedJob(id: string): void {
    this.db.prepare('DELETE FROM saved_jobs WHERE id = ?').run(id);
  }

  public upsertMonitoringSource(ms: MonitoringSource): void {
    const ins = this.db.prepare(`
      INSERT INTO monitoring_sources (
        id, company_id, company_name, source_type, source_url, status,
        last_checked_at, last_changed_at, check_interval_hours, failure_count, last_error, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        last_checked_at = excluded.last_checked_at,
        last_changed_at = excluded.last_changed_at,
        failure_count = excluded.failure_count,
        last_error = excluded.last_error,
        raw_json = excluded.raw_json
    `);

    ins.run(
      ms.id,
      ms.companyId,
      ms.companyName,
      ms.sourceType,
      ms.sourceUrl,
      ms.status,
      ms.lastCheckedAt || null,
      ms.lastChangedAt || null,
      (ms as any).checkIntervalHours || 24,
      (ms as any).failureCount || 0,
      (ms as any).lastError || null,
      JSON.stringify(ms)
    );
  }

  public addMonitoringRun(mr: MonitoringRun): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO monitoring_runs (
        id, started_at, completed_at, status, sources_checked, new_opportunities_found,
        new_internships_found, contacts_updated, summary, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mr.id,
      mr.startedAt,
      mr.completedAt || null,
      mr.status,
      mr.sourcesChecked,
      mr.newOpportunitiesFound,
      mr.newInternshipsFound,
      mr.contactsUpdated,
      mr.summary || null,
      JSON.stringify(mr)
    );
  }

  public addNotification(nf: AppNotification): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO notifications (
        id, type, title, message, priority, related_company_id, related_opportunity_id,
        read, created_at, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nf.id,
      nf.type,
      nf.title,
      nf.message,
      nf.priority,
      nf.relatedCompanyId || null,
      nf.relatedOpportunityId || null,
      nf.read ? 1 : 0,
      nf.createdAt,
      JSON.stringify(nf)
    );
  }

  public upsertResearchRun(rr: ResearchRun): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO research_runs (
        id, started_at, completed_at, status, total_companies, completed_companies,
        failed_companies, jobs_found, internships_found, emails_found, batch_type,
        mode, concurrency, location, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      rr.id,
      rr.startedAt,
      rr.completedAt || null,
      rr.status,
      rr.totalCompanies,
      rr.completedCompanies,
      rr.failedCompanies,
      rr.jobsFound,
      rr.internshipsFound,
      rr.emailsFound,
      rr.batchType,
      rr.mode || null,
      rr.concurrency || null,
      rr.location || null,
      JSON.stringify(rr)
    );
  }

  public addResearchError(er: ResearchError): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO research_errors (
        id, company_id, company_name, stage, error, attempt, timestamp, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      er.id,
      er.companyId,
      er.companyName,
      er.stage,
      er.error,
      er.attempt,
      er.timestamp,
      JSON.stringify(er)
    );
  }

  public addResearchEvent(ev: ResearchEvent): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO research_events (
        id, company_id, company_name, event, message, stage, type, timestamp, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ev.id,
      ev.companyId,
      ev.companyName,
      ev.event,
      ev.message,
      ev.stage,
      ev.type,
      ev.timestamp,
      JSON.stringify(ev)
    );
  }

  // --- Key-Value Engine ---
  public getKV<T>(key: string): T | null {
    try {
      const row = this.db.prepare('SELECT value FROM app_kv_store WHERE key = ?').get(key) as { value: string } | undefined;
      if (!row || !row.value) return null;
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  public setKV(key: string, value: any): void {
    try {
      const now = new Date().toISOString();
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      this.db.prepare(`
        INSERT INTO app_kv_store (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, str, now);
    } catch (err: any) {
      logger.error(`[SQLite] Error writing KV [${key}]: ${err?.message}`);
    }
  }

  public checkIntegrity(): { ok: boolean; status: string; details?: any } {
    try {
      const quick = this.db.prepare('PRAGMA quick_check;').all() as any[];
      const quickOk = quick.length === 1 && (quick[0].quick_check === 'ok' || quick[0]['quick_check'] === 'ok');
      if (quickOk) {
        return { ok: true, status: 'ok' };
      }
      logger.warn(`[SQLite] Quick check failed (${JSON.stringify(quick)}), running automatic REINDEX...`);
      this.reindex();
      const full = this.db.prepare('PRAGMA integrity_check;').all() as any[];
      const fullOk = full.length === 1 && (full[0].integrity_check === 'ok' || full[0]['integrity_check'] === 'ok');
      if (fullOk) {
        logger.info('[SQLite] Database successfully repaired via REINDEX.');
        return { ok: true, status: 'repaired_ok' };
      }
      return { ok: false, status: 'corrupted', details: full };
    } catch (err: any) {
      return { ok: false, status: err?.message || 'error' };
    }
  }

  public reindex(): void {
    try {
      this.db.exec('REINDEX;');
      logger.info('[SQLite] REINDEX executed successfully.');
    } catch (err: any) {
      logger.error(`[SQLite] REINDEX error: ${err?.message}`);
    }
  }

  public checkpoint(): void {
    try {
      this.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch (err: any) {
      logger.warn(`[SQLite] Checkpoint note: ${err?.message}`);
    }
  }

  public healthCheck(): {
    healthy: boolean;
    integrity: string;
    quickCheck: string;
    databasePath: string;
    databaseSizeBytes: number;
    totalCompanies: number;
    totalOpportunities: number;
    totalContacts: number;
    error?: string;
  } {
    try {
      const integrity = this.checkIntegrity();
      const stats = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : { size: 0 };
      const companyCount = this.getCompanyCount();
      let oppCount = 0;
      let contactCount = 0;
      try {
        oppCount = (this.db.prepare('SELECT COUNT(*) as c FROM opportunities').get() as any)?.c || 0;
        contactCount = (this.db.prepare('SELECT COUNT(*) as c FROM contacts').get() as any)?.c || 0;
      } catch {
        // Fall through
      }

      return {
        healthy: integrity.ok,
        integrity: integrity.status,
        quickCheck: integrity.ok ? 'ok' : 'failed',
        databasePath: DB_PATH,
        databaseSizeBytes: stats.size,
        totalCompanies: companyCount,
        totalOpportunities: oppCount,
        totalContacts: contactCount,
        error: integrity.ok ? undefined : integrity.status,
      };
    } catch (err: any) {
      return {
        healthy: false,
        integrity: 'error',
        quickCheck: 'error',
        databasePath: DB_PATH,
        databaseSizeBytes: 0,
        totalCompanies: 0,
        totalOpportunities: 0,
        totalContacts: 0,
        error: err?.message || String(err),
      };
    }
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }
}

export const sqliteDb = new SQLiteDatabase();
