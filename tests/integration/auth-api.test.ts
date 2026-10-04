import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { runMigrations } from '../../src/database/migrations';
import { AuthService } from '../../src/server/auth/auth.service';

describe('Authentication & Session Management', () => {
  let db: Database.Database;
  let authService: AuthService;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    authService = new AuthService(db);

    // Create user
    const passwordHash = bcrypt.hashSync('dukaan123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
      VALUES ('u-1', 'admin', 'admin@dukaanlens.local', ?, 'owner', '2026-10-04', '2026-10-04')
    `).run(passwordHash);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should authenticate valid user and create valid session', async () => {
    const { user, sessionId } = await authService.login('admin', 'dukaan123', '127.0.0.1');
    expect(user.username).toBe('admin');
    expect(sessionId).toBeDefined();

    const validatedUser = authService.validateSession(sessionId);
    expect(validatedUser).toBeDefined();
    expect(validatedUser?.id).toBe('u-1');
  });

  it('should reject invalid password', async () => {
    await expect(authService.login('admin', 'wrongpassword', '127.0.0.1')).rejects.toThrow(/Invalid/);
  });

  it('should revoke session upon logout', async () => {
    const { sessionId } = await authService.login('admin', 'dukaan123', '127.0.0.1');
    expect(authService.validateSession(sessionId)).toBeDefined();

    authService.logout(sessionId, 'admin');
    expect(authService.validateSession(sessionId)).toBeNull();
  });
});
