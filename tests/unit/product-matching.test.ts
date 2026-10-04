import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../../src/database/migrations';
import { ProductService } from '../../src/server/products/product.service';

describe('Smart Product Matching Algorithm', () => {
  let db: DatabaseSync;
  let prodService: ProductService;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    prodService = new ProductService(db);

    // Setup shop catalog
    prodService.createProduct({
      name: '1K Resistor',
      sku: 'RES-1K',
      aliases: ['1K RES', 'RES 1K OHM', '1000R', 'RESISTOR 1K']
    });

    prodService.createProduct({
      name: '10uF Capacitor',
      sku: 'CAP-10UF',
      aliases: ['10UF CAP', 'CAP 10UF 50V']
    });

    prodService.createProduct({
      name: 'USB-C Cable 1m',
      sku: 'CAB-USBC',
      aliases: ['TYPE C CABLE', 'USB C FAST CABLE']
    });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should match exact product name with 1.0 confidence', async () => {
    const result = await prodService.matchProduct('1K Resistor');
    expect(result.matchStatus).toBe('exact');
    expect(result.confidence).toBe(1.0);
    expect(result.productName).toBe('1K Resistor');
  });

  it('should match known alias variations with high confidence', async () => {
    const res1 = await prodService.matchProduct('1000R');
    expect(res1.matchStatus).toBe('high_confidence');
    expect(res1.productName).toBe('1K Resistor');

    const res2 = await prodService.matchProduct('CAP 10UF 50V');
    expect(['exact', 'high_confidence']).toContain(res2.matchStatus);
    expect(res2.productName).toBe('10uF Capacitor');
  });

  it('should match SKU embedded in raw text', async () => {
    const res = await prodService.matchProduct('ITEM SKU: CAB-USBC BLK');
    expect(res.matchStatus).toBe('exact');
    expect(res.productName).toBe('USB-C Cable 1m');
  });

  it('should mark completely unknown product as unmatched without silently linking to wrong product', async () => {
    const res = await prodService.matchProduct('HEAVY DUTY DRILL MACHINE 850W');
    expect(res.matchStatus).toBe('unmatched');
    expect(res.productId).toBeUndefined();
  });
});
