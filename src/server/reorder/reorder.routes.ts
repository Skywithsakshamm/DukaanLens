import { Router, Response } from 'express';
import { reorderService } from './reorder.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';

export const reorderRouter = Router();

// GET /api/reorder/low-stock
reorderRouter.get('/low-stock', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const filter = (req.query.filter as 'all' | 'critical' | 'low_stock') || 'all';
  const recommendations = reorderService.getLowStockRecommendations(filter);
  res.json({ recommendations, count: recommendations.length });
});
