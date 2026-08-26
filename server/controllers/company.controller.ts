import { Request, Response } from 'express';
import { store } from '../database/store.ts';
import { startupMapService } from '../services/startupMap.service.ts';
import { researchQueue } from '../queue/researchQueue.ts';

export class CompanyController {
  public getAll(req: Request, res: Response) {
    const { status, sector, stage, search } = req.query;
    let companies = store.getCompanies();

    if (status) {
      companies = companies.filter((c) => c.status === status);
    }
    if (sector) {
      companies = companies.filter((c) => c.sector?.toLowerCase() === String(sector).toLowerCase());
    }
    if (stage) {
      companies = companies.filter((c) => c.startupStage?.toLowerCase() === String(stage).toLowerCase());
    }
    if (search) {
      const q = String(search).toLowerCase();
      companies = companies.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.sector?.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    res.json({
      success: true,
      count: companies.length,
      companies,
    });
  }

  public getById(req: Request, res: Response) {
    const { id } = req.params;
    const company = store.getCompany(id);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const opportunities = store.getOpportunities().filter((o) => o.companyId === id);
    const contacts = store.getContacts().filter((c) => c.companyId === id);

    res.json({
      success: true,
      company,
      opportunities,
      contacts,
    });
  }

  public async discover(req: Request, res: Response) {
    try {
      const result = await startupMapService.discoverCompanies();
      res.json({
        success: true,
        message: `Successfully crawled Bangalore Startup Map.`,
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Discovery failed' });
    }
  }

  public async researchSingle(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await researchQueue.researchSingle(id);
      res.json({
        success: true,
        message: `Research completed for company.`,
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Research failed' });
    }
  }
}

export const companyController = new CompanyController();
