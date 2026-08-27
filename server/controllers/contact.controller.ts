import { Request, Response } from 'express';
import { emailService } from '../services/email.service.ts';
import { EmailType, EmailVerificationStatus } from '../types.ts';

export class ContactController {
  public getAll(req: Request, res: Response) {
    const { companyId, emailType, verificationStatus, search, onlyWithEmail } = req.query;

    const contacts = emailService.listContacts({
      companyId: companyId ? String(companyId) : undefined,
      emailType: emailType ? (String(emailType) as EmailType | 'ALL') : undefined,
      verificationStatus: verificationStatus
        ? (String(verificationStatus) as EmailVerificationStatus | 'ALL')
        : 'VERIFIED_PUBLIC',
      search: search ? String(search) : undefined,
      onlyWithEmail: onlyWithEmail === 'true',
    });

    res.json({
      success: true,
      total: contacts.length,
      contacts,
    });
  }

  public getStats(req: Request, res: Response) {
    const stats = emailService.getContactStats();
    res.json({
      success: true,
      stats,
    });
  }

  public async verifySingle(req: Request, res: Response) {
    const { id } = req.params;
    const contact = await emailService.verifyContactLive(id);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    res.json({
      success: true,
      contact,
    });
  }

  public async verifyAll(req: Request, res: Response) {
    const summary = await emailService.verifyAllContacts();
    res.json({
      success: true,
      summary,
    });
  }

  public clean(req: Request, res: Response) {
    const summary = emailService.cleanExistingContacts();
    res.json({
      success: true,
      summary,
    });
  }
}

export const contactController = new ContactController();
