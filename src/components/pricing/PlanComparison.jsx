import React from 'react';
import { Check, Minus } from 'lucide-react';
import { COMPARISON } from '@/lib/plans';

const COLS = [
  { id: 'free', label: 'Free' },
  { id: 'solo', label: 'Solo' },
  { id: 'pro', label: 'Dispatcher Pro' },
  { id: 'team', label: 'Team' },
];

export default function PlanComparison() {
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-muted text-muted-foreground text-xs uppercase">
          <tr>
            <th className="text-left p-3">Feature</th>
            {COLS.map((c) => (
              <th key={c.id} className="text-center p-3">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <td className="p-3">{row.label}</td>
              {COLS.map((c) => {
                const v = row.values[c.id];
                return (
                  <td key={c.id} className="p-3 text-center">
                    {v === true ? (
                      <Check className="w-4 h-4 inline text-primary" />
                    ) : v === false || v == null ? (
                      <Minus className="w-4 h-4 inline text-muted-foreground/50" />
                    ) : (
                      <span className="text-xs">{v}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}