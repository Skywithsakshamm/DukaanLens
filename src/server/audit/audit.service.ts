import crypto from 'node:crypto';
import { DatabaseSync, getDb } from '../../database/connection';
import { AuditLog } from '../../shared/types';
import { AuditLogRow } from '../../database/types';

export class AuditService {
  constructor(private db: DatabaseSync = getDb()) {}

  public log(params: {
    actor: string;
    action: string;
    entity: string;
    entityId: string;
    beforeState?: any;
    afterState?: any;
  }): void {
    try {
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const beforeStr = params.beforeState ? JSON.stringify(params.beforeState) : null;
      const afterStr = params.afterState ? JSON.stringify(params.afterState) : null;

      this.db.prepare(`
        INSERT INTO audit_logs (id, actor, action, entity, entity_id, before_state, after_state, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        params.actor,
        params.action,
        params.entity,
        params.entityId,
        beforeStr,
        afterStr,
        timestamp
      );
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }

  public getRecentLogs(limit = 50): AuditLog[] {
    const rows = this.db.prepare(`
      SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as unknown as AuditLogRow[];

    return rows.map(r => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      beforeState: r.before_state || undefined,
      afterState: r.after_state || undefined,
      timestamp: r.timestamp
    }));
  }
}

export const auditService = new AuditService();
