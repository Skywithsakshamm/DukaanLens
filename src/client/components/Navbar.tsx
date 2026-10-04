import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from '../../shared/types';

interface Props {
  user: User | null;
  onLogout: () => void;
  shopName?: string;
  aiStatus?: string;
}

export const Navbar: React.FC<Props> = ({ user, onLogout, shopName = 'Gupta Electronics', aiStatus }) => {
  const location = useLocation();

  if (!user) {
    return (
      <header className="app-header">
        <div className="brand-logo">
          <span style={{ fontSize: '1.4rem' }}>🔍</span> DukaanLens
          <span className="brand-badge">AI Assistant</span>
        </div>
      </header>
    );
  }

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <Link to="/dashboard" className="brand-logo">
          <span style={{ fontSize: '1.4rem' }}>🔍</span> DukaanLens
        </Link>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }} className="desktop-only">
          🏪 {shopName}
        </span>
      </div>

      <nav className="desktop-nav">
        <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' || location.pathname === '/' ? 'active' : ''}`}>
          📊 Dashboard
        </Link>
        <Link to="/scan" className={`nav-link ${isActive('/scan') ? 'active' : ''}`}>
          📷 Scan Invoice
        </Link>
        <Link to="/inventory" className={`nav-link ${isActive('/inventory') ? 'active' : ''}`}>
          📦 Inventory
        </Link>
        <Link to="/products" className={`nav-link ${isActive('/products') ? 'active' : ''}`}>
          🏷 Products
        </Link>
        <Link to="/suppliers" className={`nav-link ${isActive('/suppliers') ? 'active' : ''}`}>
          🚚 Suppliers
        </Link>
        <Link to="/assistant" className={`nav-link ${isActive('/assistant') ? 'active' : ''}`}>
          💬 Assistant
        </Link>
        <Link to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`}>
          ⚙ Settings
        </Link>
      </nav>

      <div className="header-actions">
        <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Cloud Gemma 4 AI Active">
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
          Gemma 4
        </span>
        <button
          className="btn btn-outline btn-sm"
          onClick={onLogout}
          title="Logout"
          style={{ minHeight: '34px', padding: '4px 10px' }}
        >
          Logout
        </button>
      </div>
    </header>
  );
};
