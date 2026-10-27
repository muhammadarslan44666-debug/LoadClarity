import React from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
  warning: 'bg-warning/15 text-warning-foreground border-warning/30',
  success: 'bg-success/10 text-success border-success/20',
  info: 'bg-info/10 text-info border-info/20',
  neutral: 'bg-muted text-muted-foreground border-border',
};

export default function ToneBadge({ tone = 'neutral', children, className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', TONES[tone] || TONES.neutral, className)}>
      {children}
    </span>
  );
}