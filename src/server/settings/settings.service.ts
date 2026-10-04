import { DatabaseSync } from 'node:sqlite';
import { getDb, runTransaction } from '../../database/connection';
import { Shop } from '../../shared/types';
import { ShopRow } from '../../database/types';
import { config } from '../config';
import { getAiProvider } from '../../ai';
import { auditService } from '../audit/audit.service';

export class SettingsService {
  constructor(private db: DatabaseSync = getDb()) {}

  public getShop(): Shop | null {
    const row = this.db.prepare('SELECT * FROM shop LIMIT 1').get() as unknown as ShopRow | undefined;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      ownerName: row.owner_name,
      phone: row.phone,
      address: row.address,
      gstin: row.gstin || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public updateShop(data: {
    name?: string;
    ownerName?: string;
    phone?: string;
    address?: string;
    gstin?: string;
    actor?: string;
  }): Shop {
    const existing = this.getShop();
    const now = new Date().toISOString();
    const actor = data.actor || 'user';

    return runTransaction(this.db, () => {
      if (existing) {
        this.db.prepare(`
          UPDATE shop SET
            name = COALESCE(?, name),
            owner_name = COALESCE(?, owner_name),
            phone = COALESCE(?, phone),
            address = COALESCE(?, address),
            gstin = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          data.name ?? null,
          data.ownerName ?? null,
          data.phone ?? null,
          data.address ?? null,
          data.gstin !== undefined ? (data.gstin || null) : (existing.gstin || null),
          now,
          existing.id
        );

        auditService.log({
          actor,
          action: 'SHOP_SETTINGS_UPDATED',
          entity: 'shop',
          entityId: existing.id,
          afterState: data
        });

        return this.getShop()!;
      } else {
        const id = require('node:crypto').randomUUID();
        this.db.prepare(`
          INSERT INTO shop (id, name, owner_name, phone, address, gstin, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          data.name || 'My Dukaan',
          data.ownerName || 'Shop Owner',
          data.phone || '+91 90000 00000',
          data.address || 'Market Street',
          data.gstin || null,
          now,
          now
        );
        return this.getShop()!;
      }
    });
  }

  public getSystemSettingsInfo() {
    const aiProvider = getAiProvider();
    const isConfigured = aiProvider.isConfigured();
    const model = aiProvider.getModelName();
    const shop = this.getShop();

    return {
      shop,
      version: config.version,
      nodeEnv: config.nodeEnv,
      dataDir: config.dataDir,
      ai: {
        provider: 'Google Gen AI (Cloud Gemma)',
        model: model,
        status: isConfigured ? 'Connected' : 'Configuration Required',
        isConfigured: isConfigured,
        mockAi: config.mockAi
      }
    };
  }
}

export const settingsService = new SettingsService();
