import React, { useEffect, useState } from 'react';
import { api } from '../api/api-client';
import { Product, Supplier } from '../../shared/types';
import { formatINR, toPaise, fromPaise } from '../../shared/formatters';
import { Modal } from '../components/Modal';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [minStock, setMinStock] = useState('10');
  const [reorderQty, setReorderQty] = useState('50');
  const [supplierId, setSupplierId] = useState('');
  const [initialStock, setInitialStock] = useState('0');
  const [aliases, setAliases] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, supRes] = await Promise.all([
        api.products.list({ search: search.trim() || undefined, category: categoryFilter || undefined }),
        api.suppliers.list()
      ]);
      setProducts(prodRes.products);
      setSuppliers(supRes.suppliers);
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

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setSku('');
    setBarcode('');
    setCategory('');
    setBrand('');
    setUnit('pcs');
    setPurchasePrice('0');
    setSellingPrice('0');
    setMinStock('10');
    setReorderQty('50');
    setSupplierId('');
    setInitialStock('0');
    setAliases('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku || '');
    setBarcode(p.barcode || '');
    setCategory(p.category || '');
    setBrand(p.brand || '');
    setUnit(p.unit);
    setPurchasePrice(String(fromPaise(p.purchasePricePaise)));
    setSellingPrice(String(fromPaise(p.sellingPricePaise)));
    setMinStock(String(p.minimumStock));
    setReorderQty(String(p.reorderQuantity));
    setSupplierId(p.supplierId || '');
    setInitialStock('0'); // not applicable on edit
    setAliases(p.aliases.join(', '));
    setNotes(p.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const aliasArray = aliases
        .split(',')
        .map(a => a.trim())
        .filter(Boolean);

      if (editingProduct) {
        await api.products.update(editingProduct.id, {
          name: name.trim(),
          sku: sku.trim() || undefined,
          barcode: barcode.trim() || undefined,
          category: category.trim() || undefined,
          brand: brand.trim() || undefined,
          unit: unit.trim() || 'pcs',
          purchasePricePaise: toPaise(parseFloat(purchasePrice) || 0),
          sellingPricePaise: toPaise(parseFloat(sellingPrice) || 0),
          minimumStock: parseInt(minStock, 10) || 10,
          reorderQuantity: parseInt(reorderQty, 10) || 50,
          supplierId: supplierId || undefined,
          aliases: aliasArray,
          notes: notes.trim() || undefined
        });
      } else {
        await api.products.create({
          name: name.trim(),
          sku: sku.trim() || undefined,
          barcode: barcode.trim() || undefined,
          category: category.trim() || undefined,
          brand: brand.trim() || undefined,
          unit: unit.trim() || 'pcs',
          purchasePricePaise: toPaise(parseFloat(purchasePrice) || 0),
          sellingPricePaise: toPaise(parseFloat(sellingPrice) || 0),
          minimumStock: parseInt(minStock, 10) || 10,
          reorderQuantity: parseInt(reorderQty, 10) || 50,
          supplierId: supplierId || undefined,
          initialStock: parseFloat(initialStock) || 0,
          aliases: aliasArray,
          notes: notes.trim() || undefined
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)' }}>
            🏷 Product Catalog
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage catalog items, pricing, reorder rules & aliases
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenAdd}>
          + Add New Product
        </button>
      </div>

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search catalog by name, SKU, or barcode..."
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

      {/* Product Cards Grid */}
      <div className="grid-3">
        {products.map(p => (
          <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--secondary)' }}>
                  {p.name}
                </h3>
                <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                  {p.category || 'General'}
                </span>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>SKU: <code style={{ backgroundColor: 'var(--bg-muted)', padding: '1px 4px', borderRadius: '4px' }}>{p.sku || 'N/A'}</code></div>
                {p.supplierName && <div>Supplier: <strong>{p.supplierName}</strong></div>}
                <div>Current Stock: <strong style={{ color: p.currentStock <= p.minimumStock ? 'var(--danger)' : 'var(--success)' }}>{p.currentStock} {p.unit}</strong> (Min: {p.minimumStock})</div>
                <div>Prices: Cost <strong>{formatINR(p.purchasePricePaise)}</strong> | Sale <strong style={{ color: 'var(--primary)' }}>{formatINR(p.sellingPricePaise)}</strong></div>
              </div>

              {p.aliases && p.aliases.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Smart Match Aliases:</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {p.aliases.map(a => (
                      <span key={a} style={{ fontSize: '0.72rem', backgroundColor: 'var(--bg-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-outline btn-sm" onClick={() => handleOpenEdit(p)}>
                ✏ Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? `Edit ${editingProduct.name}` : 'Create New Product'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 1K Resistor 0.25W"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">SKU / Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. RES-1K"
                value={sku}
                onChange={e => setSku(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Barcode</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 890123456789"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Components, Tools"
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Unit of Measure</label>
              <input
                type="text"
                className="form-input"
                placeholder="pcs, rolls, kg, box"
                value={unit}
                onChange={e => setUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Purchase Cost (₹)</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Selling Price (₹)</label>
              <input
                type="number"
                step="any"
                className="form-input"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Minimum Stock (Low Alert)</label>
              <input
                type="number"
                className="form-input"
                value={minStock}
                onChange={e => setMinStock(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reorder Quantity</label>
              <input
                type="number"
                className="form-input"
                value={reorderQty}
                onChange={e => setReorderQty(e.target.value)}
              />
            </div>
          </div>

          {!editingProduct && (
            <div className="form-group">
              <label className="form-label">Opening Stock Quantity</label>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={initialStock}
                onChange={e => setInitialStock(e.target.value)}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Preferred Supplier</label>
            <select
              className="form-select"
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
            >
              <option value="">-- None Selected --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Smart Match Aliases (comma-separated)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 1K RES, 1000R, RESISTOR 1K"
              value={aliases}
              onChange={e => setAliases(e.target.value)}
            />
            <span className="form-help">Invoice scanner will recognize these names automatically</span>
          </div>
        </form>
      </Modal>
    </div>
  );
};
