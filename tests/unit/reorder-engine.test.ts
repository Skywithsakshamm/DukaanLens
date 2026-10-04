import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../../src/database/migrations';
import { ProductService } from '../../src/server/products/product.service';
import { ReorderService } from '../../src/server/reorder/reorder.service';
import { InventoryService } from '../../src/server/inventory/inventory.service';

describe('Deterministic Reorder Engine', () => {
  let db: DatabaseSync;
  let prodService: ProductService;
  let reorderService: ReorderService;
  let invService: InventoryService;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    prodService = new ProductService(db);
    reorderService = new ReorderService(db);
    invService = new InventoryService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should deterministically identify low stock items and calculate recommended order', () => {
    // 1. Create product 1: 1K Resistor (Stock: 7, Min: 20, Reorder: 100) -> Low stock
    const p1 = prodService.createProduct({
      name: '1K Resistor',
      minimumStock: 20,
      reorderQuantity: 100,
      initialStock: 7
    });

    // 2. Create product 2: USB Cable (Stock: 25, Min: 10, Reorder: 30) -> Healthy stock
    prodService.createProduct({
      name: 'USB-C Cable',
      minimumStock: 10,
      reorderQuantity: 30,
      initialStock: 25
    });

    // 3. Create product 3: Out of stock (Stock: 0, Min: 15, Reorder: 50) -> Critical
    const p3 = prodService.createProduct({
      name: 'Solder Wire',
      minimumStock: 15,
      reorderQuantity: 50,
      initialStock: 0
    });

    const recommendations = reorderService.getLowStockRecommendations('all');
    expect(recommendations.length).toBe(2);

    // Critical out of stock item should be first
    expect(recommendations[0].productId).toBe(p3.id);
    expect(recommendations[0].status).toBe('critical');
    expect(recommendations[0].recommendedOrder).toBe(50);

    // Second item should be 1K Resistor
    expect(recommendations[1].productId).toBe(p1.id);
    expect(recommendations[1].currentStock).toBe(7);
    expect(recommendations[1].recommendedOrder).toBe(100);
  });

  it('should remove product from low stock once inventory is replenished above minimum', () => {
    const p = prodService.createProduct({
      name: 'LED 5mm Red',
      minimumStock: 25,
      reorderQuantity: 50,
      initialStock: 10
    });

    expect(reorderService.getLowStockRecommendations().length).toBe(1);

    // Restock +50 units
    invService.addTransaction({
      productId: p.id,
      type: 'PURCHASE',
      quantity: 50,
      createdBy: 'test'
    });

    // Current stock is now 60 > 25
    expect(reorderService.getLowStockRecommendations().length).toBe(0);
  });
});
