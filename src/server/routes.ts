import { Router } from 'express';
import { authRouter } from './auth/auth.routes';
import { dashboardRouter } from './dashboard/dashboard.routes';
import { productRouter } from './products/product.routes';
import { inventoryRouter } from './inventory/inventory.routes';
import { supplierRouter } from './suppliers/supplier.routes';
import { invoiceRouter } from './invoices/invoice.routes';
import { reorderRouter } from './reorder/reorder.routes';
import { assistantRouter } from './assistant/assistant.routes';
import { exportRouter } from './export/export.routes';
import { settingsRouter } from './settings/settings.routes';
import { authRateLimiter, aiRateLimiter } from './middleware/rate-limiter';

export const apiRouter = Router();

apiRouter.use('/auth', authRateLimiter, authRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/invoices', aiRateLimiter, invoiceRouter);
apiRouter.use('/reorder', reorderRouter);
apiRouter.use('/assistant', aiRateLimiter, assistantRouter);
apiRouter.use('/export', exportRouter);
apiRouter.use('/settings', settingsRouter);
