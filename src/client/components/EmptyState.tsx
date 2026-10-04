import React from 'react';

interface Props {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<Props> = ({
  icon = '📦',
  title,
  description,
  actionText,
  onAction
}) => {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{icon}</div>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '6px' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto 20px', fontSize: '0.95rem' }}>
        {description}
      </p>
      {actionText && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};
