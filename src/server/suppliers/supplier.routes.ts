import { Router, Response } from 'express';
import { supplierService } from './supplier.service';
import { AuthenticatedRequest, requireAuth } from '../auth/auth.middleware';

export const supplierRouter = Router();

// GET /api/suppliers
supplierRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const suppliers = supplierService.getAllSuppliers();
  res.json({ suppliers });
});

// GET /api/suppliers/:id
supplierRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const data = supplierService.getSupplierById(req.params.id);
  if (!data) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Supplier not found.'
      }
    });
    return;
  }
  res.json(data);
});

// POST /api/suppliers
supplierRouter.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    const supplier = supplierService.createSupplier({
      name,
      phone,
      email,
      address,
      notes,
      actor: req.user?.username || 'user'
    });
    res.status(201).json({ supplier });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'SUPPLIER_CREATE_FAILED',
        message: err.message || 'Failed to create supplier.'
      }
    });
  }
});

// PATCH /api/suppliers/:id
supplierRouter.patch('/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const supplier = supplierService.updateSupplier(req.params.id, {
      ...req.body,
      actor: req.user?.username || 'user'
    });
    res.json({ supplier });
  } catch (err: any) {
    res.status(400).json({
      error: {
        code: 'SUPPLIER_UPDATE_FAILED',
        message: err.message || 'Failed to update supplier.'
      }
    });
  }
});
