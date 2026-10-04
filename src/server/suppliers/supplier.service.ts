import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDb, runTransaction } from '../../database/connection';
import { Supplier, Product } from '../../shared/types';
import { SupplierRow, ProductRow } from '../../database/types';
import { AuditService, auditService as defaultAuditService } from '../audit/audit.service';

export class SupplierService {
  private auditService: AuditService;

  constructor(private db: DatabaseSync = getDb(), audit?: AuditService) {
    this.auditService = audit || (db === getDb() ? defaultAuditService : new AuditService(db));
  }

  public getAllSuppliers(): Supplier[] {
    const rows = this.db.prepare(`
      SELECT s.*,
        COUNT(DISTINCT i.id) as invoice_count,
        COALESCE(SUM(i.total_paise), 0) as total_purchases_paise,
        MAX(i.invoice_date) as last_purchase_date
      FROM suppliers s
      LEFT JOIN invoices i ON s.id = i.supplier_id AND i.status = 'CONFIRMED'
      GROUP BY s.id
      ORDER BY s.name ASC
    `).all() as unknown as Array<SupplierRow & {
      invoice_count: number;
      total_purchases_paise: number;
      last_purchase_date: string | null;
    }>;

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      phone: r.phone || undefined,
      email: r.email || undefined,
      address: r.address || undefined,
      notes: r.notes || undefined,
      invoiceCount: Number(r.invoice_count),
      totalPurchasesPaise: Number(r.total_purchases_paise),
      lastPurchaseDate: r.last_purchase_date || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public getSupplierById(id: string): { supplier: Supplier; suppliedProducts: Product[] } | null {
    const row = this.db.prepare(`
      SELECT s.*,
        COUNT(DISTINCT i.id) as invoice_count,
        COALESCE(SUM(i.total_paise), 0) as total_purchases_paise,
        MAX(i.invoice_date) as last_purchase_date
      FROM suppliers s
      LEFT JOIN invoices i ON s.id = i.supplier_id AND i.status = 'CONFIRMED'
      WHERE s.id = ?
      GROUP BY s.id
    `).get(id) as unknown as (SupplierRow & {
      invoice_count: number;
      total_purchases_paise: number;
      last_purchase_date: string | null;
    }) | undefined;

    if (!row) return null;

    const prodRows = this.db.prepare(`
      SELECT p.* FROM products p WHERE p.supplier_id = ? AND p.active = 1 ORDER BY p.name ASC
    `).all(id) as unknown as ProductRow[];

    const suppliedProducts: Product[] = prodRows.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku || undefined,
      barcode: p.barcode || undefined,
      category: p.category || undefined,
      brand: p.brand || undefined,
      unit: p.unit,
      purchasePricePaise: p.purchase_price_paise,
      sellingPricePaise: p.selling_price_paise,
      currentStock: 0,
      minimumStock: p.minimum_stock,
      reorderQuantity: p.reorder_quantity,
      supplierId: p.supplier_id || undefined,
      aliases: [],
      notes: p.notes || undefined,
      active: Boolean(p.active),
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));

    return {
      supplier: {
        id: row.id,
        name: row.name,
        phone: row.phone || undefined,
        email: row.email || undefined,
        address: row.address || undefined,
        notes: row.notes || undefined,
        invoiceCount: Number(row.invoice_count),
        totalPurchasesPaise: Number(row.total_purchases_paise),
        lastPurchaseDate: row.last_purchase_date || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      suppliedProducts
    };
  }

  public createSupplier(data: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    actor?: string;
  }): Supplier {
    if (!data.name || !data.name.trim()) {
      throw new Error('Supplier name is required.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const actor = data.actor || 'user';

    return runTransaction(this.db, () => {
      this.db.prepare(`
        INSERT INTO suppliers (id, name, phone, email, address, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.name.trim(),
        data.phone?.trim() || null,
        data.email?.trim() || null,
        data.address?.trim() || null,
        data.notes?.trim() || null,
        now,
        now
      );

      this.auditService.log({
        actor,
        action: 'SUPPLIER_CREATED',
        entity: 'suppliers',
        entityId: id,
        afterState: { name: data.name }
      });

      return {
        id,
        name: data.name.trim(),
        phone: data.phone?.trim(),
        email: data.email?.trim(),
        address: data.address?.trim(),
        notes: data.notes?.trim(),
        invoiceCount: 0,
        totalPurchasesPaise: 0,
        createdAt: now,
        updatedAt: now
      };
    });
  }

  public updateSupplier(
    id: string,
    data: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      notes?: string;
      actor?: string;
    }
  ): Supplier {
    const existing = this.getSupplierById(id);
    if (!existing) {
      throw new Error(`Supplier with ID ${id} not found.`);
    }

    const now = new Date().toISOString();
    const actor = data.actor || 'user';

    return runTransaction(this.db, () => {
      this.db.prepare(`
        UPDATE suppliers SET
          name = COALESCE(?, name),
          phone = ?,
          email = ?,
          address = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        data.name?.trim() ?? null,
        data.phone !== undefined ? (data.phone?.trim() || null) : (existing.supplier.phone || null),
        data.email !== undefined ? (data.email?.trim() || null) : (existing.supplier.email || null),
        data.address !== undefined ? (data.address?.trim() || null) : (existing.supplier.address || null),
        data.notes !== undefined ? (data.notes?.trim() || null) : (existing.supplier.notes || null),
        now,
        id
      );

      this.auditService.log({
        actor,
        action: 'SUPPLIER_UPDATED',
        entity: 'suppliers',
        entityId: id,
        beforeState: existing.supplier,
        afterState: data
      });

      return this.getSupplierById(id)!.supplier;
    });
  }
}

export const supplierService = new SupplierService();
