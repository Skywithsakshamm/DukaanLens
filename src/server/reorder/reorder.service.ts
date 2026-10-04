import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../../database/connection';
import { ReorderItem } from '../../shared/types';
import { ProductRow } from '../../database/types';
import { ProductService, productService } from '../products/product.service';

export class ReorderService {
  private productService: ProductService;

  constructor(
    private db: DatabaseSync = getDb(),
    prodService?: ProductService
  ) {
    this.productService = prodService || new ProductService(db);
  }

  public getLowStockRecommendations(filter: 'all' | 'critical' | 'low_stock' = 'all'): ReorderItem[] {
    const products = this.db.prepare(`
      SELECT p.*, s.name as supplier_name
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.active = 1
      ORDER BY p.name ASC
    `).all() as unknown as Array<ProductRow & { supplier_name?: string }>;

    const stockMap = this.productService.getStockMap();
    const recommendations: ReorderItem[] = [];

    for (const p of products) {
      const currentStock = stockMap.get(p.id) ?? 0;
      const minimumStock = p.minimum_stock;

      if (currentStock <= minimumStock) {
        const isCritical = currentStock <= 0 || currentStock <= Math.floor(minimumStock / 2);
        const status = isCritical ? 'critical' : 'low_stock';

        // Apply filter if specified
        if (filter === 'critical' && status !== 'critical') {
          continue;
        }

        const recommendedOrder = p.reorder_quantity > 0
          ? p.reorder_quantity
          : Math.max(minimumStock * 2 - currentStock, 10);

        recommendations.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku || undefined,
          currentStock,
          minimumStock,
          recommendedOrder,
          lastPurchasePricePaise: p.purchase_price_paise,
          supplierId: p.supplier_id || undefined,
          supplierName: p.supplier_name || undefined,
          category: p.category || undefined,
          status
        });
      }
    }

    // Sort: Critical items first, then lowest stock ratio
    recommendations.sort((a, b) => {
      if (a.status === 'critical' && b.status !== 'critical') return -1;
      if (b.status === 'critical' && a.status !== 'critical') return 1;
      return (a.currentStock / Math.max(1, a.minimumStock)) - (b.currentStock / Math.max(1, b.minimumStock));
    });

    return recommendations;
  }
}

export const reorderService = new ReorderService();
