import { Router, Response } from 'express';
import { dashboardService } from './dashboard.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';

export const dashboardRouter = Router();

// GET /api/dashboard
dashboardRouter.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const metrics = dashboardService.getDashboardMetrics();
  res.json({ metrics });
});
