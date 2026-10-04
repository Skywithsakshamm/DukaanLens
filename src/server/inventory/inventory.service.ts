import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDb, runTransaction } from '../../database/connection';
import { InventoryTransaction, TransactionType } from '../../shared/types';
import { InventoryTransactionRow, ProductRow } from '../../database/types';
import { AuditService, auditService as defaultAuditService } from '../audit/audit.service';

export class InventoryService {
  private auditService: AuditService;

  constructor(private db: DatabaseSync = getDb(), audit?: AuditService) {
    this.auditService = audit || (db === getDb() ? defaultAuditService : new AuditService(db));
  }

  public addTransaction(data: {
    productId: string;
    type: TransactionType;
    quantity: number;
    unitCostPaise?: number;
    referenceType?: 'invoice' | 'manual' | 'assistant_proposal' | 'opening';
    referenceId?: string;
    notes?: string;
    createdBy: string;
  }): InventoryTransaction {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const product = this.db.prepare('SELECT id, name FROM products WHERE id = ?').get(data.productId) as unknown as ProductRow | undefined;
    if (!product) {
      throw new Error(`Product with ID ${data.productId} does not exist.`);
    }

    return runTransaction(this.db, () => {
      this.db.prepare(`
        INSERT INTO inventory_transactions (
          id, product_id, type, quantity, unit_cost_paise,
          reference_type, reference_id, notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.productId,
        data.type,
        data.quantity,
        data.unitCostPaise ?? null,
        data.referenceType ?? 'manual',
        data.referenceId ?? null,
        data.notes ?? null,
        data.createdBy,
        now
      );

      this.auditService.log({
        actor: data.createdBy,
        action: `INVENTORY_${data.type}`,
        entity: 'products',
        entityId: data.productId,
        afterState: { quantityChange: data.quantity, type: data.type, notes: data.notes }
      });

      return {
        id,
        productId: data.productId,
        productName: product.name,
        type: data.type,
        quantity: data.quantity,
        unitCostPaise: data.unitCostPaise,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        notes: data.notes,
        createdBy: data.createdBy,
        createdAt: now
      };
    });
  }

  public adjustStock(data: {
    productId: string;
    type: TransactionType;
    quantity: number; // For sale/damage/adjustment, signed or unsigned
    notes?: string;
    unitCostPaise?: number;
    createdBy: string;
  }): InventoryTransaction {
    // Quantity logic: SALE, DAMAGE, RETURN_OUT, TRANSFER_OUT are stock deductions (negative quantity in ledger)
    let finalQty = data.quantity;
    if (['SALE', 'DAMAGE', 'RETURN_OUT', 'TRANSFER_OUT'].includes(data.type)) {
      finalQty = -Math.abs(data.quantity);
    } else if (['PURCHASE', 'RETURN_IN', 'TRANSFER_IN', 'OPENING_BALANCE'].includes(data.type)) {
      finalQty = Math.abs(data.quantity);
    }

    return this.addTransaction({
      productId: data.productId,
      type: data.type,
      quantity: finalQty,
      unitCostPaise: data.unitCostPaise,
      referenceType: 'manual',
      notes: data.notes || `Manual stock ${data.type.toLowerCase()}`,
      createdBy: data.createdBy
    });
  }

  public getTransactions(filter: {
    productId?: string;
    type?: string;
    limit?: number;
    offset?: number;
  } = {}): { transactions: InventoryTransaction[]; total: number } {
    let sql = `
      SELECT t.*, p.name as product_name
      FROM inventory_transactions t
      JOIN products p ON t.product_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter.productId) {
      sql += ` AND t.product_id = ?`;
      params.push(filter.productId);
    }

    if (filter.type) {
      sql += ` AND t.type = ?`;
      params.push(filter.type);
    }

    const countSql = `SELECT COUNT(*) as cnt FROM (${sql})`;
    const countRow = this.db.prepare(countSql).get(...params) as { cnt: number };

    sql += ` ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
    params.push(filter.limit || 50, filter.offset || 0);

    const rows = this.db.prepare(sql).all(...params) as unknown as Array<InventoryTransactionRow & { product_name: string }>;

    const transactions: InventoryTransaction[] = rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      type: r.type as TransactionType,
      quantity: r.quantity,
      unitCostPaise: r.unit_cost_paise || undefined,
      referenceType: (r.reference_type as any) || undefined,
      referenceId: r.reference_id || undefined,
      notes: r.notes || undefined,
      createdBy: r.created_by,
      createdAt: r.created_at
    }));

    return { transactions, total: countRow.cnt };
  }

  public getInventorySummary() {
    const products = this.db.prepare(`
      SELECT p.id, p.name, p.purchase_price_paise, p.minimum_stock,
             COALESCE(SUM(t.quantity), 0) as current_stock
      FROM products p
      LEFT JOIN inventory_transactions t ON p.id = t.product_id
      WHERE p.active = 1
      GROUP BY p.id
    `).all() as Array<{
      id: string;
      name: string;
      purchase_price_paise: number;
      minimum_stock: number;
      current_stock: number;
    }>;

    let totalValuationPaise = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const p of products) {
      const stock = Number(p.current_stock);
      if (stock <= 0) {
        outOfStockCount++;
        lowStockCount++;
      } else if (stock <= p.minimum_stock) {
        lowStockCount++;
      }
      totalValuationPaise += Math.max(0, stock) * p.purchase_price_paise;
    }

    // Today's stock movements
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const movements = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) as stock_in,
        COALESCE(SUM(CASE WHEN quantity < 0 THEN ABS(quantity) ELSE 0 END), 0) as stock_out
      FROM inventory_transactions
      WHERE created_at >= ?
    `).get(todayIso) as { stock_in: number; stock_out: number };

    return {
      totalProducts: products.length,
      lowStockCount,
      outOfStockCount,
      totalValuationPaise,
      todayStockIn: Number(movements.stock_in),
      todayStockOut: Number(movements.stock_out)
    };
  }
}

export const inventoryService = new InventoryService();
