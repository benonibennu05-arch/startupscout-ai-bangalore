import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes/api.ts';
import { startupMapService } from './server/services/startupMap.service.ts';
import { store } from './server/database/store.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mount API routes
app.use('/api', apiRouter);

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StartupScout AI Server active on http://0.0.0.0:${PORT} [${isProd ? 'production' : 'development'}]`);

    // Dynamically index all Bangalore Startup Map entries if catalog is not yet fully populated
    if (store.getCompanies().length < 100) {
      setTimeout(() => {
        startupMapService.discoverCompanies().catch((err) => {
          console.warn('Initial background discovery error:', err);
        });
      }, 500);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
