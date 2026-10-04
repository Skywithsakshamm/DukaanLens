import React, { useEffect, useState } from 'react';
import { api } from '../api/api-client';
import { Shop } from '../../shared/types';

interface Props {
  onShopUpdated?: (name: string) => void;
  onLogout: () => void;
}

export const SettingsPage: React.FC<Props> = ({ onShopUpdated, onLogout }) => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Shop Edit Form
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.settings.get();
      setSettings(res.settings);
      if (res.settings.shop) {
        setName(res.settings.shop.name || '');
        setOwnerName(res.settings.shop.ownerName || '');
        setPhone(res.settings.shop.phone || '');
        setAddress(res.settings.shop.address || '');
        setGstin(res.settings.shop.gstin || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await api.settings.updateShop({
        name: name.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        gstin: gstin.trim() || undefined
      });
      setSavedSuccess(true);
      if (onShopUpdated) onShopUpdated(res.shop.name);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update shop details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⏳</div>
        <h2>Loading settings...</h2>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)' }}>
          ⚙ Settings & Shop Profile
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Configure shop information, check AI status, and download data backups
        </p>
      </div>

      {/* AI Configuration Status Card */}
      <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--accent)' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">🤖 AI Assistant & Gemma 4 Configuration</h3>
            <p className="card-subtitle">Google Gen AI Cloud service integration</p>
          </div>
          <span className={settings?.ai?.isConfigured ? 'badge badge-success' : 'badge badge-warning'}>
            {settings?.ai?.status}
          </span>
        </div>

        <div style={{ fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>Model Name: <code style={{ backgroundColor: 'var(--bg-muted)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{settings?.ai?.model}</code></div>
          <div>Provider: <strong>{settings?.ai?.provider}</strong></div>
          <div>Mock Mode: <strong>{settings?.ai?.mockAi ? 'Active (Test Mode)' : 'Disabled (Production Mode)'}</strong></div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            💡 To switch models (e.g. to <code>gemma-4-31b-it</code>), configure the <code>GEMMA_MODEL</code> environment variable on your server without code changes.
          </p>
        </div>
      </div>

      {/* Shop Details Form */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">🏪 Shop Details</h3>
        </div>

        {savedSuccess && (
          <div className="alert alert-success">
            ✓ Shop details updated successfully!
          </div>
        )}

        <form onSubmit={handleSaveShop}>
          <div className="form-group">
            <label className="form-label">Shop Name *</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Owner Name</label>
              <input
                type="text"
                className="form-input"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input
                type="text"
                className="form-input"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Market Address</label>
              <input
                type="text"
                className="form-input"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">GSTIN / Tax ID (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 07AAAAA0000A1Z5"
                value={gstin}
                onChange={e => setGstin(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save Shop Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Data Export & Backup Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">💾 Data Export & Backups</h3>
            <p className="card-subtitle">Download your store data in standard CSV format or raw database</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <strong>Products Catalog (CSV)</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>All items, prices, SKUs, and stock levels</div>
            </div>
            <a href="/api/export/products.csv" className="btn btn-outline btn-sm" download>
              ⬇ Download CSV
            </a>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <strong>Inventory Ledger (CSV)</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Complete atomic transaction history</div>
            </div>
            <a href="/api/export/inventory.csv" className="btn btn-outline btn-sm" download>
              ⬇ Download CSV
            </a>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <strong>Invoices History (CSV)</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Scanned supplier receipts and totals</div>
            </div>
            <a href="/api/export/invoices.csv" className="btn btn-outline btn-sm" download>
              ⬇ Download CSV
            </a>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <strong>Suppliers Directory (CSV)</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Supplier contacts and total purchases</div>
            </div>
            <a href="/api/export/suppliers.csv" className="btn btn-outline btn-sm" download>
              ⬇ Download CSV
            </a>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <strong>Full SQLite Database (.db)</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Durable SQLite file backup from DATA_DIR</div>
            </div>
            <a href="/api/export/backup.db" className="btn btn-secondary btn-sm" download>
              💾 Download DB Backup
            </a>
          </div>
        </div>
      </div>

      {/* System Information & Logout */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            DukaanLens Single-Shop Edition • Version {settings?.version || '1.0.0'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Environment: {settings?.nodeEnv || 'production'} • Storage: {settings?.dataDir}
          </div>
        </div>

        <button className="btn btn-danger btn-sm" onClick={onLogout}>
          Logout of DukaanLens
        </button>
      </div>
    </div>
  );
};
