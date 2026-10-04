import { Router, Response } from 'express';
import { settingsService } from './settings.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const settings = settingsService.getSystemSettingsInfo();
  res.json({ settings });
});

// PATCH /api/settings/shop
settingsRouter.patch('/shop', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const shop = settingsService.updateShop({
      ...req.body,
      actor: req.user?.username || 'user'
    });
    res.json({ shop });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'SHOP_UPDATE_FAILED',
        message: err.message || 'Failed to update shop details.'
      }
    });
  }
});
