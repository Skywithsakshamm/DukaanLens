import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance: DatabaseSync | null = null;
let currentDbPath: string | null = null;

export function getDataDir(): string {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(process.cwd(), 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const uploadsDir = path.join(dataDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  return dataDir;
}

export function getUploadsDir(): string {
  const dataDir = getDataDir();
  const uploadsDir = path.join(dataDir, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
}

export function getDatabasePath(): string {
  const dataDir = getDataDir();
  return path.join(dataDir, 'dukaanlens.db');
}

export function getDb(customPath?: string): DatabaseSync {
  const dbPath = customPath || getDatabasePath();

  if (dbInstance && currentDbPath === dbPath) {
    return dbInstance;
  }

  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
  }

  currentDbPath = dbPath;
  dbInstance = new DatabaseSync(dbPath);

  // Performance and integrity pragmas
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA busy_timeout = 5000;');
  
  // WAL mode is durable and fast (if not in-memory)
  if (dbPath !== ':memory:') {
    try {
      dbInstance.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // WAL may not be supported on some network drives; fallback to DELETE mode
    }
  }

  return dbInstance;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
    currentDbPath = null;
  }
}

let activeTransactionDepth = 0;

/**
 * Execute a callback within an atomic SQLite transaction.
 * Supports nesting safely: nested calls run inside the outer transaction.
 */
export function runTransaction<T>(db: DatabaseSync, fn: () => T): T {
  if (activeTransactionDepth > 0) {
    return fn();
  }

  activeTransactionDepth++;
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback error if already aborted
    }
    throw error;
  } finally {
    activeTransactionDepth--;
  }
}
