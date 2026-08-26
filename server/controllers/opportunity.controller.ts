import { Request, Response } from 'express';
import { opportunityService } from '../services/opportunity.service.ts';
import { verificationService } from '../services/verification.service.ts';
import { OpportunityType, ExperienceLevel, RemotePolicy, VerificationStatus, OpportunityStatus } from '../types.ts';

export class OpportunityController {
  public getAll(req: Request, res: Response) {
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

    const opportunities = opportunityService.listOpportunities(filter);

    res.json({
      success: true,
      count: opportunities.length,
      opportunities,
    });
  }

  public getById(req: Request, res: Response) {
    const { id } = req.params;
    const opp = opportunityService.getOpportunityById(id);
    if (!opp) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }
    res.json({ success: true, opportunity: opp });
  }

  public async verifySingle(req: Request, res: Response) {
    const { id } = req.params;
    const opp = opportunityService.getOpportunityById(id);
    if (!opp) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }

    try {
      const verified = await verificationService.verifyOpportunity(opp);
      res.json({ success: true, opportunity: verified });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Verification failed' });
    }
  }

  public async verifyAll(req: Request, res: Response) {
    try {
      const result = await verificationService.verifyAllOpportunities();
      res.json({
        success: true,
        message: `Verified all opportunities.`,
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Batch verification failed' });
    }
  }
}

export const opportunityController = new OpportunityController();
