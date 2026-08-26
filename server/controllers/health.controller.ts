import { Request, Response } from 'express';
import { store } from '../database/store.ts';

export class HealthController {
  public getHealth(req: Request, res: Response) {
    const stats = store.getStats();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      backend: true,
      database: {
        healthy: true,
        companies: stats.totalCompanies,
        opportunities: stats.totalOpportunities,
        contacts: stats.publicEmails,
      },
      geminiAi: {
        configured: hasGeminiKey,
        mode: hasGeminiKey ? 'Gemini 3.7 Flash Live Server' : 'Heuristic Rule-Engine Active',
      },
      crawler: {
        active: true,
        target: 'https://www.bangalorestartupmap.com/',
      },
      uptimeSeconds: process.uptime(),
    });
  }
}

export const healthController = new HealthController();
