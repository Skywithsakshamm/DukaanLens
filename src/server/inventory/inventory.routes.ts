import { Router, Response } from 'express';
import { inventoryService } from './inventory.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';

export const inventoryRouter = Router();

// GET /api/inventory (summary & stock overview)
inventoryRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const summary = inventoryService.getInventorySummary();
  res.json({ summary });
});

// GET /api/inventory/transactions
inventoryRouter.get('/transactions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { productId, type, limit, offset } = req.query;

  const result = inventoryService.getTransactions({
    productId: typeof productId === 'string' ? productId : undefined,
    type: typeof type === 'string' ? type : undefined,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0
  });

  res.json(result);
});

// POST /api/inventory/adjust
inventoryRouter.post('/adjust', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, type, quantity, notes, unitCostPaise } = req.body;

    if (!productId || !type || quantity === undefined || quantity === null || isNaN(Number(quantity))) {
      res.status(400).json({
        error: {
          code: 'INVALID_ADJUSTMENT',
          message: 'Product ID, adjustment type, and valid quantity are required.'
        }
      });
      return;
    }

    const transaction = inventoryService.adjustStock({
      productId,
      type,
      quantity: Number(quantity),
      notes,
      unitCostPaise: unitCostPaise ? Number(unitCostPaise) : undefined,
      createdBy: req.user?.username || 'user'
    });

    res.status(201).json({ success: true, transaction });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'ADJUSTMENT_FAILED',
        message: err.message || 'Failed to adjust stock.'
      }
    });
  }
});
