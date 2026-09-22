import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes/api.ts';
import { startupMapService } from './server/services/startupMap.service.ts';
import { store } from './server/database/store.ts';
import { monitoringService } from './server/services/monitoring.service.ts';
import { sqliteDb } from './server/database/sqlite.ts';

dotenv.config();

const app = express();
const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount API routes
app.use('/api', apiRouter);

async function startServer() {
  // 1. Safe Startup Sequence - Check SQLite Database Integrity First
  const dbHealth = sqliteDb.healthCheck();
  if (!dbHealth.healthy) {
    console.error('====================================================');
    console.error('[CRITICAL] DATABASE CORRUPTED - REPAIR REQUIRED');
    console.error(`Status: ${dbHealth.integrity}, Error: ${dbHealth.error}`);
    console.error('[CRITICAL] Background discovery and scheduler have been disabled to prevent further corruption.');
    console.error('====================================================');
  } else {
    console.log(`[Startup] SQLite database integrity check passed (${dbHealth.integrity}). Total companies: ${dbHealth.totalCompanies}, opportunities: ${dbHealth.totalOpportunities}`);
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/data/**',
            '**/backups/**',
            '**/fixtures/**',
            '**/*.db*',
            '**/*.db-wal*',
            '**/*.db-shm*',
            '**/*.sqlite*',
            '**/database.json*',
            '**/server/**',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StartupScout AI Server active on http://0.0.0.0:${PORT} [${isProd ? 'production' : 'development'}]`);

    // Only start background workers if database is healthy
    if (dbHealth.healthy) {
      setTimeout(() => {
        startupMapService.discoverCompanies('ALL').catch((err) => {
          console.warn('Initial background discovery error:', err);
        });
      }, 1000);

      // Start continuous background monitoring scheduler
      monitoringService.startBackgroundScheduler(30);
    } else {
      console.warn('[Startup] Background workers halted because database is corrupted.');
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

