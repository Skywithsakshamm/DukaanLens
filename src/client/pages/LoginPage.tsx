import React, { useState } from 'react';
import { api } from '../api/api-client';
import { User } from '../../shared/types';

interface Props {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.auth.login(username, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setUsername('admin');
    setPassword('dukaan123');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'linear-gradient(135deg, #fff7ed 0%, #f8fafc 100%)'
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            marginBottom: '16px',
            boxShadow: '0 8px 20px rgba(234, 88, 12, 0.3)'
          }}>
            🔍
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--secondary)' }}>
            DukaanLens
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
            AI inventory assistant for Indian shops
          </p>
        </div>

        <div className="card" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '20px', color: 'var(--secondary)' }}>
            Shopkeeper Sign In
          </h2>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              <span>✕</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username or Email</label>
              <input
                id="username"
                type="text"
                className="form-input"
                placeholder="e.g. admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm btn-block"
              onClick={handleFillDemo}
              style={{ fontSize: '0.85rem' }}
            >
              ⚡ Quick Fill Demo Account (admin / dukaan123)
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Powered by Cloud Gemma 4 • Google Gemini API
        </div>
      </div>
    </div>
  );
};
