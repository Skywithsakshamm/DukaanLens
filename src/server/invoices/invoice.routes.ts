import { Router, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { invoiceService } from './invoice.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';
import { getUploadsDir } from '../../database/connection';

export const invoiceRouter = Router();

// Configure memory storage for initial upload so we can calculate hash and extract
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, or PDF image files are supported.'));
    }
  }
});

// POST /api/invoices/extract (upload & extract)
invoiceRouter.post(
  '/extract',
  requireAuth,
  upload.single('invoiceImage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file || !req.file.buffer) {
        res.status(400).json({
          error: {
            code: 'NO_FILE',
            message: 'Please select an invoice image file to upload.'
          }
        });
        return;
      }

      const invoice = await invoiceService.processAndExtractInvoice({
        fileBuffer: req.file.buffer,
        mimeType: req.file.mimetype || 'image/jpeg',
        originalFilename: req.file.originalname,
        userId: req.user?.username || 'user'
      });

      res.status(201).json({ success: true, invoice });
    } catch (err: any) {
      console.error('Invoice extraction error:', err);
      res.status(422).json({
        error: {
          code: 'EXTRACTION_FAILED',
          message: err.message || 'We could not confidently read this invoice. Please retake the photo in good lighting.'
        }
      });
    }
  }
);

// GET /api/invoices (list)
invoiceRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const invoices = invoiceService.getAllInvoices();
  res.json({ invoices });
});

// GET /api/invoices/:id (detail)
invoiceRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const invoice = invoiceService.getInvoiceById(req.params.id);
  if (!invoice) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Invoice not found.'
      }
    });
    return;
  }
  res.json({ invoice });
});

// PATCH /api/invoices/:id (update header details)
invoiceRouter.patch('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = invoiceService.updateInvoiceDetails(req.params.id, req.body);
    res.json({ invoice });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'UPDATE_FAILED',
        message: err.message || 'Could not update invoice details.'
      }
    });
  }
});

// PATCH /api/invoices/:id/items/:itemId (update line item)
invoiceRouter.patch('/:id/items/:itemId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = invoiceService.updateInvoiceItem(req.params.itemId, req.body);
    const invoice = invoiceService.getInvoiceById(req.params.id);
    res.json({ success: true, item, invoice });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'ITEM_UPDATE_FAILED',
        message: err.message || 'Could not update invoice item.'
      }
    });
  }
});

// POST /api/invoices/:id/confirm (commit stock)
invoiceRouter.post('/:id/confirm', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = invoiceService.confirmInvoice(req.params.id, req.user?.username || 'user');
    res.json({ success: true, invoice });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'CONFIRMATION_FAILED',
        message: err.message || 'Could not confirm invoice.'
      }
    });
  }
});

// POST /api/invoices/:id/cancel (cancel draft)
invoiceRouter.post('/:id/cancel', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoice = invoiceService.cancelInvoice(req.params.id, req.user?.username || 'user');
    res.json({ success: true, invoice });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'CANCEL_FAILED',
        message: err.message || 'Could not cancel invoice.'
      }
    });
  }
});

// GET /api/invoices/:id/image (serve image file safely)
invoiceRouter.get('/:id/image', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const invoice = invoiceService.getInvoiceById(req.params.id);
  if (!invoice || !invoice.imagePath) {
    res.status(404).send('Image not found');
    return;
  }

  const uploadsDir = getUploadsDir();
  // Safe resolved path inside uploadsDir
  const safeFilename = path.basename(invoice.imagePath);
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Image file not found on server');
    return;
  }

  res.sendFile(filePath);
});
