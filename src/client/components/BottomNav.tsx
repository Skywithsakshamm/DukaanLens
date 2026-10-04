import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <nav className="bottom-nav">
      <Link to="/dashboard" className={`bottom-nav-item ${isActive('/dashboard') || location.pathname === '/' ? 'active' : ''}`}>
        <span style={{ fontSize: '1.2rem' }}>📊</span>
        <span>Home</span>
      </Link>

      <Link to="/inventory" className={`bottom-nav-item ${isActive('/inventory') ? 'active' : ''}`}>
        <span style={{ fontSize: '1.2rem' }}>📦</span>
        <span>Stock</span>
      </Link>

      {/* Floating Center Scan Button */}
      <Link to="/scan" className="bottom-nav-item scan-action" aria-label="Scan Invoice">
        <div className="scan-floating-btn">
          <span style={{ fontSize: '1.5rem' }}>📷</span>
        </div>
        <span style={{ marginTop: '2px', fontWeight: 700, color: 'var(--primary)' }}>Scan</span>
      </Link>

      <Link to="/assistant" className={`bottom-nav-item ${isActive('/assistant') ? 'active' : ''}`}>
        <span style={{ fontSize: '1.2rem' }}>💬</span>
        <span>Assistant</span>
      </Link>

      <Link to="/products" className={`bottom-nav-item ${isActive('/products') || isActive('/settings') ? 'active' : ''}`}>
        <span style={{ fontSize: '1.2rem' }}>⚙</span>
        <span>More</span>
      </Link>
    </nav>
  );
};
