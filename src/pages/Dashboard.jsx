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

/**
 * API clients sometimes return a raw array, or wrap it in { data }, { items },
 * { results }, or { rows }. Never pass an arbitrary object into Array methods.
 */
function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];

  for (const key of ['data', 'items', 'results', 'rows']) {
    if (Array.isArray(value[key])) return value[key];
  }

  // Some clients wrap the collection one level deeper.
  if (value.data && typeof value.data === 'object') {
    for (const key of ['items', 'results', 'rows']) {
      if (Array.isArray(value.data[key])) return value.data[key];
    }
  }

  return [];
}

export default function Dashboard() {
  const { companyId, settings, loading: wsLoading } = useWorkspace();
  const { carrierId } = useCarrier();

  const [loads, setLoads] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (wsLoading) {
      setLoading(true);
      return () => { cancelled = true; };
    }

    if (!companyId) {
      setLoads([]);
      setExceptions([]);
      setPayments([]);
      setLoading(false);
      setLoadError('');
      return () => { cancelled = true; };
    }

    setLoading(true);
    setLoadError('');

    Promise.all([
      api.entities.Load.filter({ company_id: companyId }, '-created_date', 200),
      api.entities.LoadException.filter({ company_id: companyId }, '-created_date', 200),
      api.entities.Payment.filter({ company_id: companyId }, '-created_date', 300),
    ])
      .then(([loadResult, exceptionResult, paymentResult]) => {
        if (cancelled) return;
        setLoads(toArray(loadResult));
        setExceptions(toArray(exceptionResult));
        setPayments(toArray(paymentResult));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Dashboard data loading failed:', error);
        setLoads([]);
        setExceptions([]);
        setPayments([]);
        setLoadError('Dashboard data could not be loaded. Please refresh and try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [companyId, wsLoading]);

  // Keep all collections as arrays even if a future state update receives unexpected data.
  const safeLoads = Array.isArray(loads) ? loads : [];
  const safeExceptions = Array.isArray(exceptions) ? exceptions : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const filtered = useMemo(
    () => carrierId === 'all'
      ? safeLoads
      : safeLoads.filter((load) => load && load.carrier_id === carrierId),
    [safeLoads, carrierId]
  );

  const openExceptions = useMemo(
    () => safeExceptions.filter((exception) =>
      exception && ['open', 'acknowledged', 'reopened'].includes(exception.status)
    ),
    [safeExceptions]
  );

  const excByLoad = useMemo(() => {
    const map = new Map();
    for (const exception of openExceptions) {
      if (!exception.load_id) continue;
      if (!map.has(exception.load_id)) map.set(exception.load_id, []);
      map.get(exception.load_id).push(exception);
    }
    return map;
  }, [openExceptions]);

  // "At risk" counts loads (not individual issues) with an open Critical or High exception.
  const atRisk = useMemo(() => {
    const eligibleLoadIds = new Set(
      filtered
        .filter((load) => load && load.status !== 'cancelled' && !load.archived)
        .map((load) => load.id)
        .filter(Boolean)
    );
    const riskyLoadIds = new Set();

    for (const exception of openExceptions) {
      if (
        (exception.severity === 'Critical' || exception.severity === 'High') &&
        eligibleLoadIds.has(exception.load_id)
      ) {
        riskyLoadIds.add(exception.load_id);
      }
    }
    return riskyLoadIds.size;
  }, [openExceptions, filtered]);

  const today = todayISO();
  const stat = (predicate) => filtered.filter((load) => load && predicate(load)).length;
  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  const payStatus = (payment) => paymentStatus(payment, safeSettings.expected_payment_days || 30);
  const unpaidCount = safePayments.filter((payment) => ['invoiced', 'overdue'].includes(payStatus(payment))).length;
  const overdueCount = safePayments.filter((payment) => payStatus(payment) === 'overdue').length;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const monthLoads = filtered.filter((load) => {
    if (!load || load.status === 'cancelled') return false;
    const dateValue = load.pickup_date || load.created_date;
    if (!dateValue) return false;
    const date = new Date(dateValue);
    return !Number.isNaN(date.getTime()) && date >= monthStart;
  });

  const monthlyGross = monthLoads.reduce((sum, load) => sum + Number(load.rate || 0), 0);
  const driverPay = monthLoads.reduce((sum, load) => {
    const rate = Number(load.rate || 0);
    return sum + (
      safeSettings.driver_pay_mode === 'percent'
        ? rate * Number(safeSettings.driver_pay_percent || 0) / 100
        : Number(load.loaded_miles || 0) * Number(safeSettings.driver_pay_per_mile || 0.65)
    );
  }, 0);

  const operatingCosts = monthLoads.reduce((sum, load) => {
    const miles = Number(load.loaded_miles || 0) + Number(load.deadhead_miles || 0);
    const mpg = Math.max(1, Number(safeSettings.mpg || 7.5));
    return sum
      + (miles * Number(safeSettings.fuel_price || 3.85) / mpg)
      + (miles * Number(safeSettings.maintenance_per_mile || 0.15))
      + Number(load.lumper_amount || 0);
  }, 0);

  const monthlyNet = monthlyGross - driverPay - operatingCosts;
  const totalMiles = monthLoads.reduce((sum, load) => sum + Number(load.loaded_miles || 0), 0);
  const ratePerMile = totalMiles > 0 ? monthlyGross / totalMiles : 0;

  if (wsLoading || loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading dashboard…</div>;
  }

  const recent = [...filtered]
    .sort((a, b) => new Date(b?.created_date || 0) - new Date(a?.created_date || 0))
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="What needs attention, and what happens next."
        actions={
          <>
            <Link to="/quick-check" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-accent">
              <Zap className="h-4 w-4" /> Quick check
            </Link>
            <Link to="/loads/new" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              + New Load
            </Link>
          </>
        }
      />

      {loadError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No loads yet"
          message="Create your first load or run a Quick check to analyze an offer before answering the broker."
          action={<Link to="/loads/new" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">+ New load</Link>}
        />
      ) : (
        <>
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg">Monthly performance</h2>
                <p className="text-xs text-muted-foreground">Based on loads with pickup dates this month; estimates use workspace cost settings.</p>
              </div>
              <span className="text-xs text-muted-foreground">{monthLoads.length} loads</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly gross</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{currency(monthlyGross)}</p>
                <p className="mt-1 text-xs text-slate-500">Total booked revenue</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated net</p>
                <p className={`mt-2 text-2xl font-bold tracking-tight tabular-nums ${monthlyNet < 0 ? 'text-red-700' : 'text-slate-950'}`}>{currency(monthlyNet)}</p>
                <p className="mt-1 text-xs text-slate-500">After estimated operating costs</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Gross / loaded mile</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{ratePerMile.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                <p className="mt-1 text-xs text-slate-500">Revenue per loaded mile</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated driver pay</p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 tabular-nums">{currency(driverPay)}</p>
                <p className="mt-1 text-xs text-slate-500">Based on workspace pay settings</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Active loads" value={stat((load) => ACTIVE.includes(load.status))} to="/loads?status=active" icon={Package} tone="active" />
            <StatCard label="Pending review" value={stat((load) => load.status === 'pending_review')} to="/loads?status=pending_review" icon={Clock} tone="warning" />
            <StatCard label="At risk" value={atRisk} to="/exceptions" icon={AlertTriangle} tone="danger" />
            <StatCard label="In transit" value={stat((load) => load.status === 'in_transit')} to="/loads?status=in_transit" icon={Truck} />
            <StatCard label="Pickup today" value={stat((load) => load.pickup_date === today)} to="/loads?pickup=today" icon={Clock} />
            <StatCard label="Delivery today" value={stat((load) => load.delivery_date === today)} to="/loads?delivery=today" icon={Truck} />
            <StatCard label="Billing ready" value={stat((load) => load.status === 'billing_ready')} to="/loads?status=billing_ready" icon={CheckCircle2} tone="success" />
            <StatCard label="Unpaid invoices" value={unpaidCount} to="/payments" icon={DollarSign} />
            <StatCard label="Overdue payments" value={overdueCount} to="/payments" tone="danger" icon={AlertTriangle} />
            <StatCard label="Completed" value={stat((load) => load.status === 'completed')} to="/loads?status=completed" icon={CheckCircle2} tone="success" />
          </div>

          <div className="grid lg:grid-cols-2 gap-5 mt-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-xl font-semibold text-slate-900">Action required</h2>
                {openExceptions.length > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{openExceptions.length} open</span>}
              </div>
              {openExceptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open issues. You're clear.</p>
              ) : (
                <div className="space-y-2">
                  {openExceptions.slice(0, 8).map((exception) => (
                    <Link key={exception.id} to={`/loads/${exception.load_id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 hover:bg-accent">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{exception.title}</p>
                        <p className="text-xs text-muted-foreground">Load {exception.load_number || '—'}</p>
                      </div>
                      <ToneBadge className="shrink-0 px-2.5 py-1 font-semibold" tone={exception.severity === 'Critical' ? 'danger' : exception.severity === 'High' ? 'warning' : 'info'}>
                        {exception.severity === 'Critical' ? 'Critical' : exception.severity === 'High' ? 'High' : 'Info'}
                      </ToneBadge>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="font-heading text-xl mb-3">Recent loads</h2>
              <div className="space-y-2">
                {recent.map((load) => (
                  <Link key={load.id} to={`/loads/${load.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 hover:bg-accent">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{load.load_number || 'Untitled'} · {load.broker_name || load.pickup_city || '—'}</p>
                      <p className="text-xs text-muted-foreground">{load.pickup_city || '—'}, {load.pickup_state || '—'} → {load.delivery_city || '—'}, {load.delivery_state || '—'} · {currency(load.rate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {excByLoad.has(load.id) && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      <StatusBadge status={load.status} />
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
