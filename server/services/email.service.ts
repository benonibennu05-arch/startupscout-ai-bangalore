import { Contact, EmailType } from '../types.ts';
import { store } from '../database/store.ts';
import { extractPublicEmailsFromHtml, classifyEmailType } from '../extractors/email.extractor.ts';
import { logger } from '../utils/logger.ts';

export class EmailService {
  /**
   * Extract public recruitment emails strictly from page HTML
   */
  public extractAndPersistEmails(
    html: string,
    sourceUrl: string,
    companyId: string,
    companyName: string
  ): Contact[] {
    const extracted = extractPublicEmailsFromHtml(html, sourceUrl);
    const results: Contact[] = [];

    for (const item of extracted) {
      const contact = store.upsertContact({
        companyId,
        companyName,
        email: item.email,
        emailType: item.emailType,
        sourceUrl: item.sourceUrl,
        verified: true,
      });
      results.push(contact);
    }

    if (results.length > 0) {
      logger.info(`Persisted ${results.length} public recruitment contact(s) for ${companyName}: ${results.map((c) => c.email).join(', ')}`);
    }

    return results;
  }

  public listContacts(companyId?: string): Contact[] {
    const contacts = store.getContacts();
    if (companyId) {
      return contacts.filter((c) => c.companyId === companyId);
    }
    return contacts;
  }
}

export const emailService = new EmailService();
