import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './api/api-client';
import { User, Shop } from '../shared/types';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScanInvoicePage } from './pages/ScanInvoicePage';
import { InvoiceReviewPage } from './pages/InvoiceReviewPage';
import { InventoryPage } from './pages/InventoryPage';
import { ProductsPage } from './pages/ProductsPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { AssistantPage } from './pages/AssistantPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [shopName, setShopName] = useState<string>('Gupta Electronics & Kirana');
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      setLoading(true);
      const res = await api.auth.me();
      setUser(res.user);

      // Load shop name
      try {
        const settingsRes = await api.settings.get();
        if (settingsRes.settings?.shop?.name) {
          setShopName(settingsRes.settings.shop.name);
        }
      } catch {
        // ignore
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-main)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🔍</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--secondary)' }}>
            DukaanLens
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
            Checking shopkeeper session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {!user ? (
        <LoginPage onLoginSuccess={(u) => { setUser(u); checkAuth(); }} />
      ) : (
        <>
          <Navbar user={user} onLogout={handleLogout} shopName={shopName} />
          <main>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/scan" element={<ScanInvoicePage />} />
              <Route path="/invoices/:id" element={<InvoiceReviewPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route
                path="/settings"
                element={
                  <SettingsPage
                    onShopUpdated={(newName) => setShopName(newName)}
                    onLogout={handleLogout}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <BottomNav />
        </>
      )}
    </BrowserRouter>
  );
};
