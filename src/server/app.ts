import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config';
import { requestIdMiddleware } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { apiRouter } from './routes';
import { getAiProvider } from '../ai';
import { getDb } from '../database/connection';
import { HealthResponse } from '../shared/types';

export function createApp(): express.Application {
  const app = express();

  // Trust proxy for Embarko/production reverse proxy
  app.set('trust proxy', 1);

  // Middlewares
  app.use(requestIdMiddleware);
  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(cookieParser(config.sessionSecret));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health Check Endpoint (Embarko and monitoring compatible)
  const healthHandler = (_req: express.Request, res: express.Response) => {
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      const db = getDb();
      db.prepare('SELECT 1').get();
    } catch {
      dbStatus = 'error';
    }

    const aiProvider = getAiProvider();
    const isConfigured = aiProvider.isConfigured();
    const isMock = config.mockAi;

    const health: HealthResponse = {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      version: config.version,
      database: dbStatus,
      ai: isMock ? 'mock' : isConfigured ? 'configured' : 'unconfigured',
      model: aiProvider.getModelName(),
      dataDir: config.dataDir,
      timestamp: new Date().toISOString()
    };

    res.status(health.status === 'ok' ? 200 : 503).json(health);
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Mount API router
  app.use('/api', apiRouter);

  // Serve static client assets in production
  const clientDistPath = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    // Catch-all route to serve index.html for React SPA client routing
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    // If client build is not yet generated, serve a clean informative status page for API
    app.get('/', (_req, res) => {
      res.json({
        name: 'DukaanLens API',
        version: config.version,
        status: 'running',
        health: '/health',
        apiDocs: '/api'
      });
    });
  }

  // Central error handling
  app.use(errorHandler);

  return app;
}
