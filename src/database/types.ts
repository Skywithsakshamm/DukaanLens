// Database row interfaces matching SQLite schema

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ShopRow {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  address: string;
  gstin?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierRow {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  brand?: string | null;
  unit: string;
  purchase_price_paise: number;
  selling_price_paise: number;
  minimum_stock: number;
  reorder_quantity: number;
  supplier_id?: string | null;
  notes?: string | null;
  active: number; // 1 or 0
  created_at: string;
  updated_at: string;
}

export interface ProductAliasRow {
  id: string;
  product_id: string;
  alias: string;
  source: string;
  created_at: string;
}

export interface InvoiceRow {
  id: string;
  supplier_id?: string | null;
  supplier_name_raw?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  currency: string;
  subtotal_paise: number;
  tax_paise: number;
  total_paise: number;
  status: string;
  image_path?: string | null;
  image_hash?: string | null;
  duplicate_warning_shown: number; // 1 or 0
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  raw_name: string;
  product_id?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price_paise: number;
  line_total_paise: number;
  confidence: number;
  match_status: string;
  match_reason?: string | null;
  suggested_product_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface InventoryTransactionRow {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  unit_cost_paise?: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;
}

export interface AiExtractionRow {
  id: string;
  reference_type: string;
  reference_id: string;
  raw_response?: string | null;
  structured_data: string; // JSON
  provider: string;
  model: string;
  latency_ms: number;
  overall_confidence: number;
  created_at: string;
}

export interface AiProposalRow {
  id: string;
  type: string;
  payload: string; // JSON
  status: string;
  created_by: string;
  expires_at: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  before_state?: string | null;
  after_state?: string | null;
  timestamp: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}
