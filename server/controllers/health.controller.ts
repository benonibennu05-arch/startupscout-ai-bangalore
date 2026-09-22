import { Request, Response } from 'express';
import { store } from '../database/store.ts';
import { sqliteDb } from '../database/sqlite.ts';

export class HealthController {
  public getHealth(req: Request, res: Response) {
    const dbHealth = sqliteDb.healthCheck();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' && process.env.GEMINI_API_KEY.trim() !== '');
    const hasOllama = Boolean(process.env.OLLAMA_BASE_URL);
    const outreachSettings = store.getOutreachSettings();

    const statusCode = dbHealth.healthy ? 200 : 503;

    res.status(statusCode).json({
      status: dbHealth.healthy ? 'healthy' : 'corrupted',
      timestamp: new Date().toISOString(),
      backend: true,
      database: {
        status: dbHealth.healthy ? 'healthy' : 'corrupted',
        healthy: dbHealth.healthy,
        integrity: dbHealth.integrity,
        quickCheck: dbHealth.quickCheck,
        path: dbHealth.databasePath,
        sizeBytes: dbHealth.databaseSizeBytes,
        companies: dbHealth.totalCompanies,
        opportunities: dbHealth.totalOpportunities,
        contacts: dbHealth.totalContacts,
        error: dbHealth.error || null,
      },
      ai: {
        provider: hasGeminiKey ? 'gemini' : hasOllama ? 'ollama' : 'none',
        geminiConfigured: hasGeminiKey,
        geminiStatus: hasGeminiKey ? 'configured' : 'not_configured',
        researchStatus: 'ACTIVE',
        mode: hasGeminiKey
          ? 'Gemini 3.7 Flash Enrichment Active'
          : hasOllama
          ? 'Local Ollama Active'
          : 'Deterministic Heuristic Mode (No AI required)',
      },
      crawler: {
        active: dbHealth.healthy,
        targets: [
          'https://www.bangalorestartupmap.com/',
          'https://hyderabadstartupsmap.lol/',
          'https://wherewework.co.in/',
          'https://frontlinesmedia.in/302-company-career-pages/',
        ],
      },
      gmail: {
        connected: Boolean(outreachSettings?.gmailConnected),
        account: outreachSettings?.gmailAccountEmail || null,
        targetAccount: 'tejamatta05@gmail.com',
      },
      uptimeSeconds: process.uptime(),
    });
  }
}

export const healthController = new HealthController();

