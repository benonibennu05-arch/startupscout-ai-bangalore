import { Request, Response } from 'express';
import { emailService } from '../services/email.service.ts';

export class ContactController {
  public getAll(req: Request, res: Response) {
    const { companyId } = req.query;
    const contacts = emailService.listContacts(companyId ? String(companyId) : undefined);

    res.json({
      success: true,
      count: contacts.length,
      contacts,
    });
  }
}

export const contactController = new ContactController();
