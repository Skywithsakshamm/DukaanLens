import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/api-client';

export const ScanInvoicePage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);

      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setLoadingStep('Uploading image to server...');

    try {
      setTimeout(() => setLoadingStep('Analyzing invoice with Cloud Gemma 4...'), 800);
      setTimeout(() => setLoadingStep('Matching line items to shop catalog...'), 2400);

      const res = await api.invoices.extract(selectedFile);
      navigate(`/invoices/${res.invoice.id}`);
    } catch (err: any) {
      setError(err.message || 'Invoice extraction failed. Please try with a clearer photo.');
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '640px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--secondary)' }}>
          📷 Scan Supplier Invoice
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '4px' }}>
          Take a photo or upload an invoice to extract products and stock automatically.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          <span>✕</span> {error}
        </div>
      )}

      {/* Hidden inputs for camera & gallery */}
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
        {!previewUrl ? (
          <div>
            <div
              style={{
                border: '2px dashed var(--border-light)',
                borderRadius: 'var(--radius-lg)',
                padding: '48px 20px',
                backgroundColor: 'var(--bg-muted)',
                marginBottom: '24px',
                cursor: 'pointer'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: '3.5rem', marginBottom: '12px' }}>🧾</div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '6px' }}>
                Select Invoice Photo
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Supports JPG, PNG, WEBP & PDF invoices
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ flex: 1, minWidth: '160px' }}
                onClick={() => cameraInputRef.current?.click()}
              >
                📸 Open Camera
              </button>
              <button
                type="button"
                className="btn btn-outline btn-lg"
                style={{ flex: 1, minWidth: '160px' }}
                onClick={() => fileInputRef.current?.click()}
              >
                📁 Choose File
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              maxHeight: '400px',
              backgroundColor: '#000',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={previewUrl}
                alt="Invoice Preview"
                style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                style={{ flex: 2, minWidth: '180px' }}
                onClick={handleProcess}
                disabled={loading}
              >
                {loading ? 'Processing...' : '⚡ Extract with AI'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                disabled={loading}
              >
                Retake
              </button>
            </div>

            {loading && (
              <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px', animation: 'pulse 1s infinite' }}>🤖</div>
                <div style={{ fontWeight: 700, color: 'var(--secondary)', fontSize: '0.95rem' }}>
                  {loadingStep}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Gemma 4 is extracting supplier, items, prices, and taxes...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Photography Tips */}
        <div style={{
          marginTop: '28px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'left',
          fontSize: '0.85rem',
          color: 'var(--text-muted)'
        }}>
          <strong style={{ color: 'var(--secondary)', display: 'block', marginBottom: '6px' }}>
            💡 Tips for Best Extraction:
          </strong>
          <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
            <li>Ensure good lighting and avoid shadows on the paper.</li>
            <li>Capture the full invoice including header, supplier name, and totals.</li>
            <li>Keep the camera parallel to the invoice to prevent distorted text.</li>
          </ul>
        </div>

        {/* AI Transparency & Privacy Notice */}
        <div style={{
          marginTop: '16px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--primary-light)',
          padding: '10px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--primary-border)'
        }}>
          🔒 <strong>Privacy & AI Transparency:</strong> The invoice image is processed securely by Google Cloud Gemma 4. AI results are presented for your review and <strong>never mutate inventory without your explicit confirmation</strong>.
        </div>
      </div>
    </div>
  );
};
