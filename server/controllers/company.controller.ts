import { Request, Response } from 'express';
import { store } from '../database/store.ts';
import { startupMapService } from '../services/startupMap.service.ts';
import { researchQueue } from '../queue/researchQueue.ts';
import { StartupMapSource } from '../types.ts';

export class CompanyController {
  public getAll(req: Request, res: Response) {
    const { status, sector, stage, search, location, sourceMap } = req.query;
    let companies = store.getCompanies({
      location: (location as string) || (sourceMap as string),
      status: status as string,
      sector: sector as string,
      stage: stage as string,
      search: search as string,
    });

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
      const source = (req.body?.source as StartupMapSource | 'BOTH') || (req.query.location as any) || 'BANGALORE';
      const result = await startupMapService.discoverCompanies(source);
      const sourceLabel = source === 'HYDERABAD' ? 'Hyderabad Startups Map (https://www.hyderabadstartupsmap.lol/)' : source === 'BOTH' ? 'Bangalore & Hyderabad Maps' : 'Bangalore Startup Map (https://www.bangalorestartupmap.com/)';
      res.json({
        success: true,
        message: `Successfully crawled ${sourceLabel}.`,
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

