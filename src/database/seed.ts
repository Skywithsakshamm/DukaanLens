import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getDb, runTransaction } from './connection';
import { runMigrations } from './migrations';

export function seedDemoData(customDb?: DatabaseSync): void {
  const db = customDb || getDb();
  runMigrations(db);

  runTransaction(db, () => {
    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (existingUser) {
      return; // Already seeded
    }

    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const userId = crypto.randomUUID();
    const passwordHash = bcrypt.hashSync('dukaan123', 10);

    // 1. Seed Owner User
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, 'admin', 'admin@dukaanlens.local', passwordHash, 'owner', now, now);

    // 2. Seed Shop
    const shopId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO shop (id, name, owner_name, phone, address, gstin, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      shopId,
      'Gupta Electronics & Kirana',
      'Ramesh Gupta',
      '+91 98765 43210',
      'Shop No. 12, Main Market, Sadar Bazar',
      '07AAAAA0000A1Z5',
      now,
      now
    );

    // 3. Seed Suppliers
    const sup1Id = crypto.randomUUID();
    const sup2Id = crypto.randomUUID();
    const sup3Id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO suppliers (id, name, phone, email, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sup1Id,
      'ABC Electronics',
      '+91 98201 12345',
      'orders@abcelectronics.in',
      'Lamington Road, Mumbai',
      'Primary distributor for resistors, capacitors, LEDs and solder wire',
      yesterday,
      yesterday
    );

    db.prepare(`
      INSERT INTO suppliers (id, name, phone, email, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sup2Id,
      'Sharma Electricals',
      '+91 98110 54321',
      'sales@sharmaelectricals.in',
      'Bhagirath Palace, Delhi',
      'Cables, chargers, tapes and batteries',
      yesterday,
      yesterday
    );

    db.prepare(`
      INSERT INTO suppliers (id, name, phone, email, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sup3Id,
      'City Stationers',
      '+91 94330 98765',
      'info@citystationers.in',
      'College Street, Kolkata',
      'Notebooks, pens and office stationery',
      yesterday,
      yesterday
    );

    // 4. Seed Products
    const productsData = [
      {
        id: crypto.randomUUID(),
        name: '1K Resistor',
        sku: 'RES-1K-025W',
        barcode: '890100100001',
        category: 'Components',
        brand: 'Generic',
        unit: 'pcs',
        purchasePricePaise: 240, // ₹2.40
        sellingPricePaise: 500, // ₹5.00
        stock: 7, // Low Stock (Min: 20)
        minimumStock: 20,
        reorderQuantity: 100,
        supplierId: sup1Id,
        aliases: ['1K RES', 'RES 1K OHM', '1000R', 'RESISTOR 1K', '1K OHM RESISTOR']
      },
      {
        id: crypto.randomUUID(),
        name: '10uF Capacitor',
        sku: 'CAP-10UF-50V',
        barcode: '890100100002',
        category: 'Components',
        brand: 'Keltron',
        unit: 'pcs',
        purchasePricePaise: 600, // ₹6.00
        sellingPricePaise: 1200, // ₹12.00
        stock: 12, // Low Stock (Min: 25)
        minimumStock: 25,
        reorderQuantity: 50,
        supplierId: sup1Id,
        aliases: ['10UF CAP', 'CAP 10UF 50V', '10 MICROFARAD', '10UF 50V']
      },
      {
        id: crypto.randomUUID(),
        name: 'LED 5mm Red',
        sku: 'LED-5MM-RED',
        barcode: '890100100003',
        category: 'Optoelectronics',
        brand: 'Everlight',
        unit: 'pcs',
        purchasePricePaise: 250, // ₹2.50
        sellingPricePaise: 600, // ₹6.00
        stock: 42, // Low Stock (Min: 50)
        minimumStock: 50,
        reorderQuantity: 100,
        supplierId: sup1Id,
        aliases: ['LED 5MM', '5MM RED LED', 'RED LED LIGHT', 'LED RED']
      },
      {
        id: crypto.randomUUID(),
        name: 'USB-C Cable 1m',
        sku: 'CAB-USBC-1M',
        barcode: '890100100004',
        category: 'Accessories',
        brand: 'Boat',
        unit: 'pcs',
        purchasePricePaise: 8500, // ₹85.00
        sellingPricePaise: 19900, // ₹199.00
        stock: 15,
        minimumStock: 10,
        reorderQuantity: 30,
        supplierId: sup2Id,
        aliases: ['TYPE C CABLE', 'USB C FAST CABLE', 'BOAT TYPE C']
      },
      {
        id: crypto.randomUUID(),
        name: 'Mobile Charger 20W',
        sku: 'CHG-20W-PD',
        barcode: '890100100005',
        category: 'Accessories',
        brand: 'Portronics',
        unit: 'pcs',
        purchasePricePaise: 22000, // ₹220.00
        sellingPricePaise: 45000, // ₹450.00
        stock: 8,
        minimumStock: 5,
        reorderQuantity: 20,
        supplierId: sup2Id,
        aliases: ['20W CHARGER', 'PD CHARGER 20W', 'FAST CHARGER 20W']
      },
      {
        id: crypto.randomUUID(),
        name: '9V Battery Hi-Watt',
        sku: 'BAT-9V-HW',
        barcode: '890100100006',
        category: 'Power',
        brand: 'Hi-Watt',
        unit: 'pcs',
        purchasePricePaise: 2800, // ₹28.00
        sellingPricePaise: 4500, // ₹45.00
        stock: 25,
        minimumStock: 15,
        reorderQuantity: 40,
        supplierId: sup2Id,
        aliases: ['9V BATTERY', 'HW 9V', 'HI WATT 9V']
      },
      {
        id: crypto.randomUUID(),
        name: 'PVC Tape Black',
        sku: 'TAPE-PVC-BLK',
        barcode: '890100100007',
        category: 'Hardware',
        brand: 'Steelgrip',
        unit: 'rolls',
        purchasePricePaise: 1200, // ₹12.00
        sellingPricePaise: 2500, // ₹25.00
        stock: 50,
        minimumStock: 20,
        reorderQuantity: 50,
        supplierId: sup2Id,
        aliases: ['STEELGRIP TAPE', 'BLACK INSULATION TAPE', 'PVC TAPE']
      },
      {
        id: crypto.randomUUID(),
        name: 'Solder Wire 50g',
        sku: 'SLD-WIRE-50G',
        barcode: '890100100008',
        category: 'Tools',
        brand: 'Soldron',
        unit: 'spools',
        purchasePricePaise: 14000, // ₹140.00
        sellingPricePaise: 22000, // ₹220.00
        stock: 6, // Low Stock (Min: 10)
        minimumStock: 10,
        reorderQuantity: 25,
        supplierId: sup1Id,
        aliases: ['SOLDRON WIRE', 'SOLDER 50G', 'SOLDERING WIRE']
      },
      {
        id: crypto.randomUUID(),
        name: 'Notebook A5 Ruled',
        sku: 'STAT-NB-A5',
        barcode: '890100100009',
        category: 'Stationery',
        brand: 'Classmate',
        unit: 'pcs',
        purchasePricePaise: 3200, // ₹32.00
        sellingPricePaise: 5500, // ₹55.00
        stock: 35,
        minimumStock: 15,
        reorderQuantity: 50,
        supplierId: sup3Id,
        aliases: ['CLASSMATE NOTEBOOK', 'A5 NOTEBOOK', 'RULED COPY A5']
      },
      {
        id: crypto.randomUUID(),
        name: 'Ball Pen Blue 0.7mm',
        sku: 'STAT-PEN-BLU',
        barcode: '890100100010',
        category: 'Stationery',
        brand: 'Reynolds',
        unit: 'pcs',
        purchasePricePaise: 450, // ₹4.50
        sellingPricePaise: 1000, // ₹10.00
        stock: 120,
        minimumStock: 50,
        reorderQuantity: 100,
        supplierId: sup3Id,
        aliases: ['REYNOLDS BLUE', 'BLUE BALL PEN', '0.7 BLUE PEN']
      }
    ];

    const insertProd = db.prepare(`
      INSERT INTO products (
        id, name, sku, barcode, category, brand, unit,
        purchase_price_paise, selling_price_paise, minimum_stock,
        reorder_quantity, supplier_id, notes, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const insertAlias = db.prepare(`
      INSERT INTO product_aliases (id, product_id, alias, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertTx = db.prepare(`
      INSERT INTO inventory_transactions (
        id, product_id, type, quantity, unit_cost_paise,
        reference_type, reference_id, notes, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of productsData) {
      insertProd.run(
        p.id,
        p.name,
        p.sku,
        p.barcode,
        p.category,
        p.brand,
        p.unit,
        p.purchasePricePaise,
        p.sellingPricePaise,
        p.minimumStock,
        p.reorderQuantity,
        p.supplierId,
        'Demo catalog item',
        yesterday,
        yesterday
      );

      // Add aliases
      for (const alias of p.aliases) {
        insertAlias.run(crypto.randomUUID(), p.id, alias, 'manual', yesterday);
      }

      // Add opening balance transaction
      insertTx.run(
        crypto.randomUUID(),
        p.id,
        'OPENING_BALANCE',
        p.stock,
        p.purchasePricePaise,
        'opening',
        'initial_seed',
        'Initial stock intake',
        userId,
        yesterday
      );
    }

    // 5. Seed a Sample Confirmed Invoice from yesterday
    const invId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO invoices (
        id, supplier_id, supplier_name_raw, invoice_number, invoice_date,
        currency, subtotal_paise, tax_paise, total_paise, status,
        duplicate_warning_shown, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', 0, ?, ?, ?)
    `).run(
      invId,
      sup1Id,
      'ABC Electronics',
      'INV-1042',
      '2026-10-03',
      'INR',
      42000, // ₹420.00
      7560,  // 18% GST ₹75.60
      49560, // ₹495.60
      userId,
      yesterday,
      yesterday
    );

    // 6. Seed Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, actor, action, entity, entity_id, before_state, after_state, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'admin',
      'SEED_DATABASE',
      'shop',
      shopId,
      null,
      JSON.stringify({ shop: 'Gupta Electronics & Kirana', productsCount: productsData.length }),
      now
    );
  });
}
