import { Router, Response } from 'express';
import { productService } from './product.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';

export const productRouter = Router();

// GET /api/products
productRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { search, category, supplierId, activeOnly, lowStockOnly } = req.query;

  const products = productService.getAllProducts({
    search: typeof search === 'string' ? search : undefined,
    category: typeof category === 'string' ? category : undefined,
    supplierId: typeof supplierId === 'string' ? supplierId : undefined,
    activeOnly: activeOnly === 'false' ? false : true,
    lowStockOnly: lowStockOnly === 'true'
  });

  res.json({ products });
});

// GET /api/products/:id
productRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const product = productService.getProductById(req.params.id);
  if (!product) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Product not found.'
      }
    });
    return;
  }
  res.json({ product });
});

// POST /api/products
productRouter.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      sku,
      barcode,
      category,
      brand,
      unit,
      purchasePricePaise,
      sellingPricePaise,
      minimumStock,
      reorderQuantity,
      supplierId,
      aliases,
      notes,
      initialStock
    } = req.body;

    const product = productService.createProduct({
      name,
      sku,
      barcode,
      category,
      brand,
      unit,
      purchasePricePaise: Number(purchasePricePaise) || 0,
      sellingPricePaise: Number(sellingPricePaise) || 0,
      minimumStock: Number(minimumStock) || 10,
      reorderQuantity: Number(reorderQuantity) || 50,
      supplierId,
      aliases,
      notes,
      initialStock: Number(initialStock) || 0,
      actor: req.user?.username || 'user'
    });

    res.status(201).json({ product });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'PRODUCT_CREATE_FAILED',
        message: err.message || 'Could not create product.'
      }
    });
  }
});

// PATCH /api/products/:id
productRouter.patch('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const product = productService.updateProduct(req.params.id, {
      ...req.body,
      actor: req.user?.username || 'user'
    });
    res.json({ product });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'PRODUCT_UPDATE_FAILED',
        message: err.message || 'Could not update product.'
      }
    });
  }
});
