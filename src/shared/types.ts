// Shared Types for DukaanLens

export type TransactionType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'ADJUSTMENT'
  | 'DAMAGE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'OPENING_BALANCE';

export type InvoiceStatus =
  | 'DRAFT'
  | 'PROCESSING'
  | 'REVIEW'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'FAILED';

export type MatchStatus =
  | 'exact'
  | 'high_confidence'
  | 'needs_review'
  | 'unmatched';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'owner' | 'staff';
  createdAt: string;
  updatedAt: string;
}

export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  gstin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  totalPurchasesPaise?: number;
  lastPurchaseDate?: string;
  invoiceCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  brand?: string;
  unit: string;
  purchasePricePaise: number; // Stored in minor units (paise)
  sellingPricePaise: number;
  currentStock: number;
  minimumStock: number;
  reorderQuantity: number;
  supplierId?: string;
  supplierName?: string;
  aliases: string[];
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAlias {
  id: string;
  productId: string;
  alias: string;
  source: 'manual' | 'invoice_learning';
  createdAt: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName?: string;
  type: TransactionType;
  quantity: number; // positive or negative
  unitCostPaise?: number;
  referenceType?: 'invoice' | 'manual' | 'assistant_proposal' | 'opening';
  referenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  rawName: string;
  productId?: string;
  productName?: string;
  currentStock?: number;
  stockAfter?: number;
  quantity: number;
  unit?: string;
  unitPricePaise: number;
  lineTotalPaise: number;
  confidence: number;
  matchStatus: MatchStatus;
  matchReason?: string;
  suggestedProductId?: string;
  suggestedProductName?: string;
  notes?: string;
}

export interface Invoice {
  id: string;
  supplierId?: string;
  supplierNameRaw?: string;
  supplierName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  currency: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  status: InvoiceStatus;
  imagePath?: string;
  imageHash?: string;
  duplicateWarningShown: boolean;
  itemCount: number;
  items?: InvoiceItem[];
  overallConfidence: number;
  warnings: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReorderItem {
  productId: string;
  productName: string;
  sku?: string;
  currentStock: number;
  minimumStock: number;
  recommendedOrder: number;
  lastPurchasePricePaise: number;
  supplierId?: string;
  supplierName?: string;
  category?: string;
  status: 'critical' | 'low_stock';
}

export interface StockAdjustmentRequest {
  productId: string;
  type: TransactionType;
  quantity: number;
  notes?: string;
  unitCostPaise?: number;
}

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  language?: 'english' | 'hindi' | 'hinglish';
  timestamp: string;
  proposal?: AssistantProposal;
}

export interface AssistantProposal {
  proposalId: string;
  type: 'stock_adjustment' | 'create_product';
  productId?: string;
  productName?: string;
  currentStock?: number;
  quantity?: number;
  direction?: 'in' | 'out';
  transactionType?: TransactionType;
  newStock?: number;
  reason?: string;
  expiresAt: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'expired';
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  beforeState?: string;
  afterState?: string;
  timestamp: string;
}

export interface DashboardMetrics {
  totalProducts: number;
  lowStockCount: number;
  todayStockIn: number;
  todayStockOut: number;
  totalInventoryValuePaise: number;
  recentInvoices: Invoice[];
  recentTransactions: InventoryTransaction[];
  topLowStock: ReorderItem[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  database: 'ok' | 'error';
  ai: 'configured' | 'unconfigured' | 'mock';
  model: string;
  dataDir: string;
  timestamp: string;
}
