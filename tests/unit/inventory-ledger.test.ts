import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../../src/database/migrations';
import { InventoryService } from '../../src/server/inventory/inventory.service';
import { ProductService } from '../../src/server/products/product.service';

describe('Inventory Ledger & Atomic Transactions', () => {
  let db: DatabaseSync;
  let invService: InventoryService;
  let prodService: ProductService;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    invService = new InventoryService(db);
    prodService = new ProductService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should maintain exact stock arithmetic through purchase and sales transactions', () => {
    // 1. Create product with initial stock = 7
    const product = prodService.createProduct({
      name: '1K Resistor',
      sku: 'RES-1K',
      unit: 'pcs',
      purchasePricePaise: 240,
      sellingPricePaise: 500,
      minimumStock: 20,
      reorderQuantity: 100,
      initialStock: 7
    });

    expect(prodService.getProductStock(product.id)).toBe(7);

    // 2. Add Invoice Purchase (+50)
    invService.addTransaction({
      productId: product.id,
      type: 'PURCHASE',
      quantity: 50,
      unitCostPaise: 240,
      referenceType: 'invoice',
      referenceId: 'INV-1042',
      createdBy: 'test-user'
    });

    expect(prodService.getProductStock(product.id)).toBe(57);

    // 3. Add Sale (-50)
    invService.adjustStock({
      productId: product.id,
      type: 'SALE',
      quantity: 50,
      notes: 'Sold to customer',
      createdBy: 'test-user'
    });

    expect(prodService.getProductStock(product.id)).toBe(7);

    // 4. Verify transaction ledger count
    const { transactions, total } = invService.getTransactions({ productId: product.id });
    expect(total).toBe(3); // OPENING_BALANCE + PURCHASE + SALE
    expect(transactions.length).toBe(3);
  });

  it('should prevent adjustments on non-existent product', () => {
    expect(() => {
      invService.adjustStock({
        productId: 'non-existent-id',
        type: 'SALE',
        quantity: 10,
        createdBy: 'test-user'
      });
    }).toThrow(/does not exist/);
  });
});
