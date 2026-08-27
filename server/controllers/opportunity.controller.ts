import { Request, Response } from 'express';
import { opportunityService } from '../services/opportunity.service.ts';
import { verificationService } from '../services/verification.service.ts';
import { store } from '../database/store.ts';
import {
  OpportunityType,
  ExperienceLevel,
  RemotePolicy,
  VerificationStatus,
  OpportunityStatus,
  OpportunityCategory,
  AiMlRelevance,
} from '../types.ts';

export class OpportunityController {
  public getAll(req: Request, res: Response) {
    const filter = {
      companyId: req.query.companyId as string | undefined,
      category: req.query.category as OpportunityCategory | undefined,
      aiMlRelevance: req.query.aiMlRelevance as AiMlRelevance | undefined,
      type: req.query.type as OpportunityType | undefined,
      experienceLevel: req.query.experienceLevel as ExperienceLevel | undefined,
      remote: req.query.remote as RemotePolicy | undefined,
      status: req.query.status as OpportunityStatus | undefined,
      verificationStatus: req.query.verificationStatus as VerificationStatus | undefined,
      minRelevance: req.query.minRelevance ? Number(req.query.minRelevance) : undefined,
      isFresherFriendly: req.query.isFresherFriendly === 'true',
      isInternship: req.query.isInternship === 'true',
      isNew: req.query.isNew === 'true',
      isSaved: req.query.isSaved === 'true',
      userApplicationStatus: req.query.userApplicationStatus as any,
      search: req.query.search as string | undefined,
      sort: (req.query.sort as any) || 'relevance',
    };

    const opportunities = opportunityService.listOpportunities(filter);

    res.json({
      success: true,
      count: opportunities.length,
      opportunities,
    });
  }

  public getSaved(req: Request, res: Response) {
    const saved = store.getSavedJobs();
    res.json({
      success: true,
      count: saved.length,
      savedJobs: saved,
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

  public save(req: Request, res: Response) {
    const { id } = req.params;
    const { priority, notes } = req.body;
    try {
      const record = opportunityService.saveJob(id, priority, notes);
      res.json({ success: true, savedJob: record });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Could not save job' });
    }
  }

  public unsave(req: Request, res: Response) {
    const { id } = req.params;
    const removed = opportunityService.unsaveJob(id);
    res.json({ success: true, unsaved: removed });
  }

  public updateStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    const updated = opportunityService.updateJobStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Opportunity not found' });
    }
    res.json({ success: true, opportunity: updated });
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

