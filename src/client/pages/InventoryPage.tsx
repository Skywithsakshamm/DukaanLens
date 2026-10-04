import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/api-client';
import { Product, InventoryTransaction, TransactionType } from '../../shared/types';
import { formatINR, formatDate, formatQuantity } from '../../shared/formatters';
import { Modal } from '../components/Modal';

export const InventoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';

  const [tab, setTab] = useState<'all' | 'low' | 'out' | 'ledger'>(initialTab as any);
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Stock Adjustment Modal
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<TransactionType>('SALE');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, txRes] = await Promise.all([
        api.products.list({ search: search.trim() || undefined, category: categoryFilter || undefined }),
        api.inventory.transactions({ limit: 50 })
      ]);
      setProducts(prodRes.products);
      setTransactions(txRes.transactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, categoryFilter]);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const filteredProducts = products.filter(p => {
    if (tab === 'low') return p.currentStock <= p.minimumStock && p.currentStock > 0;
    if (tab === 'out') return p.currentStock <= 0;
    return true;
  });

  const handleOpenAdjust = (prod?: Product) => {
    setSelectedProduct(prod || products[0] || null);
    setAdjustType('SALE');
    setAdjustQty('1');
    setAdjustNotes('');
    setIsAdjustOpen(true);
  };

  const handleCommitAdjustment = async () => {
    if (!selectedProduct || !adjustQty || parseFloat(adjustQty) <= 0) return;

    setAdjustLoading(true);
    try {
      await api.inventory.adjust({
        productId: selectedProduct.id,
        type: adjustType,
        quantity: parseFloat(adjustQty),
        notes: adjustNotes.trim() || undefined
      });
      setIsAdjustOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Stock adjustment failed.');
    } finally {
      setAdjustLoading(false);
    }
  };

  // Preview stock after adjustment
  const currentStock = selectedProduct ? selectedProduct.currentStock : 0;
  const numQty = parseFloat(adjustQty) || 0;
  const isDeduction = ['SALE', 'DAMAGE', 'RETURN_OUT', 'TRANSFER_OUT'].includes(adjustType);
  const previewStockAfter = isDeduction ? Math.max(0, currentStock - numQty) : currentStock + numQty;

  return (
    <div className="app-container">
      {/* Header & Quick Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)' }}>
            📦 Inventory & Stock Ledger
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Atomic transaction ledger & real-time stock levels
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => handleOpenAdjust()}>
            ⚡ Adjust Stock / Sale
          </button>
          <Link to="/scan" className="btn btn-primary">
            📷 Scan Invoice Intake
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-light)', marginBottom: '20px', overflowX: 'auto' }}>
        <button
          className={`nav-link ${tab === 'all' ? 'active' : ''}`}
          onClick={() => { setTab('all'); setSearchParams({ tab: 'all' }); }}
          style={{ borderBottom: tab === 'all' ? '2px solid var(--primary)' : 'none', borderRadius: 0, paddingBottom: '10px' }}
        >
          All Products ({products.length})
        </button>

        <button
          className={`nav-link ${tab === 'low' ? 'active' : ''}`}
          onClick={() => { setTab('low'); setSearchParams({ tab: 'low' }); }}
          style={{ borderBottom: tab === 'low' ? '2px solid var(--primary)' : 'none', borderRadius: 0, paddingBottom: '10px' }}
        >
          ⚠️ Low Stock ({products.filter(p => p.currentStock <= p.minimumStock && p.currentStock > 0).length})
        </button>

        <button
          className={`nav-link ${tab === 'out' ? 'active' : ''}`}
          onClick={() => { setTab('out'); setSearchParams({ tab: 'out' }); }}
          style={{ borderBottom: tab === 'out' ? '2px solid var(--primary)' : 'none', borderRadius: 0, paddingBottom: '10px' }}
        >
          🚫 Out of Stock ({products.filter(p => p.currentStock <= 0).length})
        </button>

        <button
          className={`nav-link ${tab === 'ledger' ? 'active' : ''}`}
          onClick={() => { setTab('ledger'); setSearchParams({ tab: 'ledger' }); }}
          style={{ borderBottom: tab === 'ledger' ? '2px solid var(--primary)' : 'none', borderRadius: 0, paddingBottom: '10px' }}
        >
          📜 Transaction History
        </button>
      </div>

      {tab !== 'ledger' ? (
        <>
          {/* Search & Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Search stock by name, SKU or barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 2, minWidth: '220px' }}
            />

            {categories.length > 0 && (
              <select
                className="form-select"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                style={{ flex: 1, minWidth: '160px' }}
              >
                <option value="">All Categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {/* Stock Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>SKU / Category</th>
                  <th>Current Stock</th>
                  <th>Min Stock</th>
                  <th>Purchase Cost</th>
                  <th>Selling Price</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      No products found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => {
                    const isLow = p.currentStock <= p.minimumStock && p.currentStock > 0;
                    const isOut = p.currentStock <= 0;

                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--secondary)' }}>{p.name}</div>
                          {p.supplierName && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Supplier: {p.supplierName}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{p.sku || '—'}</div>
                          <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>{p.category || 'General'}</span>
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 800,
                            fontSize: '1.1rem',
                            fontFamily: 'var(--font-mono)',
                            color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)'
                          }}>
                            {formatQuantity(p.currentStock, p.unit)}
                          </span>
                          {isOut && <span className="badge badge-danger" style={{ display: 'block', width: 'fit-content', marginTop: '2px', fontSize: '0.65rem' }}>Out of Stock</span>}
                          {isLow && <span className="badge badge-warning" style={{ display: 'block', width: 'fit-content', marginTop: '2px', fontSize: '0.65rem' }}>Low Stock</span>}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {p.minimumStock} {p.unit}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {formatINR(p.purchasePricePaise)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                          {formatINR(p.sellingPricePaise)}
                        </td>
                        <td>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleOpenAdjust(p)}
                            style={{ minHeight: '30px', padding: '2px 8px', fontSize: '0.78rem' }}
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Transaction History Ledger */
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Product</th>
                <th>Transaction Type</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Reference / Notes</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No ledger transactions recorded yet.
                  </td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(t.createdAt, true)}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {t.productName}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                        {t.type}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        color: t.quantity > 0 ? 'var(--success)' : 'var(--danger)'
                      }}>
                        {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {t.unitCostPaise ? formatINR(t.unitCostPaise) : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {t.notes || t.referenceType || '—'}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {t.createdBy}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title="Quick Stock Adjustment / Sale"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setIsAdjustOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleCommitAdjustment}
              disabled={adjustLoading || !selectedProduct || !adjustQty}
            >
              {adjustLoading ? 'Applying...' : '✓ Confirm Stock Change'}
            </button>
          </>
        }
      >
        <div>
          <div className="form-group">
            <label className="form-label">Select Product</label>
            <select
              className="form-select"
              value={selectedProduct?.id || ''}
              onChange={e => {
                const found = products.find(p => p.id === e.target.value);
                setSelectedProduct(found || null);
              }}
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Current: {p.currentStock})</option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Transaction Type</label>
              <select
                className="form-select"
                value={adjustType}
                onChange={e => setAdjustType(e.target.value as TransactionType)}
              >
                <option value="SALE">SALE (Stock Out - Customer Purchase)</option>
                <option value="PURCHASE">PURCHASE (Stock In - Supplier Intake)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (Manual Inventory Audit)</option>
                <option value="DAMAGE">DAMAGE (Write-off defective/broken)</option>
                <option value="RETURN_IN">RETURN_IN (Customer Return to shop)</option>
                <option value="RETURN_OUT">RETURN_OUT (Return back to supplier)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                type="number"
                step="any"
                className="form-input"
                placeholder="e.g. 5"
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                min="0.01"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes / Reason (Optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Sold to customer Ramesh, damaged in transit..."
              value={adjustNotes}
              onChange={e => setAdjustNotes(e.target.value)}
            />
          </div>

          {/* Live Preview Box */}
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-muted)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stock Effect Preview:</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Current: {currentStock}</span>
              <span>→</span>
              <span style={{ color: isDeduction ? 'var(--danger)' : 'var(--success)' }}>
                After: {previewStockAfter} {selectedProduct?.unit || 'pcs'}
              </span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
