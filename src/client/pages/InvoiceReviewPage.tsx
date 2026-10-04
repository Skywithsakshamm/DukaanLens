import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/api-client';
import { Invoice, InvoiceItem, Product } from '../../shared/types';
import { formatINR, formatDate, toPaise, fromPaise } from '../../shared/formatters';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { Modal } from '../components/Modal';

export const InvoiceReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Line Item State
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editProductId, setEditProductId] = useState('');

  // Map to Product Modal
  const [mappingItem, setMappingItem] = useState<InvoiceItem | null>(null);

  // Create Product on the fly Modal
  const [creatingForProduct, setCreatingForProduct] = useState<InvoiceItem | null>(null);
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdMinStock, setNewProdMinStock] = useState('10');
  const [newProdReorderQty, setNewProdReorderQty] = useState('50');

  const loadInvoiceAndCatalog = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [invRes, prodRes] = await Promise.all([
        api.invoices.get(id),
        api.products.list({ activeOnly: true })
      ]);
      setInvoice(invRes.invoice);
      setProducts(prodRes.products);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoice details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoiceAndCatalog();
  }, [id]);

  const handleConfirmInvoice = async () => {
    if (!invoice) return;
    setConfirming(true);
    setError(null);

    try {
      const res = await api.invoices.confirm(invoice.id);
      setInvoice(res.invoice);
      setSuccessMessage('Invoice successfully confirmed! All product inventory has been updated.');
    } catch (err: any) {
      setError(err.message || 'Could not confirm invoice.');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice || !window.confirm('Are you sure you want to cancel this invoice draft?')) return;
    try {
      await api.invoices.cancel(invoice.id);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to cancel invoice.');
    }
  };

  const handleSaveItemEdit = async () => {
    if (!invoice || !editingItem) return;

    try {
      await api.invoices.updateItem(invoice.id, editingItem.id, {
        quantity: parseFloat(editQty) || 1,
        unitPricePaise: toPaise(parseFloat(editPrice) || 0),
        productId: editProductId || undefined
      });
      setEditingItem(null);
      await loadInvoiceAndCatalog();
    } catch (err: any) {
      alert(err.message || 'Failed to update line item.');
    }
  };

  const handleMapProduct = async (productId: string) => {
    if (!invoice || !mappingItem) return;

    try {
      await api.invoices.updateItem(invoice.id, mappingItem.id, {
        productId
      });
      setMappingItem(null);
      await loadInvoiceAndCatalog();
    } catch (err: any) {
      alert(err.message || 'Failed to map product.');
    }
  };

  const handleCreateNewProduct = async () => {
    if (!invoice || !creatingForProduct || !newProdName.trim()) return;

    try {
      const unitPricePaise = creatingForProduct.unitPricePaise || 0;
      const created = await api.products.create({
        name: newProdName.trim(),
        sku: newProdSku.trim() || undefined,
        category: newProdCategory.trim() || 'General',
        purchasePricePaise: unitPricePaise,
        sellingPricePaise: Math.round(unitPricePaise * 1.5),
        minimumStock: parseInt(newProdMinStock, 10) || 10,
        reorderQuantity: parseInt(newProdReorderQty, 10) || 50,
        supplierId: invoice.supplierId,
        aliases: [creatingForProduct.rawName]
      });

      // Link newly created product to invoice item
      await api.invoices.updateItem(invoice.id, creatingForProduct.id, {
        productId: created.product.id
      });

      setCreatingForProduct(null);
      await loadInvoiceAndCatalog();
    } catch (err: any) {
      alert(err.message || 'Failed to create new product.');
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⏳</div>
        <h2>Loading extracted invoice...</h2>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="app-container">
        <div className="alert alert-danger">{error}</div>
        <Link to="/scan" className="btn btn-outline">Back to Scanner</Link>
      </div>
    );
  }

  if (!invoice) return null;

  const isConfirmed = invoice.status === 'CONFIRMED';
  const hasUnmapped = invoice.items?.some(i => !i.productId);

  return (
    <div className="app-container" style={{ maxWidth: '900px' }}>
      {/* Header Back & Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
        <span className={isConfirmed ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: '0.85rem' }}>
          {isConfirmed ? '✓ CONFIRMED & ADDED' : '📝 REVIEW DRAFT'}
        </span>
      </div>

      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          <span>✓</span> <div><strong>Success:</strong> {successMessage}</div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          <span>✕</span> {error}
        </div>
      )}

      {/* Duplicate Alert Banner */}
      {invoice.duplicateWarningShown && !isConfirmed && (
        <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            <strong>Possible Duplicate Invoice Detected</strong>
            <p style={{ fontSize: '0.85rem', marginTop: '2px' }}>
              An invoice with similar supplier details, date, or image already exists. Please check carefully before confirming to prevent accidental double-stock entry.
            </p>
          </div>
        </div>
      )}

      {/* Invoice Meta Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Supplier</span>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--secondary)' }}>
              {invoice.supplierName || invoice.supplierNameRaw || 'Unknown Supplier'}
            </h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Invoice #{invoice.invoiceNumber || 'N/A'} • Date: {formatDate(invoice.invoiceDate || invoice.createdAt)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Amount</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
              {formatINR(invoice.totalPaise)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Subtotal: {formatINR(invoice.subtotalPaise)} | Tax: {formatINR(invoice.taxPaise)}
            </div>
          </div>
        </div>
      </div>

      {/* Extracted Line Items Review Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">Extracted Products ({invoice.items?.length || 0})</h3>
            <p className="card-subtitle">
              Verify detected items and their stock impact before committing.
            </p>
          </div>
        </div>

        {(!invoice.items || invoice.items.length === 0) ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No line items extracted from this invoice.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {invoice.items.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: item.productId ? '1px solid var(--border-light)' : '2px dashed var(--danger-border)',
                  backgroundColor: item.productId ? '#ffffff' : 'var(--danger-light)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--secondary)' }}>
                        {item.productName || item.rawName}
                      </strong>
                      <ConfidenceBadge
                        status={item.matchStatus}
                        confidence={item.confidence}
                        reason={item.matchReason}
                      />
                    </div>

                    {item.productName && item.rawName.toLowerCase() !== item.productName.toLowerCase() && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Observed on invoice: <code style={{ backgroundColor: 'var(--bg-muted)', padding: '1px 4px', borderRadius: '4px' }}>{item.rawName}</code>
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
                        {item.quantity} {item.unit || 'pcs'} × {formatINR(item.unitPricePaise)}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>
                        = {formatINR(item.lineTotalPaise)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock Impact Box */}
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-muted)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.88rem'
                }}>
                  <div>
                    Stock Impact: Current <strong style={{ color: 'var(--secondary)' }}>{item.currentStock ?? '—'}</strong> → After Intake <strong style={{ color: 'var(--success)' }}>{item.stockAfter ?? '—'}</strong>
                  </div>

                  {!isConfirmed && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.78rem' }}
                        onClick={() => {
                          setEditingItem(item);
                          setEditQty(String(item.quantity));
                          setEditPrice(String(fromPaise(item.unitPricePaise)));
                          setEditProductId(item.productId || '');
                        }}
                      >
                        ✏ Edit Qty/Price
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.78rem' }}
                        onClick={() => setMappingItem(item)}
                      >
                        🔗 Map Product
                      </button>

                      {!item.productId && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.78rem' }}
                          onClick={() => {
                            setCreatingForProduct(item);
                            setNewProdName(item.rawName);
                            setNewProdSku('');
                            setNewProdCategory('General');
                          }}
                        >
                          + Create Product
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation & Actions Bar */}
      {!isConfirmed ? (
        <div style={{
          position: 'sticky',
          bottom: '16px',
          zIndex: 30,
          padding: '16px',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-floating)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--secondary)' }}>
              Ready to commit stock?
            </div>
            <div style={{ fontSize: '0.8rem', color: hasUnmapped ? 'var(--danger)' : 'var(--text-muted)' }}>
              {hasUnmapped ? '⚠️ Resolve all unmapped items before confirming' : 'Stock will be atomically credited to ledger'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-outline btn-danger"
              onClick={handleCancelInvoice}
              disabled={confirming}
            >
              Cancel Draft
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleConfirmInvoice}
              disabled={confirming || hasUnmapped}
              style={{ minWidth: '200px' }}
            >
              {confirming ? 'Adding Stock...' : '✓ Confirm & Add Stock'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/inventory" className="btn btn-primary btn-lg">
            📦 View Updated Inventory Ledger
          </Link>
        </div>
      )}

      {/* Modal 1: Edit Item Qty/Price */}
      <Modal
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        title="Edit Line Item"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditingItem(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveItemEdit}>Save Changes</button>
          </>
        }
      >
        {editingItem && (
          <div>
            <div className="form-group">
              <label className="form-label">Raw Name</label>
              <input type="text" className="form-input" value={editingItem.rawName} disabled />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={editQty}
                  onChange={e => setEditQty(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit Price (₹)</label>
                <input
                  type="number"
                  step="any"
                  className="form-input"
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mapped Catalog Product</label>
              <select
                className="form-select"
                value={editProductId}
                onChange={e => setEditProductId(e.target.value)}
              >
                <option value="">-- Choose Existing Product --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock})</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 2: Map to Product */}
      <Modal
        isOpen={Boolean(mappingItem)}
        onClose={() => setMappingItem(null)}
        title="Map Item to Catalog Product"
      >
        {mappingItem && (
          <div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Select which product in your shop corresponds to: <strong>"{mappingItem.rawName}"</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {products.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleMapProduct(p.id)}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary-light)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      SKU: {p.sku || 'N/A'} • Category: {p.category || 'General'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                    <div>Current Stock: <strong>{p.currentStock}</strong></div>
                    <span className="btn btn-sm btn-outline" style={{ marginTop: '4px' }}>Select</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 3: Create Product on the fly */}
      <Modal
        isOpen={Boolean(creatingForProduct)}
        onClose={() => setCreatingForProduct(null)}
        title="Add New Product to Catalog"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCreatingForProduct(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateNewProduct}>Create & Link</button>
          </>
        }
      >
        <div>
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              className="form-input"
              value={newProdName}
              onChange={e => setNewProdName(e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">SKU / Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. ELEC-001"
                value={newProdSku}
                onChange={e => setNewProdSku(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Components"
                value={newProdCategory}
                onChange={e => setNewProdCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Minimum Stock Alert</label>
              <input
                type="number"
                className="form-input"
                value={newProdMinStock}
                onChange={e => setNewProdMinStock(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Recommended Reorder Qty</label>
              <input
                type="number"
                className="form-input"
                value={newProdReorderQty}
                onChange={e => setNewProdReorderQty(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
