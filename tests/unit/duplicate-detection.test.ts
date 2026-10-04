import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/database/migrations';
import { InvoiceService } from '../../src/server/invoices/invoice.service';
import { SupplierService } from '../../src/server/suppliers/supplier.service';

describe('Duplicate Invoice Detection', () => {
  let db: Database.Database;
  let invService: InvoiceService;
  let supService: SupplierService;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    invService = new InvoiceService(db);
    supService = new SupplierService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should detect duplicate by invoice number and supplier', () => {
    const supplier = supService.createSupplier({ name: 'ABC Electronics' });

    // Seed existing confirmed invoice
    db.prepare(`
      INSERT INTO invoices (
        id, supplier_id, invoice_number, invoice_date, total_paise, status,
        duplicate_warning_shown, created_by, created_at, updated_at
      ) VALUES ('inv-1', ?, 'INV-1042', '2026-10-04', 50000, 'CONFIRMED', 0, 'admin', '2026-10-04', '2026-10-04')
    `).run(supplier.id);

    // Check with duplicate invoice number
    const check1 = invService.checkDuplicate({
      invoiceNumber: 'INV-1042',
      supplierName: 'ABC Electronics'
    });
    expect(check1.isDuplicate).toBe(true);
    expect(check1.reason).toContain('INV-1042');

    // Check with distinct invoice number
    const check2 = invService.checkDuplicate({
      invoiceNumber: 'INV-9999',
      supplierName: 'ABC Electronics'
    });
    expect(check2.isDuplicate).toBe(false);
  });

  it('should detect duplicate by exact image hash', () => {
    const fakeImageBuffer = Buffer.from('test-image-content-xyz');
    const hash = invService.calculateImageHash(fakeImageBuffer);

    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, image_hash, status,
        duplicate_warning_shown, created_by, created_at, updated_at
      ) VALUES ('inv-2', 'INV-555', ?, 'DRAFT', 0, 'admin', '2026-10-04', '2026-10-04')
    `).run(hash);

    const dup = invService.checkDuplicate({ imageHash: hash });
    expect(dup.isDuplicate).toBe(true);
  });
});
