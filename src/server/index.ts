import { createApp } from './app';
import { config, validateEnvironment } from './config';
import { getDataDir, closeDb } from '../database/connection';
import { runMigrations } from '../database/migrations';
import { seedDemoData } from '../database/seed';

async function bootstrap(): Promise<void> {
  console.log('====================================================');
  console.log(`  DukaanLens v${config.version} — Single-Shop MVP Server`);
  console.log('  AI Inventory Assistant for Small Indian Businesses');
  console.log('====================================================');

  validateEnvironment();

  // Initialize data directory & database
  const dataDir = getDataDir();
  console.log(`[DATA] Durable storage initialized at: ${dataDir}`);

  // Run migrations
  try {
    runMigrations();
    console.log('[DB] SQLite migrations applied successfully.');
  } catch (err) {
    console.error('[DB ERROR] Failed to apply migrations:', err);
    process.exit(1);
  }

  // Auto-seed demo dataset if fresh
  try {
    seedDemoData();
    console.log('[DB] Shop catalog and demo data verified.');
  } catch (err) {
    console.warn('[DB WARNING] Auto-seed check finished:', err);
  }

  const app = createApp();
  const port = config.port;
  const host = '0.0.0.0';

  const server = app.listen(port, host, () => {
    console.log(`[SERVER] DukaanLens is live on http://${host}:${port}`);
    console.log(`[HEALTH] Health check available at: http://${host}:${port}/health`);
    console.log(`[AI] Configured model: ${config.gemmaModel} (Mock mode: ${config.mockAi})`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[SERVER] Shutting down gracefully...');
    server.close(() => {
      closeDb();
      console.log('[SERVER] Database closed. Goodbye.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[SERVER] Forced shutdown after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[FATAL STARTUP ERROR]', err);
  process.exit(1);
});
