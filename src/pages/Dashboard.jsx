import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import { useCarrier } from '@/components/layout/CarrierContext';
import PageHeader from '@/components/layout/PageHeader';
import StatCard from '@/components/layout/StatCard';
import StatusBadge from '@/components/layout/StatusBadge';
import ToneBadge from '@/components/layout/ToneBadge';
import EmptyState from '@/components/layout/EmptyState';
import { currency, todayISO } from '@/lib/format';
import { paymentStatus } from '@/lib/payments';
import { Package, AlertTriangle, Truck, Clock, DollarSign, CheckCircle2, Zap } from 'lucide-react';

const ACTIVE = ['ready', 'booked', 'driver_assigned', 'at_pickup', 'loading', 'in_transit', 'at_delivery'];

export default function Dashboard() {
  const { companyId, settings, loading: wsLoading } = useWorkspace();
  const { carrierId } = useCarrier();
  const [loads, setLoads] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      api.entities.Load.filter({ company_id: companyId }, '-created_date', 200),
      api.entities.LoadException.filter({ company_id: companyId }, '-created_date', 200),
      api.entities.Payment.filter({ company_id: companyId }, '-created_date', 300),
    ]).then(([l, e, p]) => { setLoads(l || []); setExceptions(e || []); setPayments(p || []); })
      .finally(() => setLoading(false));
  }, [companyId]);

  const filtered = useMemo(() => (carrierId === 'all' ? loads : loads.filter((l) => l.carrier_id === carrierId)), [loads, carrierId]);
  const openExceptions = useMemo(() => exceptions.filter((e) => e.status === 'open' || e.status === 'acknowledged' || e.status === 'reopened'), [exceptions]);
  const excByLoad = useMemo(() => {
    const m = new Map();
    for (const e of openExceptions) { if (!m.has(e.load_id)) m.set(e.load_id, []); m.get(e.load_id).push(e); }
    return m;
  }, [openExceptions]);

  // "At risk" counts loads (not individual issues) that have an open Critical or High exception.
  const atRisk = useMemo(() => {
    const ids = new Set(filtered.filter((l) => l.status !== 'cancelled' && !l.archived).map((l) => l.id));
    const risky = new Set();
    for (const e of openExceptions) {
      if ((e.severity === 'Critical' || e.severity === 'High') && ids.has(e.load_id)) risky.add(e.load_id);
    }
    return risky.size;
  }, [openExceptions, filtered]);

  const today = todayISO();
  const stat = (pred) => filtered.filter(pred).length;
  const payStatus = (p) => paymentStatus(p, settings.expected_payment_days || 30);
  const unpaidCount = payments.filter((p) => ['invoiced', 'overdue'].includes(payStatus(p))).length;
  const overdueCount = payments.filter((p) => payStatus(p) === 'overdue').length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthLoads = filtered.filter((l) => !['cancelled'].includes(l.status) && new Date(l.pickup_date || l.created_date || 0) >= monthStart);
  const monthlyGross = monthLoads.reduce((sum, l) => sum + Number(l.rate || 0), 0);
  const driverPay = monthLoads.reduce((sum, l) => sum + (settings.driver_pay_mode === 'percent' ? Number(l.rate || 0) * Number(settings.driver_pay_percent || 0) / 100 : Number(l.loaded_miles || 0) * Number(settings.driver_pay_per_mile || 0.65)), 0);
  const operatingCosts = monthLoads.reduce((sum, l) => { const miles = Number(l.loaded_miles || 0) + Number(l.deadhead_miles || 0); return sum + (miles * Number(settings.fuel_price || 3.85) / Math.max(1, Number(settings.mpg || 7.5))) + (miles * Number(settings.maintenance_per_mile || 0.15)) + Number(l.lumper_amount || 0); }, 0);
  const monthlyNet = monthlyGross - driverPay - operatingCosts;
  const totalMiles = monthLoads.reduce((sum, l) => sum + Number(l.loaded_miles || 0), 0);
  const ratePerMile = totalMiles > 0 ? monthlyGross / totalMiles : 0;

  if (wsLoading || loading) return <div className="py-20 text-center text-muted-foreground">Loading dashboard…</div>;

  const recent = [...filtered].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 6);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="What needs attention, and what happens next." actions={
        <>
          <Link to="/quick-check" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent">
            <Zap className="h-4 w-4" /> Quick check
          </Link>
          <Link to="/loads/new" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            + New Load
          </Link>
        </>
      } />

      {filtered.length === 0 ? (
        <EmptyState icon={Package} title="No loads yet" message="Create your first load or run a Quick check to analyze an offer before answering the broker."
          action={<Link to="/loads/new" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">+ New load</Link>} />
      ) : (
        <>
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-heading text-lg">Monthly performance</h2><p className="text-xs text-muted-foreground">Based on loads with pickup dates this month; estimates use workspace cost settings.</p></div><span className="text-xs text-muted-foreground">{monthLoads.length} loads</span></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly gross</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{currency(monthlyGross)}</p><p className="mt-1 text-xs text-slate-500">Total booked revenue</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated net</p><p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${monthlyNet < 0 ? 'text-red-700' : 'text-slate-950'}`}>{currency(monthlyNet)}</p><p className="mt-1 text-xs text-slate-500">After estimated operating costs</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gross / loaded mile</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{ratePerMile.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p><p className="mt-1 text-xs text-slate-500">Revenue per loaded mile</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated driver pay</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{currency(driverPay)}</p><p className="mt-1 text-xs text-slate-500">Based on workspace pay settings</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Active loads" value={stat((l) => ACTIVE.includes(l.status))} to="/loads?status=active" icon={Package} tone="active" />
            <StatCard label="Pending review" value={stat((l) => l.status === 'pending_review')} to="/loads?status=pending_review" icon={Clock} tone="warning" />
            <StatCard label="At risk" value={atRisk} to="/exceptions" icon={AlertTriangle} tone="danger" />
            <StatCard label="In transit" value={stat((l) => l.status === 'in_transit')} to="/loads?status=in_transit" icon={Truck} />
            <StatCard label="Pickup today" value={stat((l) => l.pickup_date === today)} to="/loads?pickup=today" icon={Clock} />
            <StatCard label="Delivery today" value={stat((l) => l.delivery_date === today)} to="/loads?delivery=today" icon={Truck} />
            <StatCard label="Billing ready" value={stat((l) => l.status === 'billing_ready')} to="/loads?status=billing_ready" icon={CheckCircle2} tone="success" />
            <StatCard label="Unpaid invoices" value={unpaidCount} to="/payments" icon={DollarSign} />
            <StatCard label="Overdue payments" value={overdueCount} to="/payments" tone="danger" icon={AlertTriangle} />
            <StatCard label="Completed" value={stat((l) => l.status === 'completed')} to="/loads?status=completed" icon={CheckCircle2} tone="success" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-6">
            <div>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-heading text-xl font-semibold text-slate-900">Action required</h2>{openExceptions.length > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{openExceptions.length} open</span>}</div>
              {openExceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open issues. You're clear.</p>
              ) : (
                <div className="space-y-2">
                  {openExceptions.slice(0, 8).map((e) => (
                    <Link key={e.id} to={`/loads/${e.load_id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 hover:bg-accent">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground">Load {e.load_number || '—'}</p>
                      </div>
                      <ToneBadge className="shrink-0 px-2.5 py-1 font-semibold" tone={e.severity === 'Critical' ? 'danger' : e.severity === 'High' ? 'warning' : 'info'}>{e.severity === 'Critical' ? 'Critical' : e.severity === 'High' ? 'High' : 'Info'}</ToneBadge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h2 className="font-heading text-xl mb-3">Recent loads</h2>
              <div className="space-y-2">
                {recent.map((l) => (
                  <Link key={l.id} to={`/loads/${l.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 hover:bg-accent">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{l.load_number || 'Untitled'} · {l.broker_name || l.pickup_city || '—'}</p>
                      <p className="text-xs text-muted-foreground">{l.pickup_city}, {l.pickup_state} → {l.delivery_city}, {l.delivery_state} · {currency(l.rate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {excByLoad.has(l.id) && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      <StatusBadge status={l.status} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}