import React from 'react';
import ToneBadge from './ToneBadge';
import { STATUS_LABELS, STATUS_TONE } from '@/lib/format';

export default function StatusBadge({ status, className }) {
  return (
    <ToneBadge tone={STATUS_TONE[status] || 'neutral'} className={className}>
      {STATUS_LABELS[status] || status}
    </ToneBadge>
  );
}