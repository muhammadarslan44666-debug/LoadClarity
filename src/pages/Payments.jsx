import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import { useCarrier } from '@/components/layout/CarrierContext';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/layout/StatCard';
import ToneBadge from '@/components/layout/ToneBadge';
import EmptyState from '@/components/layout/EmptyState';
import { currency, dateStr } from '@/lib/format';
import { paymentStatus, PAYMENT_TONE } from '@/lib/payments';
import { DollarSign } from 'lucide-react';

export default function Payments() {
  const { companyId, settings } = useWorkspace();
  const { carrierId } = useCarrier();
  const [payments, setPayments] = useState([]);
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      api.entities.Payment.filter({ company_id: companyId }, '-created_date', 300),
      api.entities.Load.filter({ company_id: companyId }, '-created_date', 200),
    ]).then(([p, l]) => { setPayments(p || []); setLoads(l || []); }).finally(() => setLoading(false));
  }, [companyId]);

  const loadMap = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const filtered = useMemo(() => (carrierId === 'all' ? payments : payments.filter((p) => loadMap.get(p.load_id)?.carrier_id === carrierId)), [payments, carrierId, loadMap]);

  const statusOf = (p) => paymentStatus(p, settings.expected_payment_days || 30);

  const summary = useMemo(() => {
    let outstanding = 0, overdue = 0, shortPaid = 0, overdueCount = 0;
    const paidDays = [];
    for (const p of filtered) {
      const st = statusOf(p);
      if (st === 'invoiced' || st === 'overdue') outstanding += Number(p.invoice_amount) || 0;
      if (st === 'overdue') { overdue += Number(p.invoice_amount) || 0; overdueCount++; }
      if (st === 'short_paid') shortPaid += Math.max(0, (Number(p.invoice_amount) || 0) - (Number(p.amount_received) || 0));
      if (st === 'paid' && p.invoice_date && p.paid_date) paidDays.push(Math.floor((new Date(p.paid_date) - new Date(p.invoice_date)) / 86400000));
    }
    const avgDays = paidDays.length ? paidDays.reduce((a, b) => a + b, 0) / paidDays.length : 0;
    return { outstanding, overdue, shortPaid, overdueCount, avgDays };
  }, [filtered, settings.expected_payment_days]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div>
      <PageHeader title="Payments" subtitle="Invoice status and broker payment history from your own records." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="Outstanding" value={currency(summary.outstanding)} icon={DollarSign} />
        <StatCard label="Overdue" value={currency(summary.overdue)} sub={`${summary.overdueCount} invoices`} tone="danger" />
        <StatCard label="Short-paid" value={currency(summary.shortPaid)} tone="warning" />
        <StatCard label="Avg days to pay" value={summary.avgDays.toFixed(0)} />
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={DollarSign} title="No payments tracked" message="Record invoice and payment details on each load." />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase"><tr>
              <th className="text-left p-3">Load</th><th className="text-left p-3 hidden sm:table-cell">Invoiced</th>
              <th className="text-right p-3">Amount</th><th className="text-right p-3 hidden sm:table-cell">Received</th><th className="text-left p-3">Status</th>
            </tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-accent">
                  <td className="p-3"><Link to={`/loads/${p.load_id}`} className="font-medium hover:underline">{p.load_number || 'Load'}</Link></td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground">{p.invoice_date ? dateStr(p.invoice_date) : '—'}</td>
                  <td className="p-3 text-right tabular-nums">{currency(p.invoice_amount)}</td>
                  <td className="p-3 text-right tabular-nums hidden sm:table-cell">{p.paid_date ? currency(p.amount_received) : '—'}</td>
                  <td className="p-3"><ToneBadge tone={PAYMENT_TONE[statusOf(p)]}>{statusOf(p).replace('_', ' ')}</ToneBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Broker payment history is based on your company's own records, not industry ratings.</p>
    </div>
  );
}