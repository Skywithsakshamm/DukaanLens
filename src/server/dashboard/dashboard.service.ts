import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../../database/connection';
import { DashboardMetrics } from '../../shared/types';
import { inventoryService } from '../inventory/inventory.service';
import { invoiceService } from '../invoices/invoice.service';
import { reorderService } from '../reorder/reorder.service';

export class DashboardService {
  constructor(private db: DatabaseSync = getDb()) {}

  public getDashboardMetrics(): DashboardMetrics {
    const summary = inventoryService.getInventorySummary();
    const recentInvoices = invoiceService.getAllInvoices(5);
    const { transactions: recentTransactions } = inventoryService.getTransactions({ limit: 8 });
    const topLowStock = reorderService.getLowStockRecommendations('all').slice(0, 6);

    return {
      totalProducts: summary.totalProducts,
      lowStockCount: summary.lowStockCount,
      todayStockIn: summary.todayStockIn,
      todayStockOut: summary.todayStockOut,
      totalInventoryValuePaise: summary.totalValuationPaise,
      recentInvoices,
      recentTransactions,
      topLowStock
    };
  }
}

export const dashboardService = new DashboardService();
