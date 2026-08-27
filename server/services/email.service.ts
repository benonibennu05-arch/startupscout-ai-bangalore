import { Contact, ContactFilter, EmailSourceType } from '../types.ts';
import { store } from '../database/store.ts';
import {
  extractPublicEmailsFromHtml,
  verifyExactMatchInSource,
  isValidEmail,
  calculateSourceQualityScore,
} from '../extractors/email.extractor.ts';
import { logger } from '../utils/logger.ts';

export class EmailService {
  /**
   * Extract public recruitment emails strictly from page HTML with evidence
   */
  public extractAndPersistEmails(
    html: string,
    sourceUrl: string,
    companyId: string,
    companyName: string,
    officialWebsite?: string | null,
    inferredSourceType?: EmailSourceType
  ): Contact[] {
    if (!html || typeof html !== 'string') return [];

    const extracted = extractPublicEmailsFromHtml(html, sourceUrl, officialWebsite, inferredSourceType);
    const results: Contact[] = [];
    const now = new Date().toISOString();

    for (const item of extracted) {
      // Hard Backend Enforcement: Independent exact match check before saving
      let isExact = item.exactMatch;
      if (item.email && item.email.toLowerCase() !== 'not publicly available') {
        isExact = verifyExactMatchInSource(item.email, html);
      }

      if (!isExact && item.email && item.email.toLowerCase() !== 'not publicly available') {
        logger.warn(
          `[EmailService] REJECTED email ${item.email} for ${companyName}: Exact string not found in retrieved source content.`
        );
        // Do not persist unevidenced emails as valid contacts
        continue;
      }

      const verificationStatus = isExact ? 'VERIFIED_PUBLIC' : 'REJECTED';
      const confidence = calculateSourceQualityScore(item.sourceType, item.email, officialWebsite, isExact);

      const contact = store.upsertContact({
        companyId,
        companyName,
        name: item.name || null,
        role: item.role || null,
        email: item.email,
        emailType: item.emailType,
        domain: item.domain || null,
        profileUrl: item.profileUrl || null,
        sourceUrl: item.sourceUrl,
        sourceTitle: item.sourceTitle || null,
        sourceType: item.sourceType,
        sourceText: item.sourceText,
        evidenceFound: item.evidenceFound,
        verificationStatus,
        confidence,
        exactMatch: isExact,
        discoveredAt: now,
        lastVerifiedAt: now,
      });

      results.push(contact);
    }

    if (results.length > 0) {
      logger.info(
        `[EmailService] Persisted ${results.length} verified public contact(s) for ${companyName}: ${results
          .map((c) => c.email)
          .join(', ')}`
      );
    }

    return results;
  }

  /**
   * Lists contacts with optional filtering. Default view returns VERIFIED_PUBLIC only.
   */
  public listContacts(filter: ContactFilter = {}): Contact[] {
    let contacts = store.getContacts();

    // 1. Filter by Company
    if (filter.companyId) {
      contacts = contacts.filter((c) => c.companyId === filter.companyId);
    }

    // 2. Filter by Verification Status
    // By default, only show VERIFIED_PUBLIC unless specifically requested or 'ALL'
    const statusFilter = filter.verificationStatus;
    if (statusFilter && statusFilter !== 'ALL') {
      contacts = contacts.filter((c) => c.verificationStatus === statusFilter);
    } else if (!statusFilter) {
      // Default to strictly verified public contacts
      contacts = contacts.filter((c) => c.verificationStatus === 'VERIFIED_PUBLIC');
    }

    // 3. Filter by Email Type
    if (filter.emailType && filter.emailType !== 'ALL') {
      contacts = contacts.filter((c) => c.emailType === filter.emailType);
    }

    // 4. Filter by only With Email
    if (filter.onlyWithEmail) {
      contacts = contacts.filter(
        (c) => c.email && c.email.toLowerCase() !== 'not publicly available'
      );
    }

    // 5. Search query (matches email, name, role, company name, domain)
    if (filter.search && filter.search.trim()) {
      const q = filter.search.trim().toLowerCase();
      contacts = contacts.filter((c) => {
        return (
          c.email.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.role && c.role.toLowerCase().includes(q)) ||
          (c.domain && c.domain.toLowerCase().includes(q)) ||
          c.sourceUrl.toLowerCase().includes(q)
        );
      });
    }

    return contacts;
  }

  /**
   * Live re-verification of an individual contact against its source URL
   */
  public async verifyContactLive(contactId: string): Promise<Contact | null> {
    const contacts = store.getContacts();
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return null;

    const now = new Date().toISOString();

    if (!contact.sourceUrl || !contact.sourceUrl.startsWith('http')) {
      contact.verificationStatus = 'REJECTED';
      contact.exactMatch = false;
      contact.lastVerifiedAt = now;
      store.persist();
      return contact;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(contact.sourceUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        contact.verificationStatus = 'SOURCE_REMOVED';
        contact.exactMatch = false;
        contact.lastVerifiedAt = now;
        store.persist();
        return contact;
      }

      const html = await res.text();

      // Check if email or named profile exists
      if (contact.email && contact.email.toLowerCase() !== 'not publicly available') {
        const isMatch = verifyExactMatchInSource(contact.email, html);
        if (isMatch) {
          contact.verificationStatus = 'VERIFIED_PUBLIC';
          contact.exactMatch = true;
          contact.confidence = calculateSourceQualityScore(contact.sourceType, contact.email, contact.domain, true);
        } else {
          contact.verificationStatus = 'SOURCE_REMOVED';
          contact.exactMatch = false;
        }
      } else if (contact.name) {
        const hasName = html.toLowerCase().includes(contact.name.toLowerCase());
        if (hasName) {
          contact.verificationStatus = 'VERIFIED_PUBLIC';
          contact.exactMatch = true;
        } else {
          contact.verificationStatus = 'SOURCE_REMOVED';
          contact.exactMatch = false;
        }
      }

      contact.lastVerifiedAt = now;
      store.persist();
      return contact;
    } catch (err: any) {
      logger.warn(`[EmailService] Live verification failed for ${contact.email} on ${contact.sourceUrl}: ${err?.message}`);
      contact.lastVerifiedAt = now;
      // If network timed out, keep status or set NEEDS_REVIEW
      if (contact.verificationStatus !== 'VERIFIED_PUBLIC') {
        contact.verificationStatus = 'NEEDS_REVIEW';
      }
      store.persist();
      return contact;
    }
  }

  /**
   * Bulk verification of all active contacts
   */
  public async verifyAllContacts(): Promise<{ total: number; verified: number; removed: number; unverified: number }> {
    const contacts = store.getContacts();
    let verifiedCount = 0;
    let removedCount = 0;
    let unverifiedCount = 0;

    for (const c of contacts) {
      const updated = await this.verifyContactLive(c.id);
      if (updated?.verificationStatus === 'VERIFIED_PUBLIC') {
        verifiedCount++;
      } else if (updated?.verificationStatus === 'SOURCE_REMOVED') {
        removedCount++;
      } else {
        unverifiedCount++;
      }
    }

    return {
      total: contacts.length,
      verified: verifiedCount,
      removed: removedCount,
      unverified: unverifiedCount,
    };
  }

  /**
   * Clean and audit existing contacts in the database:
   * Strips out or flags any contact that lacks exact source proof
   */
  public cleanExistingContacts(): { total: number; verified: number; rejected: number; cleaned: number } {
    const contacts = store.getContacts();
    let verifiedCount = 0;
    let rejectedCount = 0;
    let cleanedCount = 0;
    const now = new Date().toISOString();

    for (const c of contacts) {
      const isNamedPersonWithoutEmail =
        (!c.email || c.email.toLowerCase() === 'not publicly available') && Boolean(c.name && c.name.trim().length > 0);

      if (isNamedPersonWithoutEmail) {
        c.verificationStatus = 'VERIFIED_PUBLIC';
        c.exactMatch = true;
        c.lastVerifiedAt = now;
        verifiedCount++;
        continue;
      }

      // Check if valid email syntax
      if (!isValidEmail(c.email)) {
        c.verificationStatus = 'REJECTED';
        c.exactMatch = false;
        c.confidence = 0;
        c.lastVerifiedAt = now;
        rejectedCount++;
        cleanedCount++;
        continue;
      }

      // If contact was an unevidenced or guessed email without source evidence
      if (!c.sourceUrl || (!c.sourceText && !c.evidenceFound)) {
        c.verificationStatus = 'REJECTED';
        c.exactMatch = false;
        c.confidence = 0;
        c.lastVerifiedAt = now;
        rejectedCount++;
        cleanedCount++;
        continue;
      }

      // Valid verified email
      c.verificationStatus = 'VERIFIED_PUBLIC';
      c.exactMatch = true;
      if (!c.confidence || c.confidence === 0) {
        c.confidence = calculateSourceQualityScore(c.sourceType, c.email, c.domain, true);
      }
      c.lastVerifiedAt = now;
      verifiedCount++;
    }

    store.persist();

    return {
      total: contacts.length,
      verified: verifiedCount,
      rejected: rejectedCount,
      cleaned: cleanedCount,
    };
  }

  /**
   * Detailed breakdown stats of stored contacts
   */
  public getContactStats() {
    const contacts = store.getContacts();
    const verifiedPublic = contacts.filter(
      (c) => c.verificationStatus === 'VERIFIED_PUBLIC' && c.email && c.email.toLowerCase() !== 'not publicly available'
    );
    const employees = contacts.filter((c) => c.name && c.name.trim().length > 0);
    const careers = verifiedPublic.filter((c) => c.emailType === 'CAREERS' || c.emailType === 'HIRING');
    const talent = verifiedPublic.filter((c) => c.emailType === 'TALENT');
    const recruiting = verifiedPublic.filter((c) => c.emailType === 'RECRUITING');
    const hr = verifiedPublic.filter((c) => c.emailType === 'HR');
    const founders = verifiedPublic.filter((c) => c.emailType === 'FOUNDER');
    const general = verifiedPublic.filter((c) => c.emailType === 'GENERAL_COMPANY' || c.emailType === 'GENERAL_CONTACT');
    const unverified = contacts.filter((c) => c.verificationStatus === 'PUBLIC_UNVERIFIED' || c.verificationStatus === 'NEEDS_REVIEW');
    const removed = contacts.filter((c) => c.verificationStatus === 'SOURCE_REMOVED');
    const rejected = contacts.filter((c) => c.verificationStatus === 'REJECTED');

    return {
      total: contacts.length,
      verifiedPublic: verifiedPublic.length,
      employees: employees.length,
      careers: careers.length,
      talent: talent.length,
      recruiting: recruiting.length,
      hr: hr.length,
      founders: founders.length,
      general: general.length,
      unverified: unverified.length,
      removed: removed.length,
      rejected: rejected.length,
    };
  }
}

export const emailService = new EmailService();
