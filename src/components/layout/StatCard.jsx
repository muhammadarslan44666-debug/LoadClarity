import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE_STYLES = {
  active: 'border-blue-200 bg-blue-50/80 [&_.stat-label]:text-blue-800 [&_.stat-value]:text-blue-950 [&_.stat-icon]:text-blue-700',
  danger: 'border-red-200 bg-red-50/80 [&_.stat-label]:text-red-800 [&_.stat-value]:text-red-950 [&_.stat-icon]:text-red-700',
  warning: 'border-amber-200 bg-amber-50/90 [&_.stat-label]:text-amber-800 [&_.stat-value]:text-amber-950 [&_.stat-icon]:text-amber-700',
  success: 'border-emerald-200 bg-emerald-50/80 [&_.stat-label]:text-emerald-800 [&_.stat-value]:text-emerald-950 [&_.stat-icon]:text-emerald-700',
  neutral: 'border-slate-200 bg-white',
};

export default function StatCard({ label, value, sub, to, tone = 'neutral', icon: Icon }) {
  const inner = (
    <Card className={cn('rounded-xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md', TONE_STYLES[tone] || TONE_STYLES.neutral, to && 'cursor-pointer')}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="stat-label text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="stat-value mt-1.5 font-heading text-3xl font-bold leading-none tabular-nums text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && <Icon className="stat-icon h-5 w-5 shrink-0 text-muted-foreground" />}
      </div>
    </Card>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}