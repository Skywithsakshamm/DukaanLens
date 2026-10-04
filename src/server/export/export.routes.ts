import { Router, Response } from 'express';
import fs from 'node:fs';
import { exportService } from './export.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';

export const exportRouter = Router();

// GET /api/export/products.csv
exportRouter.get('/products.csv', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const csv = exportService.exportProductsCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="dukaanlens_products.csv"');
  res.send(csv);
});

// GET /api/export/inventory.csv
exportRouter.get('/inventory.csv', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const csv = exportService.exportInventoryCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="dukaanlens_inventory_ledger.csv"');
  res.send(csv);
});

// GET /api/export/invoices.csv
exportRouter.get('/invoices.csv', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const csv = exportService.exportInvoicesCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="dukaanlens_invoices.csv"');
  res.send(csv);
});

// GET /api/export/suppliers.csv
exportRouter.get('/suppliers.csv', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const csv = exportService.exportSuppliersCsv();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="dukaanlens_suppliers.csv"');
  res.send(csv);
});

// GET /api/export/backup.db (database backup)
exportRouter.get('/backup.db', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
  const dbPath = exportService.getDatabaseFilePath();
  if (!fs.existsSync(dbPath)) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Database file not found.'
      }
    });
    return;
  }

  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', 'attachment; filename="dukaanlens_backup.db"');
  res.sendFile(dbPath);
});
