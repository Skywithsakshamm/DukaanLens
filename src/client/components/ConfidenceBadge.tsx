import React from 'react';
import { MatchStatus } from '../../shared/types';

interface Props {
  status: MatchStatus;
  confidence?: number;
  reason?: string;
}

export const ConfidenceBadge: React.FC<Props> = ({ status, confidence, reason }) => {
  let badgeClass = 'badge badge-neutral';
  let label = 'Unmatched';

  switch (status) {
    case 'exact':
      badgeClass = 'badge badge-success';
      label = '✓ Exact Match';
      break;
    case 'high_confidence':
      badgeClass = 'badge badge-primary';
      label = confidence ? `★ High Match (${Math.round(confidence * 100)}%)` : '★ High Confidence';
      break;
    case 'needs_review':
      badgeClass = 'badge badge-warning';
      label = '⚠ Needs Review';
      break;
    case 'unmatched':
    default:
      badgeClass = 'badge badge-danger';
      label = '✕ Unmatched';
      break;
  }

  return (
    <span className={badgeClass} title={reason || label}>
      {label}
    </span>
  );
};
