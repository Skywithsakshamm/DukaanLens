import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/api-client';
import { DashboardMetrics, ReorderItem } from '../../shared/types';
import { formatINR, formatDate, formatQuantity } from '../../shared/formatters';

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.dashboard.getMetrics();
      setMetrics(res.metrics);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--secondary)' }}>
          Loading shop dashboard...
        </h2>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="app-container">
        <div className="alert alert-danger">
          <span>✕</span> {error || 'Failed to load store metrics.'}
        </div>
        <button className="btn btn-outline" onClick={loadDashboard}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Welcome Banner & Primary CTA */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px',
        padding: '20px',
        background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
        borderRadius: 'var(--radius-lg)',
        color: '#ffffff',
        boxShadow: '0 8px 20px rgba(234, 88, 12, 0.25)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Shop Overview</h1>
          <p style={{ opacity: 0.9, fontSize: '0.95rem', marginTop: '4px' }}>
            AI-powered inventory status & reorder alerts
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link to="/scan" className="btn btn-secondary btn-lg" style={{ backgroundColor: '#ffffff', color: 'var(--primary)' }}>
            📷 Scan Invoice
          </Link>
          <Link to="/assistant" className="btn btn-outline" style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#ffffff' }}>
            💬 Ask Assistant
          </Link>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-label">Total Products</span>
          <span className="stat-value">{metrics.totalProducts}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Active in catalog</span>
        </div>

        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <span className="stat-label">Low Stock Alerts</span>
          <span className="stat-value danger">{metrics.lowStockCount}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600 }}>Needs Reorder</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Today's Stock In</span>
          <span className="stat-value success">+{metrics.todayStockIn}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Units added today</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Inventory Value</span>
          <span className="stat-value primary">{formatINR(metrics.totalInventoryValuePaise)}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>At purchase cost</span>
        </div>
      </div>

      {/* Prominent Low Stock Alert Section */}
      {metrics.topLowStock && metrics.topLowStock.length > 0 && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--warning)' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--warning)', fontSize: '1.2rem' }}>⚠️</span>
                LOW STOCK REORDER ALERTS ({metrics.topLowStock.length})
              </h2>
              <p className="card-subtitle">Items at or below minimum threshold</p>
            </div>
            <Link to="/inventory?tab=low" className="btn btn-outline btn-sm">
              View All Low Stock
            </Link>
          </div>

          <div className="grid-3">
            {metrics.topLowStock.map((item: ReorderItem) => (
              <div
                key={item.productId}
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: item.status === 'critical' ? 'var(--danger-light)' : 'var(--warning-light)',
                  border: `1px solid ${item.status === 'critical' ? 'var(--danger-border)' : 'var(--warning-border)'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--secondary)' }}>
                    {item.productName}
                  </span>
                  <span className={item.status === 'critical' ? 'badge badge-danger' : 'badge badge-warning'}>
                    {item.status === 'critical' ? 'Critical' : 'Low Stock'}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div>Current Stock: <strong style={{ color: 'var(--danger)', fontSize: '0.95rem' }}>{item.currentStock}</strong> (Min: {item.minimumStock})</div>
                  <div>Recommended Order: <strong style={{ color: 'var(--primary)' }}>+{item.recommendedOrder} pcs</strong></div>
                  {item.supplierName && <div>Supplier: <strong>{item.supplierName}</strong></div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Last Cost: {formatINR(item.lastPurchasePricePaise)}
                  </span>
                  <Link
                    to={`/assistant?q=Reorder ${encodeURIComponent(item.productName)}`}
                    className="btn btn-sm btn-outline"
                    style={{ backgroundColor: '#fff', fontSize: '0.78rem', minHeight: '28px', padding: '2px 8px' }}
                  >
                    💬 Ask Reorder
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column layout: Recent Invoices & Recent Transactions */}
      <div className="grid-2">
        {/* Recent Invoices Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Recent Invoices</h2>
              <p className="card-subtitle">AI scanned supplier receipts</p>
            </div>
            <Link to="/scan" className="btn btn-primary btn-sm">
              + Scan New
            </Link>
          </div>

          {metrics.recentInvoices.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              No invoices scanned yet. Tap "Scan New" to add your first supplier invoice!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.recentInvoices.map(inv => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-muted)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {inv.supplierName || 'Unknown Supplier'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      #{inv.invoiceNumber || inv.id.slice(0, 8)} • {formatDate(inv.invoiceDate || inv.createdAt)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                      {formatINR(inv.totalPaise)}
                    </div>
                    <span className={inv.status === 'CONFIRMED' ? 'badge badge-success' : 'badge badge-warning'} style={{ fontSize: '0.65rem' }}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Transactions Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Stock Ledger Activity</h2>
              <p className="card-subtitle">Recent stock in & out events</p>
            </div>
            <Link to="/inventory" className="btn btn-outline btn-sm">
              View All
            </Link>
          </div>

          {metrics.recentTransactions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              No inventory transactions recorded yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.recentTransactions.map(tx => (
                <div
                  key={tx.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {tx.productName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {tx.type} • {formatDate(tx.createdAt, true)}
                    </div>
                  </div>

                  <div style={{
                    fontWeight: 800,
                    fontSize: '1rem',
                    fontFamily: 'var(--font-mono)',
                    color: tx.quantity > 0 ? 'var(--success)' : 'var(--danger)'
                  }}>
                    {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
