import { Request, Response } from 'express';
import { exportService } from '../services/export.service.ts';
import { OpportunityType, ExperienceLevel, RemotePolicy, VerificationStatus, OpportunityStatus } from '../types.ts';

export class ExportController {
  public exportCsv(req: Request, res: Response) {
    const filter = {
      companyId: req.query.companyId as string | undefined,
      type: req.query.type as OpportunityType | undefined,
      experienceLevel: req.query.experienceLevel as ExperienceLevel | undefined,
      remote: req.query.remote as RemotePolicy | undefined,
      status: req.query.status as OpportunityStatus | undefined,
      verificationStatus: req.query.verificationStatus as VerificationStatus | undefined,
      minRelevance: req.query.minRelevance ? Number(req.query.minRelevance) : undefined,
      isFresherFriendly: req.query.isFresherFriendly === 'true',
      search: req.query.search as string | undefined,
    };

    const csvData = exportService.generateOpportunitiesCsv(filter);
    const filename = `bangalore_startup_opportunities_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  }

  public exportXlsx(req: Request, res: Response) {
    const filter = {
      companyId: req.query.companyId as string | undefined,
      type: req.query.type as OpportunityType | undefined,
      experienceLevel: req.query.experienceLevel as ExperienceLevel | undefined,
      remote: req.query.remote as RemotePolicy | undefined,
      status: req.query.status as OpportunityStatus | undefined,
      verificationStatus: req.query.verificationStatus as VerificationStatus | undefined,
      minRelevance: req.query.minRelevance ? Number(req.query.minRelevance) : undefined,
      isFresherFriendly: req.query.isFresherFriendly === 'true',
      search: req.query.search as string | undefined,
    };

    const buffer = exportService.generateWorkbookBuffer(filter);
    const filename = `bangalore_startup_scout_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}

export const exportController = new ExportController();
