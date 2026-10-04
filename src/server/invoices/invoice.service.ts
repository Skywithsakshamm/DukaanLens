import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { getDb, runTransaction, getUploadsDir } from '../../database/connection';
import { Invoice, InvoiceItem, InvoiceStatus, MatchStatus } from '../../shared/types';
import { InvoiceRow, InvoiceItemRow, SupplierRow } from '../../database/types';
import { toPaise } from '../../shared/formatters';
import { ProductService, productService } from '../products/product.service';
import { InventoryService, inventoryService } from '../inventory/inventory.service';
import { SupplierService, supplierService } from '../suppliers/supplier.service';
import { AuditService, auditService as defaultAuditService } from '../audit/audit.service';
import { getAiProvider } from '../../ai';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedInvoiceId?: string;
  reason?: string;
}

export class InvoiceService {
  private productService: ProductService;
  private inventoryService: InventoryService;
  private supplierService: SupplierService;
  private auditService: AuditService;

  constructor(
    private db: DatabaseSync = getDb(),
    prodService?: ProductService,
    invService?: InventoryService,
    supService?: SupplierService,
    auditServ?: AuditService
  ) {
    this.productService = prodService || new ProductService(db);
    this.inventoryService = invService || new InventoryService(db);
    this.supplierService = supService || new SupplierService(db);
    this.auditService = auditServ || (db === getDb() ? defaultAuditService : new AuditService(db));
  }

  public calculateImageHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  public checkDuplicate(params: {
    imageHash?: string;
    invoiceNumber?: string | null;
    supplierName?: string | null;
    invoiceDate?: string | null;
    totalPaise?: number | null;
  }): DuplicateCheckResult {
    // 1. Image hash exact match
    if (params.imageHash) {
      const row = this.db.prepare(`
        SELECT id, invoice_number, status FROM invoices
        WHERE image_hash = ? AND status != 'CANCELLED'
      `).get(params.imageHash) as { id: string; invoice_number: string; status: string } | undefined;

      if (row) {
        return {
          isDuplicate: true,
          matchedInvoiceId: row.id,
          reason: `Exact identical invoice image was already uploaded (${row.invoice_number || row.id}, Status: ${row.status})`
        };
      }
    }

    // 2. Invoice number + Supplier match
    if (params.invoiceNumber && params.invoiceNumber.trim()) {
      const invNum = params.invoiceNumber.trim();
      const row = this.db.prepare(`
        SELECT i.id, i.invoice_number, s.name as supplier_name, i.status
        FROM invoices i
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        WHERE LOWER(i.invoice_number) = LOWER(?) AND i.status != 'CANCELLED'
      `).get(invNum) as { id: string; invoice_number: string; supplier_name: string; status: string } | undefined;

      if (row) {
        return {
          isDuplicate: true,
          matchedInvoiceId: row.id,
          reason: `Invoice number "${invNum}" already exists in the system (Status: ${row.status})`
        };
      }
    }

    // 3. Same supplier + Date + Total match
    if (params.supplierName && params.invoiceDate && params.totalPaise && params.totalPaise > 0) {
      const row = this.db.prepare(`
        SELECT i.id, i.invoice_number
        FROM invoices i
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        WHERE (LOWER(s.name) = LOWER(?) OR LOWER(i.supplier_name_raw) = LOWER(?))
          AND i.invoice_date = ?
          AND i.total_paise = ?
          AND i.status != 'CANCELLED'
      `).get(params.supplierName, params.supplierName, params.invoiceDate, params.totalPaise) as { id: string; invoice_number: string } | undefined;

      if (row) {
        return {
          isDuplicate: true,
          matchedInvoiceId: row.id,
          reason: `An invoice with identical supplier, date (${params.invoiceDate}), and total (₹${params.totalPaise / 100}) already exists (${row.invoice_number || row.id})`
        };
      }
    }

    return { isDuplicate: false };
  }

  public async processAndExtractInvoice(params: {
    fileBuffer: Buffer;
    mimeType: string;
    originalFilename?: string;
    userId: string;
  }): Promise<Invoice> {
    const startTime = Date.now();
    const imageHash = this.calculateImageHash(params.fileBuffer);

    // Save image safely to DATA_DIR/uploads with random UUID filename
    const uploadsDir = getUploadsDir();
    const ext = params.mimeType.includes('png') ? '.png' : params.mimeType.includes('webp') ? '.webp' : '.jpg';
    const filename = `${crypto.randomUUID()}${ext}`;
    const imagePath = path.join(uploadsDir, filename);

    fs.writeFileSync(imagePath, params.fileBuffer);

    const aiProvider = getAiProvider();
    const extraction = await aiProvider.extractInvoice(params.fileBuffer, params.mimeType);
    const latencyMs = Date.now() - startTime;

    // Resolve or match supplier
    let supplierId: string | null = null;
    if (extraction.supplierName) {
      const existingSupplier = this.db.prepare(`
        SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)
      `).get(extraction.supplierName.trim()) as { id: string } | undefined;

      if (existingSupplier) {
        supplierId = existingSupplier.id;
      }
    }

    const subtotalPaise = extraction.subtotal ? toPaise(extraction.subtotal) : 0;
    const taxPaise = extraction.tax ? toPaise(extraction.tax) : 0;
    const totalPaise = extraction.total ? toPaise(extraction.total) : subtotalPaise + taxPaise;

    // Check duplicate
    const dupCheck = this.checkDuplicate({
      imageHash,
      invoiceNumber: extraction.invoiceNumber,
      supplierName: extraction.supplierName,
      invoiceDate: extraction.invoiceDate,
      totalPaise
    });

    const invoiceId = crypto.randomUUID();
    const now = new Date().toISOString();

    return runTransaction(this.db, () => {
      // 1. Insert Invoice in DRAFT status
      this.db.prepare(`
        INSERT INTO invoices (
          id, supplier_id, supplier_name_raw, invoice_number, invoice_date,
          currency, subtotal_paise, tax_paise, total_paise, status,
          image_path, image_hash, duplicate_warning_shown, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)
      `).run(
        invoiceId,
        supplierId,
        extraction.supplierName || null,
        extraction.invoiceNumber || null,
        extraction.invoiceDate || null,
        extraction.currency || 'INR',
        subtotalPaise,
        taxPaise,
        totalPaise,
        filename,
        imageHash,
        dupCheck.isDuplicate ? 1 : 0,
        params.userId,
        now,
        now
      );

      // 2. Insert AI Extraction record
      this.db.prepare(`
        INSERT INTO ai_extractions (
          id, reference_type, reference_id, raw_response, structured_data,
          provider, model, latency_ms, overall_confidence, created_at
        ) VALUES (?, 'invoice', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        invoiceId,
        null,
        JSON.stringify(extraction),
        aiProvider.constructor.name,
        aiProvider.getModelName(),
        latencyMs,
        extraction.overallConfidence,
        now
      );

      // 3. Process line items & match products
      const insertItemStmt = this.db.prepare(`
        INSERT INTO invoice_items (
          id, invoice_id, raw_name, product_id, quantity, unit,
          unit_price_paise, line_total_paise, confidence, match_status,
          match_reason, suggested_product_id, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of extraction.items) {
        // Synchronous match helper (AI match runs synchronously in Mock or fallback)
        // Match against existing products
        const matchResult = this.matchItemSync(item.rawName, item.normalizedNameSuggestion);

        const qty = item.quantity ?? 1;
        const unitPricePaise = item.unitPrice ? toPaise(item.unitPrice) : 0;
        const lineTotalPaise = item.lineTotal ? toPaise(item.lineTotal) : Math.round(qty * unitPricePaise);

        insertItemStmt.run(
          crypto.randomUUID(),
          invoiceId,
          item.rawName,
          matchResult.productId || null,
          qty,
          item.unit || 'pcs',
          unitPricePaise,
          lineTotalPaise,
          item.confidence ?? 0.9,
          matchResult.matchStatus,
          matchResult.reason,
          matchResult.suggestedProductId || null,
          item.notes || null,
          now
        );
      }

      this.auditService.log({
        actor: params.userId,
        action: 'INVOICE_EXTRACTED',
        entity: 'invoices',
        entityId: invoiceId,
        afterState: {
          invoiceNumber: extraction.invoiceNumber,
          supplier: extraction.supplierName,
          totalPaise,
          itemCount: extraction.items.length,
          duplicateWarning: dupCheck.isDuplicate ? dupCheck.reason : null
        }
      });

      const fullInvoice = this.getInvoiceById(invoiceId)!;
      if (dupCheck.isDuplicate && dupCheck.reason) {
        fullInvoice.warnings.push(`Possible Duplicate Warning: ${dupCheck.reason}`);
      }
      for (const w of extraction.warnings) {
        fullInvoice.warnings.push(w);
      }

      return fullInvoice;
    });
  }

  private matchItemSync(rawName: string, suggestedName?: string | null): {
    matchStatus: MatchStatus;
    productId?: string;
    suggestedProductId?: string;
    confidence: number;
    reason: string;
  } {
    const allProducts = this.productService.getAllProducts({ activeOnly: true });
    const normRaw = rawName.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const normSugg = suggestedName ? suggestedName.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim() : '';

    // 1. Exact Name
    for (const p of allProducts) {
      const pNorm = p.name.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (pNorm === normRaw || (normSugg && pNorm === normSugg)) {
        return {
          matchStatus: 'exact',
          productId: p.id,
          confidence: 1.0,
          reason: 'Exact product name match'
        };
      }
    }

    // 2. Alias match
    for (const p of allProducts) {
      for (const alias of p.aliases) {
        const aNorm = alias.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        if (aNorm === normRaw || (normSugg && aNorm === normSugg)) {
          return {
            matchStatus: 'high_confidence',
            productId: p.id,
            confidence: 0.95,
            reason: `Matched alias "${alias}"`
          };
        }
      }
    }

    // 3. Token similarity
    let bestP: any = null;
    let highestSim = 0;
    const tokens = new Set(normRaw.split(' ').filter(Boolean));

    for (const p of allProducts) {
      const pTokens = new Set(p.name.toLowerCase().split(' ').filter(Boolean));
      const intersection = new Set([...tokens].filter(x => pTokens.has(x)));
      const union = new Set([...tokens, ...pTokens]);
      const sim = union.size > 0 ? intersection.size / union.size : 0;

      if (sim > highestSim) {
        highestSim = sim;
        bestP = p;
      }
    }

    if (bestP && highestSim >= 0.5) {
      return {
        matchStatus: 'high_confidence',
        productId: bestP.id,
        confidence: Math.round(highestSim * 100) / 100,
        reason: `Matched "${bestP.name}" by name tokens (${Math.round(highestSim * 100)}%)`
      };
    }

    if (bestP && highestSim >= 0.3) {
      return {
        matchStatus: 'needs_review',
        suggestedProductId: bestP.id,
        confidence: Math.round(highestSim * 100) / 100,
        reason: `Suggested "${bestP.name}" (${Math.round(highestSim * 100)}% match)`
      };
    }

    return {
      matchStatus: 'unmatched',
      confidence: 0,
      reason: 'No match in catalog. Create or choose product.'
    };
  }

  public getAllInvoices(limit = 50): Invoice[] {
    const rows = this.db.prepare(`
      SELECT i.*, s.name as supplier_name,
             COUNT(it.id) as item_count
      FROM invoices i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      LEFT JOIN invoice_items it ON i.id = it.invoice_id
      GROUP BY i.id
      ORDER BY i.created_at DESC
      LIMIT ?
    `).all(limit) as unknown as Array<InvoiceRow & { supplier_name?: string; item_count: number }>;

    return rows.map(r => ({
      id: r.id,
      supplierId: r.supplier_id || undefined,
      supplierNameRaw: r.supplier_name_raw || undefined,
      supplierName: r.supplier_name || r.supplier_name_raw || undefined,
      invoiceNumber: r.invoice_number || undefined,
      invoiceDate: r.invoice_date || undefined,
      currency: r.currency,
      subtotalPaise: r.subtotal_paise,
      taxPaise: r.tax_paise,
      totalPaise: r.total_paise,
      status: r.status as InvoiceStatus,
      imagePath: r.image_path || undefined,
      imageHash: r.image_hash || undefined,
      duplicateWarningShown: Boolean(r.duplicate_warning_shown),
      itemCount: Number(r.item_count),
      overallConfidence: 1.0,
      warnings: [],
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public getInvoiceById(id: string): Invoice | null {
    const row = this.db.prepare(`
      SELECT i.*, s.name as supplier_name
      FROM invoices i
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.id = ?
    `).get(id) as unknown as (InvoiceRow & { supplier_name?: string }) | undefined;

    if (!row) return null;

    const itemRows = this.db.prepare(`
      SELECT it.*, p.name as product_name, p.selling_price_paise,
             sp.name as suggested_product_name
      FROM invoice_items it
      LEFT JOIN products p ON it.product_id = p.id
      LEFT JOIN products sp ON it.suggested_product_id = sp.id
      WHERE it.invoice_id = ?
      ORDER BY it.rowid ASC
    `).all(id) as unknown as Array<InvoiceItemRow & {
      product_name?: string;
      suggested_product_name?: string;
    }>;

    const stockMap = this.productService.getStockMap();

    const items: InvoiceItem[] = itemRows.map(it => {
      const curStock = it.product_id ? stockMap.get(it.product_id) ?? 0 : undefined;
      const stockAfter = curStock !== undefined ? curStock + it.quantity : undefined;

      return {
        id: it.id,
        invoiceId: it.invoice_id,
        rawName: it.raw_name,
        productId: it.product_id || undefined,
        productName: it.product_name || undefined,
        currentStock: curStock,
        stockAfter: stockAfter,
        quantity: it.quantity,
        unit: it.unit || 'pcs',
        unitPricePaise: it.unit_price_paise,
        lineTotalPaise: it.line_total_paise,
        confidence: it.confidence,
        matchStatus: it.match_status as MatchStatus,
        matchReason: it.match_reason || undefined,
        suggestedProductId: it.suggested_product_id || undefined,
        suggestedProductName: it.suggested_product_name || undefined,
        notes: it.notes || undefined
      };
    });

    return {
      id: row.id,
      supplierId: row.supplier_id || undefined,
      supplierNameRaw: row.supplier_name_raw || undefined,
      supplierName: row.supplier_name || row.supplier_name_raw || undefined,
      invoiceNumber: row.invoice_number || undefined,
      invoiceDate: row.invoice_date || undefined,
      currency: row.currency,
      subtotalPaise: row.subtotal_paise,
      taxPaise: row.tax_paise,
      totalPaise: row.total_paise,
      status: row.status as InvoiceStatus,
      imagePath: row.image_path || undefined,
      imageHash: row.image_hash || undefined,
      duplicateWarningShown: Boolean(row.duplicate_warning_shown),
      itemCount: items.length,
      items,
      overallConfidence: 0.95,
      warnings: [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public updateInvoiceDetails(
    id: string,
    data: {
      supplierId?: string;
      supplierNameRaw?: string;
      invoiceNumber?: string;
      invoiceDate?: string;
    }
  ): Invoice {
    const existing = this.getInvoiceById(id);
    if (!existing) throw new Error(`Invoice ${id} not found`);
    if (existing.status === 'CONFIRMED') throw new Error('Cannot edit a confirmed invoice');

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE invoices SET
        supplier_id = COALESCE(?, supplier_id),
        supplier_name_raw = COALESCE(?, supplier_name_raw),
        invoice_number = COALESCE(?, invoice_number),
        invoice_date = COALESCE(?, invoice_date),
        updated_at = ?
      WHERE id = ?
    `).run(
      data.supplierId ?? null,
      data.supplierNameRaw ?? null,
      data.invoiceNumber ?? null,
      data.invoiceDate ?? null,
      now,
      id
    );

    return this.getInvoiceById(id)!;
  }

  public updateInvoiceItem(
    itemId: string,
    data: {
      productId?: string;
      quantity?: number;
      unitPricePaise?: number;
      rawName?: string;
    }
  ): InvoiceItem {
    const item = this.db.prepare('SELECT * FROM invoice_items WHERE id = ?').get(itemId) as unknown as InvoiceItemRow | undefined;
    if (!item) throw new Error(`Invoice item ${itemId} not found`);

    const inv = this.getInvoiceById(item.invoice_id);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status === 'CONFIRMED') throw new Error('Cannot edit items of a confirmed invoice');

    const newQty = data.quantity !== undefined ? Number(data.quantity) : item.quantity;
    const newUnitPrice = data.unitPricePaise !== undefined ? Number(data.unitPricePaise) : item.unit_price_paise;
    const newLineTotal = Math.round(newQty * newUnitPrice);
    const newProductId = data.productId !== undefined ? data.productId : item.product_id;
    const newMatchStatus = newProductId ? 'exact' : 'unmatched';

    this.db.prepare(`
      UPDATE invoice_items SET
        product_id = ?,
        quantity = ?,
        unit_price_paise = ?,
        line_total_paise = ?,
        match_status = ?,
        raw_name = COALESCE(?, raw_name)
      WHERE id = ?
    `).run(
      newProductId || null,
      newQty,
      newUnitPrice,
      newLineTotal,
      newMatchStatus,
      data.rawName || null,
      itemId
    );

    // Recalculate invoice totals
    const totals = this.db.prepare(`
      SELECT SUM(line_total_paise) as subtotal FROM invoice_items WHERE invoice_id = ?
    `).get(item.invoice_id) as { subtotal: number };

    const subtotal = Number(totals.subtotal) || 0;
    const tax = Math.round(subtotal * 0.18); // default estimate or retain
    this.db.prepare(`
      UPDATE invoices SET subtotal_paise = ?, total_paise = ? WHERE id = ?
    `).run(subtotal, subtotal + tax, item.invoice_id);

    return this.getInvoiceById(item.invoice_id)!.items!.find(i => i.id === itemId)!;
  }

  /**
   * NON-NEGOTIABLE CONFIRMATION GATE:
   * Commits stock transaction inside an atomic SQLite transaction.
   */
  public confirmInvoice(invoiceId: string, actor = 'user'): Invoice {
    const invoice = this.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found.`);
    }

    if (invoice.status === 'CONFIRMED') {
      return invoice; // Idempotent success
    }

    if (invoice.status === 'CANCELLED') {
      throw new Error('Cannot confirm a cancelled invoice.');
    }

    if (!invoice.items || invoice.items.length === 0) {
      throw new Error('Invoice has no items to confirm.');
    }

    // Verify all items have mapped products
    const unmapped = invoice.items.filter(i => !i.productId);
    if (unmapped.length > 0) {
      throw new Error(`Please resolve all product mappings before confirmation. (${unmapped.length} unmapped items)`);
    }

    const now = new Date().toISOString();

    return runTransaction(this.db, () => {
      // 1. Create or link supplier if raw name exists and no supplierId
      let finalSupplierId = invoice.supplierId;
      if (!finalSupplierId && invoice.supplierNameRaw && invoice.supplierNameRaw.trim()) {
        const existingSup = this.db.prepare('SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)').get(invoice.supplierNameRaw.trim()) as { id: string } | undefined;
        if (existingSup) {
          finalSupplierId = existingSup.id;
        } else {
          const newSup = this.supplierService.createSupplier({
            name: invoice.supplierNameRaw.trim(),
            notes: 'Auto-created from invoice confirmation',
            actor
          });
          finalSupplierId = newSup.id;
        }
      }

      // 2. Commit stock for every line item
      for (const item of invoice.items!) {
        if (!item.productId) continue;

        // Add inventory PURCHASE transaction
        this.inventoryService.addTransaction({
          productId: item.productId,
          type: 'PURCHASE',
          quantity: item.quantity,
          unitCostPaise: item.unitPricePaise,
          referenceType: 'invoice',
          referenceId: invoice.id,
          notes: `Invoice intake: ${invoice.invoiceNumber || invoice.id} (${invoice.supplierName || 'Supplier'})`,
          createdBy: actor
        });

        // Update product purchase price
        if (item.unitPricePaise > 0) {
          this.db.prepare(`
            UPDATE products SET purchase_price_paise = ?, updated_at = ? WHERE id = ?
          `).run(item.unitPricePaise, now, item.productId);
        }

        // Automatic Alias Learning: If rawName is distinct from catalog name, save it
        if (item.productName && item.rawName.toLowerCase() !== item.productName.toLowerCase()) {
          this.productService.addAlias(item.productId, item.rawName, 'invoice_learning');
        }
      }

      // 3. Update Invoice status to CONFIRMED
      this.db.prepare(`
        UPDATE invoices SET
          status = 'CONFIRMED',
          supplier_id = ?,
          updated_at = ?
        WHERE id = ?
      `).run(finalSupplierId || null, now, invoice.id);

      this.auditService.log({
        actor,
        action: 'INVOICE_CONFIRMED',
        entity: 'invoices',
        entityId: invoice.id,
        afterState: {
          invoiceNumber: invoice.invoiceNumber,
          totalPaise: invoice.totalPaise,
          itemsCount: invoice.items!.length
        }
      });

      return this.getInvoiceById(invoice.id)!;
    });
  }

  public cancelInvoice(invoiceId: string, actor = 'user'): Invoice {
    const invoice = this.getInvoiceById(invoiceId);
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

    if (invoice.status === 'CONFIRMED') {
      throw new Error('Cannot cancel an already confirmed invoice. Use manual stock adjustment instead.');
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE invoices SET status = 'CANCELLED', updated_at = ? WHERE id = ?
    `).run(now, invoiceId);

    this.auditService.log({
      actor,
      action: 'INVOICE_CANCELLED',
      entity: 'invoices',
      entityId: invoiceId
    });

    return this.getInvoiceById(invoiceId)!;
  }
}

export const invoiceService = new InvoiceService();
