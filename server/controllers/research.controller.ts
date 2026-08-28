import { Request, Response } from 'express';
import { researchQueue } from '../queue/researchQueue.ts';
import { store } from '../database/store.ts';
import { ResearchMode } from '../types.ts';

export class ResearchController {
  public getStatus(req: Request, res: Response) {
    res.json({
      success: true,
      ...researchQueue.getStatus(),
    });
  }

  public getRuns(req: Request, res: Response) {
    const runs = store.getResearchRuns();
    res.json({
      success: true,
      count: runs.length,
      runs,
    });
  }

  public getRunById(req: Request, res: Response) {
    const { id } = req.params;
    const run = store.getResearchRun(id);
    if (!run) {
      return res.status(404).json({ success: false, error: 'Research run not found' });
    }
    res.json({ success: true, run });
  }

  public async startTest10(req: Request, res: Response) {
    try {
      const mode = (req.body?.mode as ResearchMode) || 'FAST';
      const concurrency = req.body?.concurrency ? Number(req.body.concurrency) : 10;
      const status = await researchQueue.startTest10(mode, concurrency);
      res.json({
        success: true,
        message: `10-Company Parallel Test Batch started (${concurrency} workers, ${mode} mode).`,
        status,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Failed to start test batch' });
    }
  }

  public async startFull(req: Request, res: Response) {
    try {
      const mode = (req.body?.mode as ResearchMode) || 'FAST';
      const concurrency = req.body?.concurrency ? Number(req.body.concurrency) : 10;
      const forceRefresh = Boolean(req.body?.forceRefresh);
      const status = await researchQueue.startFullResearch(mode, concurrency, forceRefresh);
      res.json({
        success: true,
        message: `Full Bangalore Startup Map parallel research started (${concurrency} workers, ${mode} mode).`,
        status,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Failed to start research' });
    }
  }

  public pause(req: Request, res: Response) {
    const status = researchQueue.pauseResearch();
    res.json({
      success: true,
      message: 'Research paused.',
      status,
    });
  }

  public resume(req: Request, res: Response) {
    const status = researchQueue.resumeResearch();
    res.json({
      success: true,
      message: 'Research resumed.',
      status,
    });
  }

  public stop(req: Request, res: Response) {
    const status = researchQueue.stopResearch();
    res.json({
      success: true,
      message: 'Research stopped.',
      status,
    });
  }

  public retryFailed(req: Request, res: Response) {
    const concurrency = req.body?.concurrency ? Number(req.body.concurrency) : 10;
    const status = researchQueue.retryFailed(concurrency);
    res.json({
      success: true,
      message: 'Retrying failed companies with parallel workers.',
      status,
    });
  }

  public async startIncremental(req: Request, res: Response) {
    try {
      const mode = (req.body?.mode as ResearchMode) || 'FAST';
      const concurrency = req.body?.concurrency ? Number(req.body.concurrency) : 10;
      const status = await researchQueue.startIncrementalResearch(mode, concurrency);
      res.json({
        success: true,
        message: `Incremental update research started (${concurrency} workers, ${mode} mode).`,
        status,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Failed to start incremental research' });
    }
  }

  public async startNewCompanies(req: Request, res: Response) {
    try {
      const mode = (req.body?.mode as ResearchMode) || 'FAST';
      const concurrency = req.body?.concurrency ? Number(req.body.concurrency) : 10;
      const status = await researchQueue.startNewCompaniesResearch(mode, concurrency);
      res.json({
        success: true,
        message: `New companies research started (${concurrency} workers, ${mode} mode).`,
        status,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Failed to start new companies research' });
    }
  }

  public startFailedOnly(req: Request, res: Response) {
    return this.retryFailed(req, res);
  }

  public async verifyAll(req: Request, res: Response) {
    try {
      const status = await researchQueue.verifyAll();
      res.json({
        success: true,
        message: 'Opportunity link verification started in background.',
        status,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || 'Verification failed to start' });
    }
  }

  public setConcurrency(req: Request, res: Response) {
    const concurrency = Number(req.body?.concurrency);
    if (!concurrency || isNaN(concurrency)) {
      return res.status(400).json({ success: false, error: 'Invalid concurrency number' });
    }
    researchQueue.setConcurrency(concurrency);
    res.json({ success: true, status: researchQueue.getStatus() });
  }

  public setMode(req: Request, res: Response) {
    const mode = req.body?.mode as ResearchMode;
    if (!['FAST', 'BALANCED', 'DEEP'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Invalid mode' });
    }
    researchQueue.setMode(mode);
    res.json({ success: true, status: researchQueue.getStatus() });
  }

  public getEvents(req: Request, res: Response) {
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    // Server-Sent Events (SSE)
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      // Send initial snapshot
      const recentEvents = store.getEvents(20);
      res.write(`data: ${JSON.stringify({ type: 'SNAPSHOT', events: recentEvents })}\n\n`);

      const unsubscribe = researchQueue.subscribe((data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      });

      req.on('close', () => {
        unsubscribe();
      });
      return;
    }

    // Standard JSON response
    const events = store.getEvents(limit);
    res.json({
      success: true,
      count: events.length,
      events,
    });
  }
}

export const researchController = new ResearchController();
