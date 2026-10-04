import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../../database/connection';
import { User } from '../../shared/types';
import { UserRow, SessionRow } from '../../database/types';
import { AuditService, auditService } from '../audit/audit.service';

interface LoginAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

export class AuthService {
  private loginAttempts = new Map<string, LoginAttempt>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  private auditService: AuditService;

  constructor(
    private db: DatabaseSync = getDb(),
    audService?: AuditService
  ) {
    this.auditService = audService || new AuditService(db);
  }

  private checkRateLimit(key: string): void {
    const attempt = this.loginAttempts.get(key);
    if (attempt && attempt.lockedUntil && attempt.lockedUntil > Date.now()) {
      const waitMins = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      throw new Error(`Too many failed login attempts. Please try again in ${waitMins} minute(s).`);
    }
  }

  private recordFailedAttempt(key: string): void {
    const attempt = this.loginAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
    attempt.count += 1;
    attempt.lastAttempt = Date.now();
    if (attempt.count >= this.MAX_ATTEMPTS) {
      attempt.lockedUntil = Date.now() + this.LOCKOUT_MS;
    }
    this.loginAttempts.set(key, attempt);
  }

  private resetAttempts(key: string): void {
    this.loginAttempts.delete(key);
  }

  public async login(identifier: string, password: string, ip = '127.0.0.1'): Promise<{ user: User; sessionId: string }> {
    const rateLimitKey = `${ip}:${identifier.toLowerCase()}`;
    this.checkRateLimit(rateLimitKey);

    const userRow = this.db.prepare(`
      SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
    `).get(identifier, identifier) as unknown as UserRow | undefined;

    if (!userRow) {
      this.recordFailedAttempt(rateLimitKey);
      throw new Error('Invalid username or password.');
    }

    const isMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!isMatch) {
      this.recordFailedAttempt(rateLimitKey);
      throw new Error('Invalid username or password.');
    }

    this.resetAttempts(rateLimitKey);

    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION_MS).toISOString();
    const createdAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, userRow.id, expiresAt, createdAt);

    this.auditService.log({
      actor: userRow.username,
      action: 'USER_LOGIN',
      entity: 'users',
      entityId: userRow.id
    });

    return {
      user: {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        role: userRow.role as 'owner' | 'staff',
        createdAt: userRow.created_at,
        updatedAt: userRow.updated_at
      },
      sessionId
    };
  }

  public validateSession(sessionId: string): User | null {
    if (!sessionId) return null;

    const sessionRow = this.db.prepare(`
      SELECT s.*, u.username, u.email, u.role, u.created_at as u_created_at, u.updated_at as u_updated_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > ?
    `).get(sessionId, new Date().toISOString()) as unknown as (SessionRow & {
      username: string;
      email: string;
      role: string;
      u_created_at: string;
      u_updated_at: string;
    }) | undefined;

    if (!sessionRow) {
      return null;
    }

    return {
      id: sessionRow.user_id,
      username: sessionRow.username,
      email: sessionRow.email,
      role: sessionRow.role as 'owner' | 'staff',
      createdAt: sessionRow.u_created_at,
      updatedAt: sessionRow.u_updated_at
    };
  }

  public logout(sessionId: string, username = 'user'): void {
    if (!sessionId) return;
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    this.auditService.log({
      actor: username,
      action: 'USER_LOGOUT',
      entity: 'sessions',
      entityId: sessionId
    });
  }

  public cleanupExpiredSessions(): void {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
  }
}

export const authService = new AuthService();
