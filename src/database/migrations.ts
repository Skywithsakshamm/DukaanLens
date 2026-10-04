import { DatabaseSync } from 'node:sqlite';
import { getDb } from './connection';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db: DatabaseSync) => {
      // 1. Users
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'owner',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 2. Shop info
      db.exec(`
        CREATE TABLE IF NOT EXISTS shop (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          owner_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          address TEXT NOT NULL,
          gstin TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 3. Suppliers
      db.exec(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          phone TEXT,
          email TEXT,
          address TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // 4. Products
      db.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sku TEXT UNIQUE,
          barcode TEXT UNIQUE,
          category TEXT,
          brand TEXT,
          unit TEXT NOT NULL DEFAULT 'pcs',
          purchase_price_paise INTEGER NOT NULL DEFAULT 0,
          selling_price_paise INTEGER NOT NULL DEFAULT 0,
          minimum_stock INTEGER NOT NULL DEFAULT 10,
          reorder_quantity INTEGER NOT NULL DEFAULT 50,
          supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
          notes TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
        CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
      `);

      // 5. Product Aliases (for smart invoice item matching)
      db.exec(`
        CREATE TABLE IF NOT EXISTS product_aliases (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          alias TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          created_at TEXT NOT NULL,
          UNIQUE(product_id, alias)
        );

        CREATE INDEX IF NOT EXISTS idx_product_aliases_alias ON product_aliases(alias);
      `);

      // 6. Invoices
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          id TEXT PRIMARY KEY,
          supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
          supplier_name_raw TEXT,
          invoice_number TEXT,
          invoice_date TEXT,
          currency TEXT NOT NULL DEFAULT 'INR',
          subtotal_paise INTEGER NOT NULL DEFAULT 0,
          tax_paise INTEGER NOT NULL DEFAULT 0,
          total_paise INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'DRAFT',
          image_path TEXT,
          image_hash TEXT,
          duplicate_warning_shown INTEGER NOT NULL DEFAULT 0,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
        CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);
        CREATE INDEX IF NOT EXISTS idx_invoices_image_hash ON invoices(image_hash);
        CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
        CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
      `);

      // 7. Invoice Items
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoice_items (
          id TEXT PRIMARY KEY,
          invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          raw_name TEXT NOT NULL,
          product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unit TEXT,
          unit_price_paise INTEGER NOT NULL DEFAULT 0,
          line_total_paise INTEGER NOT NULL DEFAULT 0,
          confidence REAL NOT NULL DEFAULT 1.0,
          match_status TEXT NOT NULL DEFAULT 'unmatched',
          match_reason TEXT,
          suggested_product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);
      `);

      // 8. Inventory Transactions (Immutable Ledger)
      db.exec(`
        CREATE TABLE IF NOT EXISTS inventory_transactions (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          quantity REAL NOT NULL,
          unit_cost_paise INTEGER,
          reference_type TEXT,
          reference_id TEXT,
          notes TEXT,
          created_by TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_inventory_tx_product_id ON inventory_transactions(product_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_tx_type ON inventory_transactions(type);
        CREATE INDEX IF NOT EXISTS idx_inventory_tx_created_at ON inventory_transactions(created_at);
        CREATE INDEX IF NOT EXISTS idx_inventory_tx_reference ON inventory_transactions(reference_type, reference_id);
      `);

      // 9. AI Extractions (Audit trail of AI raw outputs vs business records)
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_extractions (
          id TEXT PRIMARY KEY,
          reference_type TEXT NOT NULL,
          reference_id TEXT NOT NULL,
          raw_response TEXT,
          structured_data TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          latency_ms INTEGER NOT NULL DEFAULT 0,
          overall_confidence REAL NOT NULL DEFAULT 1.0,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ai_extractions_ref ON ai_extractions(reference_type, reference_id);
      `);

      // 10. AI Proposals (Safe mutation proposals awaiting user approval)
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_proposals (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_by TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_ai_proposals_status ON ai_proposals(status);
      `);

      // 11. Audit Logs
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor TEXT NOT NULL,
          action TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          before_state TEXT,
          after_state TEXT,
          timestamp TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
      `);

      // 12. Sessions (Secure server-side HTTP-only cookie store)
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      `);
    }
  }
];

export function runMigrations(customDb?: DatabaseSync): void {
  const db = customDb || getDb();

  // Create migrations tracker table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM _migrations ORDER BY version ASC').all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      db.exec('BEGIN IMMEDIATE;');
      try {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString());
        db.exec('COMMIT;');
      } catch (err) {
        try {
          db.exec('ROLLBACK;');
        } catch {
          // ignore
        }
        throw new Error(`Failed to apply migration ${migration.version} (${migration.name}): ${err}`);
      }
    }
  }
}
