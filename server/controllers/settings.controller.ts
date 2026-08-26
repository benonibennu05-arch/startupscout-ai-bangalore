import { Request, Response } from 'express';
import { store } from '../database/store.ts';
import { relevanceService } from '../services/relevance.service.ts';

export class SettingsController {
  public getSettings(req: Request, res: Response) {
    const settings = store.getSettings();
    res.json({
      success: true,
      settings,
    });
  }

  public updateSettings(req: Request, res: Response) {
    const updated = store.updateSettings(req.body || {});
    // Re-score opportunities dynamically
    relevanceService.rescoreAllOpportunities();

    res.json({
      success: true,
      message: 'Settings updated successfully.',
      settings: updated,
    });
  }
}

export const settingsController = new SettingsController();
