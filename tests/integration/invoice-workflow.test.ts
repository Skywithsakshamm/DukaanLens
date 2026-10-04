import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/database/migrations';
import { ProductService } from '../../src/server/products/product.service';
import { InventoryService } from '../../src/server/inventory/inventory.service';
import { InvoiceService } from '../../src/server/invoices/invoice.service';
import { ReorderService } from '../../src/server/reorder/reorder.service';
import { AssistantService } from '../../src/server/assistant/assistant.service';

describe('Data Integrity & Invoice End-to-End Workflow (Section 50 Verification)', () => {
  let db: Database.Database;
  let prodService: ProductService;
  let invService: InventoryService;
  let invoiceService: InvoiceService;
  let reorderService: ReorderService;
  let assistantService: AssistantService;

  beforeEach(() => {
    process.env.MOCK_AI = 'true';
    db = new Database(':memory:');
    runMigrations(db);
    prodService = new ProductService(db);
    invService = new InventoryService(db);
    invoiceService = new InvoiceService(db);
    reorderService = new ReorderService(db);
    assistantService = new AssistantService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('executes the complete sequence: Create product -> Scan -> Review -> Confirm -> Verify 57 -> Sale -50 -> Verify 7 -> Reorder Query', async () => {
    // Step 1: Create demo products: 1K Resistor (Current stock = 7, Min = 20, Reorder = 100), Capacitor, and LED
    const product = prodService.createProduct({
      name: '1K Resistor',
      sku: 'RES-1K',
      purchasePricePaise: 240,
      sellingPricePaise: 500,
      minimumStock: 20,
      reorderQuantity: 100,
      initialStock: 7,
      aliases: ['1K RES', '1K RES 1/4W 5%', 'RES 1K OHM', '1000R']
    });

    prodService.createProduct({
      name: '10uF Capacitor',
      sku: 'CAP-10UF',
      purchasePricePaise: 600,
      sellingPricePaise: 1200,
      minimumStock: 15,
      reorderQuantity: 50,
      initialStock: 12,
      aliases: ['10uF 50V Electrolytic Capacitor', '10uF Capacitor']
    });

    prodService.createProduct({
      name: 'LED 5mm Red',
      sku: 'LED-5MM-RED',
      purchasePricePaise: 150,
      sellingPricePaise: 300,
      minimumStock: 25,
      reorderQuantity: 100,
      initialStock: 20,
      aliases: ['5mm Red LED Diffused', 'LED 5mm Red', 'LED 5mm']
    });

    expect(prodService.getProductStock(product.id)).toBe(7);

    // Step 2: Process an invoice containing 50 × 1K Resistor
    const fakeImageBuffer = Buffer.from('simulated-invoice-image-bytes');
    const invoiceDraft = await invoiceService.processAndExtractInvoice({
      fileBuffer: fakeImageBuffer,
      mimeType: 'image/jpeg',
      userId: 'admin'
    });

    expect(invoiceDraft.status).toBe('DRAFT');
    expect(invoiceDraft.items && invoiceDraft.items.length > 0).toBe(true);

    // Match or verify line item
    const lineItem = invoiceDraft.items!.find(i => i.productName === '1K Resistor' || i.rawName.includes('1K RES'));
    expect(lineItem).toBeDefined();

    // Ensure stock has NOT changed before human confirmation gate
    expect(prodService.getProductStock(product.id)).toBe(7);

    // Step 3: Human Review & Confirm
    const confirmedInvoice = invoiceService.confirmInvoice(invoiceDraft.id, 'admin');
    expect(confirmedInvoice.status).toBe('CONFIRMED');

    // Step 4: Verify stock = 57 (7 initial + 50 from invoice)
    expect(prodService.getProductStock(product.id)).toBe(57);

    // Step 5: Apply a sale/adjustment of -50
    invService.adjustStock({
      productId: product.id,
      type: 'SALE',
      quantity: 50,
      notes: 'Customer retail sale',
      createdBy: 'admin'
    });

    // Step 6: Verify stock = 7
    expect(prodService.getProductStock(product.id)).toBe(7);

    // Step 7: Deterministic reorder check
    const lowStock = reorderService.getLowStockRecommendations('all');
    const foundLow = lowStock.find(i => i.productId === product.id);
    expect(foundLow).toBeDefined();
    expect(foundLow!.currentStock).toBe(7);
    expect(foundLow!.minimumStock).toBe(20);
    expect(foundLow!.recommendedOrder).toBe(100);

    // Step 8: Ask Assistant: "Kya mangwana hai?"
    const assistantReply = await assistantService.query('Kya mangwana hai?', 'admin');
    expect(assistantReply.text).toContain('1K Resistor');
  });
});
