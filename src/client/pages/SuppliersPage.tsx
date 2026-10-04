import React, { useEffect, useState } from 'react';
import { api } from '../api/api-client';
import { Supplier, Product } from '../../shared/types';
import { formatINR, formatDate } from '../../shared/formatters';
import { Modal } from '../components/Modal';

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // View Supplier Details
  const [selectedSupplierData, setSelectedSupplierData] = useState<{ supplier: Supplier; suppliedProducts: Product[] } | null>(null);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.suppliers.list();
      setSuppliers(res.suppliers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSupplier(s);
    setName(s.name);
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setAddress(s.address || '');
    setNotes(s.notes || '');
    setIsModalOpen(true);
  };

  const handleViewSupplier = async (id: string) => {
    try {
      const data = await api.suppliers.get(id);
      setSelectedSupplierData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load supplier details.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (editingSupplier) {
        await api.suppliers.update(editingSupplier.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined
        });
      } else {
        await api.suppliers.create({
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined
        });
      }

      setIsModalOpen(false);
      await loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Failed to save supplier.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)' }}>
            🚚 Supplier Directory
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Vendors, distributors, contact details & purchase history
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenAdd}>
          + Add New Supplier
        </button>
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid-3">
        {suppliers.map(s => (
          <div
            key={s.id}
            className="card"
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            onClick={() => handleViewSupplier(s.id)}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--secondary)' }}>
                  {s.name}
                </h3>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={(e) => handleOpenEdit(s, e)}
                  style={{ minHeight: '28px', padding: '2px 8px', fontSize: '0.75rem' }}
                >
                  ✏ Edit
                </button>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {s.phone && <div>📞 {s.phone}</div>}
                {s.email && <div>✉ {s.email}</div>}
                {s.address && <div>📍 {s.address}</div>}
                {s.notes && <div style={{ fontStyle: 'italic', marginTop: '4px' }}>"{s.notes}"</div>}
              </div>
            </div>

            <div style={{
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.82rem'
            }}>
              <div>Invoices: <strong>{s.invoiceCount || 0}</strong></div>
              <div>Purchases: <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{formatINR(s.totalPurchasesPaise)}</strong></div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? `Edit ${editingSupplier.name}` : 'Add New Supplier'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : editingSupplier ? 'Save Changes' : 'Add Supplier'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Supplier Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. ABC Electronics"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91 98201 12345"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="orders@supplier.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address / Market Location</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Lamington Road, Mumbai"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes / Items Supplied</label>
            <textarea
              className="form-textarea"
              placeholder="e.g. Primary distributor for resistors, capacitors..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* View Supplier Detail Modal */}
      <Modal
        isOpen={Boolean(selectedSupplierData)}
        onClose={() => setSelectedSupplierData(null)}
        title={selectedSupplierData ? selectedSupplierData.supplier.name : 'Supplier Details'}
        footer={<button className="btn btn-primary" onClick={() => setSelectedSupplierData(null)}>Close</button>}
      >
        {selectedSupplierData && (
          <div>
            <div style={{ marginBottom: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {selectedSupplierData.supplier.phone && <div>📞 {selectedSupplierData.supplier.phone}</div>}
              {selectedSupplierData.supplier.address && <div>📍 {selectedSupplierData.supplier.address}</div>}
              <div style={{ marginTop: '6px' }}>
                Total Purchases: <strong style={{ color: 'var(--primary)' }}>{formatINR(selectedSupplierData.supplier.totalPurchasesPaise)}</strong> across {selectedSupplierData.supplier.invoiceCount || 0} invoices.
              </div>
            </div>

            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>
              Supplied Catalog Products ({selectedSupplierData.suppliedProducts.length})
            </h4>

            {selectedSupplierData.suppliedProducts.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No products linked as preferred supplier yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '250px', overflowY: 'auto' }}>
                {selectedSupplierData.suppliedProducts.map(p => (
                  <div key={p.id} style={{ padding: '8px 10px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span>{p.name}</span>
                    <span>Cost: <strong>{formatINR(p.purchasePricePaise)}</strong></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
