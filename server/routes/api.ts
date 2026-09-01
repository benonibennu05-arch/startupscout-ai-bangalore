import { Router } from 'express';
import { store } from '../database/store.ts';
import { researchQueue } from '../queue/researchQueue.ts';
import { healthRouter } from './health.routes.ts';
import { companiesRouter } from './companies.routes.ts';
import { opportunitiesRouter } from './opportunities.routes.ts';
import { contactsRouter } from './contacts.routes.ts';
import { researchRouter } from './research.routes.ts';
import { exportRouter } from './export.routes.ts';
import { settingsRouter } from './settings.routes.ts';
import { applicationsRouter } from './applications.routes.ts';
import { outreachRouter, emailRouter, outreachSettingsRouter } from './outreach.routes.ts';
import { authRouter } from './auth.routes.ts';
import { exportService } from '../services/export.service.ts';
import { verificationService } from '../services/verification.service.ts';
import { companyResearchService } from '../services/companyResearch.service.ts';
import { monitoringService } from '../services/monitoring.service.ts';

import { profileRouter } from './profile.routes.ts';

export const apiRouter = Router();

// Sub-routers
apiRouter.use('/health', healthRouter);
apiRouter.use('/companies', companiesRouter);
apiRouter.use('/opportunities', opportunitiesRouter);
apiRouter.use('/contacts', contactsRouter);
apiRouter.use('/research', researchRouter);
apiRouter.use('/export', exportRouter);
apiRouter.use('/settings/outreach', outreachSettingsRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/outreach', outreachRouter);
apiRouter.use('/email', emailRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/profile', profileRouter);
apiRouter.use('/', applicationsRouter);

// --- Direct top-level aliases for frontend compatibility ---
apiRouter.get('/status', (req, res) => {
  const location = (req.query.location as any) || undefined;
  res.json(researchQueue.getStatus(location));
});

apiRouter.get('/stats/company-stats', (_req, res) => {
  res.json(store.getCompanyStats());
});

apiRouter.get('/stats/source-stats', (_req, res) => {
  res.json(store.getSourceStats());
});

apiRouter.get('/stats', (req, res) => {
  const location = (req.query.location as string) || (req.query.sourceMap as string) || undefined;
  const baseStats = store.getStats(location);
  const companyStats = store.getCompanyStats();
  const sourceStats = store.getSourceStats();
  res.json({
    ...baseStats,
    companyStats,
    sourceStats,
  });
});

apiRouter.post('/sync/source', async (req, res) => {
  const scope = (req.body.scope || req.body.source || 'BOTH') as any;
  try {
    const result = await store.syncSource(scope);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Sync failed' });
  }
});

apiRouter.post('/sync/sources', async (req, res) => {
  const scope = (req.body.scope || req.body.source || 'BOTH') as any;
  try {
    const result = await store.syncSource(scope);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Sync failed' });
  }
});

apiRouter.get('/events', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  res.json(store.getEvents(limit));
});

// SSE Live Event Stream
apiRouter.get('/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial state
  res.write(`data: ${JSON.stringify({ event: 'INITIAL_STATE', payload: researchQueue.getStatus() })}\n\n`);

  const unsubscribe = researchQueue.subscribe((data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// --- Monitoring Endpoints ---
apiRouter.get('/monitoring/status', (req, res) => {
  const runs = store.getMonitoringRuns();
  const sources = store.getMonitoringSources();
  res.json({
    success: true,
    lastRun: runs[0] || null,
    totalSources: sources.length,
    sources,
    recentRuns: runs.slice(0, 10),
  });
});

apiRouter.post('/monitoring/trigger', async (req, res) => {
  const limit = req.body.limit ? parseInt(req.body.limit, 10) : 10;
  try {
    const run = await monitoringService.runMonitoringCycle(limit);
    res.json({ success: true, run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Monitoring run failed' });
  }
});

// --- Notifications Endpoints ---
apiRouter.get('/notifications', (req, res) => {
  const list = store.getNotifications();
  res.json({
    success: true,
    notifications: list,
    unreadCount: list.filter((n) => !n.read).length,
  });
});

apiRouter.patch('/notifications/:id/read', (req, res) => {
  store.markNotificationRead(req.params.id);
  res.json({ success: true });
});

apiRouter.post('/notifications/read-all', (req, res) => {
  store.markAllNotificationsRead();
  res.json({ success: true });
});

// --- Research Runs ---
apiRouter.get('/runs', (req, res) => {
  res.json(store.getResearchRuns());
});

apiRouter.get('/runs/:id', (req, res) => {
  const run = store.getResearchRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

// --- Errors ---
apiRouter.get('/errors', (req, res) => {
  res.json(store.getResearchErrors());
});

apiRouter.post('/errors/:id/resolve', (req, res) => {
  store.resolveError(req.params.id);
  res.json({ success: true });
});

