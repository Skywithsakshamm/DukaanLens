import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/database/migrations';
import { ProductService } from '../../src/server/products/product.service';
import { ExportService } from '../../src/server/export/export.service';

describe('Data Export & Backup Services', () => {
  let db: Database.Database;
  let prodService: ProductService;
  let exportService: ExportService;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    prodService = new ProductService(db);
    exportService = new ExportService(db);

    prodService.createProduct({
      name: '1K Resistor',
      sku: 'RES-1K',
      purchasePricePaise: 240,
      sellingPricePaise: 500,
      initialStock: 20
    });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should generate valid products CSV', () => {
    const csv = exportService.exportProductsCsv();
    expect(csv).toContain('Product ID,Name,SKU');
    expect(csv).toContain('1K Resistor');
    expect(csv).toContain('2.40');
    expect(csv).toContain('5.00');
  });

  it('should generate valid inventory transactions CSV', () => {
    const csv = exportService.exportInventoryCsv();
    expect(csv).toContain('Transaction ID,Product Name,Type');
    expect(csv).toContain('OPENING_BALANCE');
  });
});
