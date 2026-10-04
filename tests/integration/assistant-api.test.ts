import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../../src/database/migrations';
import { ProductService } from '../../src/server/products/product.service';
import { AssistantService } from '../../src/server/assistant/assistant.service';

describe('Assistant Grounded Q&A and Safe Proposal Gate', () => {
  let db: DatabaseSync;
  let prodService: ProductService;
  let assistantService: AssistantService;

  beforeEach(() => {
    process.env.MOCK_AI = 'true';
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    prodService = new ProductService(db);
    assistantService = new AssistantService(db);

    prodService.createProduct({
      name: 'LED 5mm Red',
      sku: 'LED-5MM',
      initialStock: 42,
      minimumStock: 50,
      reorderQuantity: 100,
      purchasePricePaise: 250
    });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should answer read-only stock queries in conversational Hinglish', async () => {
    const res = await assistantService.query('LED 5mm kitne bache hain?', 'test-user');
    expect(res.text).toContain('42');
    expect(res.proposal).toBeUndefined();
  });

  it('should formulate safe proposal for stock additions without immediately mutating stock', async () => {
    const res = await assistantService.query('20 piece LED stock mein add karo', 'test-user');
    expect(res.proposal).toBeDefined();
    expect(res.proposal?.quantity).toBe(20);
    expect(res.proposal?.currentStock).toBe(42);
    expect(res.proposal?.newStock).toBe(62);

    // Verify stock is still 42 before confirmation
    const p = prodService.getAllProducts()[0];
    expect(p.currentStock).toBe(42);

    // Confirm proposal
    const confirmRes = assistantService.confirmProposal(res.proposal!.proposalId, 'test-user');
    expect(confirmRes.success).toBe(true);

    // Verify stock is now 62
    expect(prodService.getProductStock(p.id)).toBe(62);
  });
});
