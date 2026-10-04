import crypto from 'node:crypto';
import { DatabaseSync, getDb, runTransaction } from '../../database/connection';
import { Product, MatchStatus } from '../../shared/types';
import { ProductRow, ProductAliasRow } from '../../database/types';
import { normalizeProductName, calculateTokenSimilarity } from '../../shared/formatters';
import { AuditService, auditService } from '../audit/audit.service';
import { getAiProvider } from '../../ai';

export interface ProductFilter {
  search?: string;
  category?: string;
  supplierId?: string;
  activeOnly?: boolean;
  lowStockOnly?: boolean;
}

export interface MatchResult {
  matchStatus: MatchStatus;
  productId?: string;
  productName?: string;
  confidence: number;
  reason: string;
  suggestedProductId?: string;
  suggestedProductName?: string;
}

export class ProductService {
  private auditService: AuditService;

  constructor(
    private db: DatabaseSync = getDb(),
    audService?: AuditService
  ) {
    this.auditService = audService || new AuditService(db);
  }

  /**
   * Helper to fetch current stock for all products or a single product
   */
  public getStockMap(): Map<string, number> {
    const rows = this.db.prepare(`
      SELECT product_id, COALESCE(SUM(quantity), 0) as stock
      FROM inventory_transactions
      GROUP BY product_id
    `).all() as Array<{ product_id: string; stock: number }>;

    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.product_id, Number(r.stock));
    }
    return map;
  }

  public getProductStock(productId: string): number {
    const row = this.db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as stock
      FROM inventory_transactions
      WHERE product_id = ?
    `).get(productId) as { stock: number } | undefined;

    return row ? Number(row.stock) : 0;
  }

  public getAllProducts(filter: ProductFilter = {}): Product[] {
    let sql = `
      SELECT p.*, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filter.activeOnly !== false) {
      sql += ` AND p.active = 1`;
    }

    if (filter.category) {
      sql += ` AND p.category = ?`;
      params.push(filter.category);
    }

    if (filter.supplierId) {
      sql += ` AND p.supplier_id = ?`;
      params.push(filter.supplierId);
    }

    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim().toLowerCase()}%`;
      sql += ` AND (LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.sku, '')) LIKE ? OR LOWER(COALESCE(p.barcode, '')) LIKE ? OR LOWER(COALESCE(p.category, '')) LIKE ?)`;
      params.push(q, q, q, q);
    }

    sql += ` ORDER BY p.name ASC`;

    const rows = this.db.prepare(sql).all(...params) as unknown as Array<ProductRow & { supplier_name?: string }>;
    const stockMap = this.getStockMap();

    // Fetch aliases for all products
    const aliasRows = this.db.prepare(`SELECT product_id, alias FROM product_aliases`).all() as unknown as ProductAliasRow[];
    const aliasMap = new Map<string, string[]>();
    for (const a of aliasRows) {
      const list = aliasMap.get(a.product_id) || [];
      list.push(a.alias);
      aliasMap.set(a.product_id, list);
    }

    let products: Product[] = rows.map(r => ({
      id: r.id,
      name: r.name,
      sku: r.sku || undefined,
      barcode: r.barcode || undefined,
      category: r.category || undefined,
      brand: r.brand || undefined,
      unit: r.unit,
      purchasePricePaise: r.purchase_price_paise,
      sellingPricePaise: r.selling_price_paise,
      currentStock: stockMap.get(r.id) ?? 0,
      minimumStock: r.minimum_stock,
      reorderQuantity: r.reorder_quantity,
      supplierId: r.supplier_id || undefined,
      supplierName: r.supplier_name || undefined,
      aliases: aliasMap.get(r.id) || [],
      notes: r.notes || undefined,
      active: Boolean(r.active),
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    if (filter.lowStockOnly) {
      products = products.filter(p => p.currentStock <= p.minimumStock);
    }

    return products;
  }

  public getProductById(id: string): Product | null {
    const row = this.db.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(id) as unknown as (ProductRow & { supplier_name?: string }) | undefined;

    if (!row) return null;

    const aliasRows = this.db.prepare(`
      SELECT alias FROM product_aliases WHERE product_id = ?
    `).all(id) as unknown as ProductAliasRow[];

    const currentStock = this.getProductStock(id);

    return {
      id: row.id,
      name: row.name,
      sku: row.sku || undefined,
      barcode: row.barcode || undefined,
      category: row.category || undefined,
      brand: row.brand || undefined,
      unit: row.unit,
      purchasePricePaise: row.purchase_price_paise,
      sellingPricePaise: row.selling_price_paise,
      currentStock,
      minimumStock: row.minimum_stock,
      reorderQuantity: row.reorder_quantity,
      supplierId: row.supplier_id || undefined,
      supplierName: row.supplier_name || undefined,
      aliases: aliasRows.map(a => a.alias),
      notes: row.notes || undefined,
      active: Boolean(row.active),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public createProduct(data: {
    name: string;
    sku?: string;
    barcode?: string;
    category?: string;
    brand?: string;
    unit?: string;
    purchasePricePaise?: number;
    sellingPricePaise?: number;
    minimumStock?: number;
    reorderQuantity?: number;
    supplierId?: string;
    aliases?: string[];
    notes?: string;
    initialStock?: number;
    actor?: string;
  }): Product {
    if (!data.name || !data.name.trim()) {
      throw new Error('Product name is required.');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const actor = data.actor || 'system';

    return runTransaction(this.db, () => {
      this.db.prepare(`
        INSERT INTO products (
          id, name, sku, barcode, category, brand, unit,
          purchase_price_paise, selling_price_paise, minimum_stock,
          reorder_quantity, supplier_id, notes, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        id,
        data.name.trim(),
        data.sku?.trim() || null,
        data.barcode?.trim() || null,
        data.category?.trim() || null,
        data.brand?.trim() || null,
        data.unit?.trim() || 'pcs',
        data.purchasePricePaise ?? 0,
        data.sellingPricePaise ?? 0,
        data.minimumStock ?? 10,
        data.reorderQuantity ?? 50,
        data.supplierId || null,
        data.notes || null,
        now,
        now
      );

      // Insert aliases
      const aliases = data.aliases || [];
      const insertAlias = this.db.prepare(`
        INSERT OR IGNORE INTO product_aliases (id, product_id, alias, source, created_at)
        VALUES (?, ?, ?, 'manual', ?)
      `);
      for (const a of aliases) {
        if (a && a.trim()) {
          insertAlias.run(crypto.randomUUID(), id, a.trim(), now);
        }
      }

      // Record opening stock transaction if provided
      if (data.initialStock && data.initialStock > 0) {
        this.db.prepare(`
          INSERT INTO inventory_transactions (
            id, product_id, type, quantity, unit_cost_paise,
            reference_type, reference_id, notes, created_by, created_at
          ) VALUES (?, ?, 'OPENING_BALANCE', ?, ?, 'manual', 'initial_creation', 'Initial stock intake on creation', ?, ?)
        `).run(
          crypto.randomUUID(),
          id,
          data.initialStock,
          data.purchasePricePaise ?? 0,
          actor,
          now
        );
      }

      this.auditService.log({
        actor,
        action: 'PRODUCT_CREATED',
        entity: 'products',
        entityId: id,
        afterState: { name: data.name, initialStock: data.initialStock }
      });

      return this.getProductById(id)!;
    });
  }

  public updateProduct(
    id: string,
    data: {
      name?: string;
      sku?: string;
      barcode?: string;
      category?: string;
      brand?: string;
      unit?: string;
      purchasePricePaise?: number;
      sellingPricePaise?: number;
      minimumStock?: number;
      reorderQuantity?: number;
      supplierId?: string;
      aliases?: string[];
      notes?: string;
      active?: boolean;
      actor?: string;
    }
  ): Product {
    const existing = this.getProductById(id);
    if (!existing) {
      throw new Error(`Product with ID ${id} not found.`);
    }

    const now = new Date().toISOString();
    const actor = data.actor || 'system';

    return runTransaction(this.db, () => {
      this.db.prepare(`
        UPDATE products SET
          name = COALESCE(?, name),
          sku = ?,
          barcode = ?,
          category = ?,
          brand = ?,
          unit = COALESCE(?, unit),
          purchase_price_paise = COALESCE(?, purchase_price_paise),
          selling_price_paise = COALESCE(?, selling_price_paise),
          minimum_stock = COALESCE(?, minimum_stock),
          reorder_quantity = COALESCE(?, reorder_quantity),
          supplier_id = ?,
          notes = ?,
          active = COALESCE(?, active),
          updated_at = ?
        WHERE id = ?
      `).run(
        data.name?.trim() ?? null,
        data.sku !== undefined ? (data.sku?.trim() || null) : (existing.sku || null),
        data.barcode !== undefined ? (data.barcode?.trim() || null) : (existing.barcode || null),
        data.category !== undefined ? (data.category?.trim() || null) : (existing.category || null),
        data.brand !== undefined ? (data.brand?.trim() || null) : (existing.brand || null),
        data.unit?.trim() ?? null,
        data.purchasePricePaise ?? null,
        data.sellingPricePaise ?? null,
        data.minimumStock ?? null,
        data.reorderQuantity ?? null,
        data.supplierId !== undefined ? (data.supplierId || null) : (existing.supplierId || null),
        data.notes !== undefined ? (data.notes || null) : (existing.notes || null),
        data.active !== undefined ? (data.active ? 1 : 0) : null,
        now,
        id
      );

      if (data.aliases) {
        // Replace aliases
        this.db.prepare('DELETE FROM product_aliases WHERE product_id = ? AND source = ?').run(id, 'manual');
        const insertAlias = this.db.prepare(`
          INSERT OR IGNORE INTO product_aliases (id, product_id, alias, source, created_at)
          VALUES (?, ?, ?, 'manual', ?)
        `);
        for (const a of data.aliases) {
          if (a && a.trim()) {
            insertAlias.run(crypto.randomUUID(), id, a.trim(), now);
          }
        }
      }

      this.auditService.log({
        actor,
        action: 'PRODUCT_UPDATED',
        entity: 'products',
        entityId: id,
        beforeState: existing,
        afterState: data
      });

      return this.getProductById(id)!;
    });
  }

  public addAlias(productId: string, alias: string, source: 'manual' | 'invoice_learning' = 'invoice_learning'): void {
    if (!alias || !alias.trim()) return;
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT OR IGNORE INTO product_aliases (id, product_id, alias, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), productId, alias.trim(), source, now);
  }

  /**
   * Multi-stage matching algorithm for invoice line items:
   * 1. Exact normalized name
   * 2. SKU / Barcode match
   * 3. Alias match in product_aliases
   * 4. Token similarity (Jaccard similarity >= 0.5)
   * 5. AI semantic suggestion fallback
   */
  public async matchProduct(rawName: string, suggestedName?: string | null): Promise<MatchResult> {
    if (!rawName || !rawName.trim()) {
      return {
        matchStatus: 'unmatched',
        confidence: 0,
        reason: 'Empty raw product name'
      };
    }

    const allProducts = this.getAllProducts({ activeOnly: true });
    const normRaw = normalizeProductName(rawName);
    const normSuggested = suggestedName ? normalizeProductName(suggestedName) : '';

    // Stage 1: Exact Name Match
    for (const p of allProducts) {
      const pNorm = normalizeProductName(p.name);
      if (pNorm === normRaw || (normSuggested && pNorm === normSuggested)) {
        return {
          matchStatus: 'exact',
          productId: p.id,
          productName: p.name,
          confidence: 1.0,
          reason: 'Exact product name match'
        };
      }
    }

    // Stage 2: SKU / Barcode Match
    for (const p of allProducts) {
      if (p.sku) {
        const normSku = normalizeProductName(p.sku);
        if (normSku && normRaw.includes(normSku)) {
          return {
            matchStatus: 'exact',
            productId: p.id,
            productName: p.name,
            confidence: 0.98,
            reason: `Matched SKU "${p.sku}"`
          };
        }
      }
      if (p.barcode) {
        const normBarcode = normalizeProductName(p.barcode);
        if (normBarcode && normRaw.includes(normBarcode)) {
          return {
            matchStatus: 'exact',
            productId: p.id,
            productName: p.name,
            confidence: 0.98,
            reason: `Matched Barcode "${p.barcode}"`
          };
        }
      }
    }

    // Stage 3: Alias Match
    for (const p of allProducts) {
      for (const alias of p.aliases) {
        const normAlias = normalizeProductName(alias);
        if (normAlias === normRaw || (normSuggested && normAlias === normSuggested)) {
          return {
            matchStatus: 'high_confidence',
            productId: p.id,
            productName: p.name,
            confidence: 0.95,
            reason: `Matched registered alias "${alias}"`
          };
        }
      }
    }

    // Stage 4: Token Similarity Match
    let bestProduct: Product | null = null;
    let highestSim = 0;

    for (const p of allProducts) {
      const nameSim = calculateTokenSimilarity(rawName, p.name);
      const suggSim = normSuggested ? calculateTokenSimilarity(normSuggested, p.name) : 0;
      const sim = Math.max(nameSim, suggSim);

      if (sim > highestSim) {
        highestSim = sim;
        bestProduct = p;
      }

      for (const alias of p.aliases) {
        const aliasSim = calculateTokenSimilarity(rawName, alias);
        if (aliasSim > highestSim) {
          highestSim = aliasSim;
          bestProduct = p;
        }
      }
    }

    if (bestProduct && highestSim >= 0.6) {
      return {
        matchStatus: 'high_confidence',
        productId: bestProduct.id,
        productName: bestProduct.name,
        confidence: Math.round(highestSim * 100) / 100,
        reason: `High token similarity (${Math.round(highestSim * 100)}%) with "${bestProduct.name}"`
      };
    }

    if (bestProduct && highestSim >= 0.4) {
      return {
        matchStatus: 'needs_review',
        suggestedProductId: bestProduct.id,
        suggestedProductName: bestProduct.name,
        confidence: Math.round(highestSim * 100) / 100,
        reason: `Probable match with "${bestProduct.name}" (${Math.round(highestSim * 100)}% similarity)`
      };
    }

    // Stage 5: AI-Assisted Candidate Suggestion
    try {
      const aiProvider = getAiProvider();
      const candidates = allProducts.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        aliases: p.aliases
      }));

      const aiResult = await aiProvider.suggestProductMatch(rawName, candidates);
      if (aiResult.matchedProductId) {
        const aiMatched = allProducts.find(p => p.id === aiResult.matchedProductId);
        if (aiMatched) {
          return {
            matchStatus: aiResult.confidence >= 0.8 ? 'high_confidence' : 'needs_review',
            productId: aiResult.confidence >= 0.8 ? aiMatched.id : undefined,
            productName: aiResult.confidence >= 0.8 ? aiMatched.name : undefined,
            suggestedProductId: aiMatched.id,
            suggestedProductName: aiMatched.name,
            confidence: aiResult.confidence,
            reason: `AI Suggestion: ${aiResult.reason}`
          };
        }
      }
    } catch {
      // AI fallback gracefully ignored
    }

    return {
      matchStatus: 'unmatched',
      confidence: 0,
      reason: 'No match found in shop catalog. Please choose or create product.'
    };
  }
}

export const productService = new ProductService();
