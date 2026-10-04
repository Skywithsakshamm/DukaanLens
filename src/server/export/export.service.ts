import { DatabaseSync } from 'node:sqlite';
import { getDb, getDatabasePath } from '../../database/connection';
import { ProductService, productService } from '../products/product.service';
import { InventoryService, inventoryService } from '../inventory/inventory.service';
import { InvoiceService, invoiceService } from '../invoices/invoice.service';
import { SupplierService, supplierService } from '../suppliers/supplier.service';
import { fromPaise } from '../../shared/formatters';

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class ExportService {
  private productService: ProductService;
  private inventoryService: InventoryService;
  private invoiceService: InvoiceService;
  private supplierService: SupplierService;

  constructor(
    private db: DatabaseSync = getDb(),
    prodService?: ProductService,
    invService?: InventoryService,
    invcService?: InvoiceService,
    supService?: SupplierService
  ) {
    this.productService = prodService || new ProductService(db);
    this.inventoryService = invService || new InventoryService(db);
    this.invoiceService = invcService || new InvoiceService(db, this.productService, this.inventoryService);
    this.supplierService = supService || new SupplierService(db);
  }

  public exportProductsCsv(): string {
    const products = this.productService.getAllProducts({ activeOnly: false });
    const headers = [
      'Product ID',
      'Name',
      'SKU',
      'Barcode',
      'Category',
      'Brand',
      'Unit',
      'Current Stock',
      'Minimum Stock',
      'Reorder Quantity',
      'Purchase Price (INR)',
      'Selling Price (INR)',
      'Supplier',
      'Active',
      'Aliases',
      'Created At'
    ];

    const rows = products.map(p => [
      p.id,
      p.name,
      p.sku || '',
      p.barcode || '',
      p.category || '',
      p.brand || '',
      p.unit,
      p.currentStock,
      p.minimumStock,
      p.reorderQuantity,
      fromPaise(p.purchasePricePaise).toFixed(2),
      fromPaise(p.sellingPricePaise).toFixed(2),
      p.supplierName || '',
      p.active ? 'Yes' : 'No',
      p.aliases.join('; '),
      p.createdAt
    ]);

    return [
      headers.map(escapeCsvField).join(','),
      ...rows.map(r => r.map(escapeCsvField).join(','))
    ].join('\n');
  }

  public exportInventoryCsv(): string {
    const { transactions } = this.inventoryService.getTransactions({ limit: 5000 });
    const headers = [
      'Transaction ID',
      'Product Name',
      'Type',
      'Quantity Change',
      'Unit Cost (INR)',
      'Reference Type',
      'Reference ID',
      'Notes',
      'Created By',
      'Date & Time'
    ];

    const rows = transactions.map(t => [
      t.id,
      t.productName || '',
      t.type,
      t.quantity,
      t.unitCostPaise ? fromPaise(t.unitCostPaise).toFixed(2) : '',
      t.referenceType || '',
      t.referenceId || '',
      t.notes || '',
      t.createdBy,
      t.createdAt
    ]);

    return [
      headers.map(escapeCsvField).join(','),
      ...rows.map(r => r.map(escapeCsvField).join(','))
    ].join('\n');
  }

  public exportInvoicesCsv(): string {
    const invoices = this.invoiceService.getAllInvoices(1000);
    const headers = [
      'Invoice ID',
      'Invoice Number',
      'Supplier',
      'Invoice Date',
      'Status',
      'Subtotal (INR)',
      'Tax (INR)',
      'Total Amount (INR)',
      'Item Count',
      'Created At'
    ];

    const rows = invoices.map(i => [
      i.id,
      i.invoiceNumber || '',
      i.supplierName || i.supplierNameRaw || '',
      i.invoiceDate || '',
      i.status,
      fromPaise(i.subtotalPaise).toFixed(2),
      fromPaise(i.taxPaise).toFixed(2),
      fromPaise(i.totalPaise).toFixed(2),
      i.itemCount,
      i.createdAt
    ]);

    return [
      headers.map(escapeCsvField).join(','),
      ...rows.map(r => r.map(escapeCsvField).join(','))
    ].join('\n');
  }

  public exportSuppliersCsv(): string {
    const suppliers = this.supplierService.getAllSuppliers();
    const headers = [
      'Supplier ID',
      'Name',
      'Phone',
      'Email',
      'Address',
      'Notes',
      'Invoices Count',
      'Total Purchases (INR)',
      'Last Purchase Date',
      'Created At'
    ];

    const rows = suppliers.map(s => [
      s.id,
      s.name,
      s.phone || '',
      s.email || '',
      s.address || '',
      s.notes || '',
      s.invoiceCount || 0,
      s.totalPurchasesPaise ? fromPaise(s.totalPurchasesPaise).toFixed(2) : '0.00',
      s.lastPurchaseDate || '',
      s.createdAt
    ]);

    return [
      headers.map(escapeCsvField).join(','),
      ...rows.map(r => r.map(escapeCsvField).join(','))
    ].join('\n');
  }

  public getDatabaseFilePath(): string {
    return getDatabasePath();
  }
}

export const exportService = new ExportService();
