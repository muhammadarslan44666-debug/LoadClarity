import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import { useCarrier } from '@/components/layout/CarrierContext';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/layout/StatusBadge';
import EmptyState from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { currency, STATUS_LABELS, todayISO } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import { Package, Plus, AlertTriangle, X } from 'lucide-react';

const ACTIVE = ['ready', 'booked', 'driver_assigned', 'at_pickup', 'loading', 'in_transit', 'at_delivery'];

export default function Loads() {
  const { companyId } = useWorkspace();
  const { carrierId } = useCarrier();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [loads, setLoads] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('-created_date');
  const [qInput, setQInput] = useState(params.get('q') || '');

  const status = params.get('status') || 'all';
  const pickup = params.get('pickup') || '';
  const delivery = params.get('delivery') || '';
  const q = params.get('q') || '';

  const setParam = (key, value) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all') next.delete(key); else next.set(key, value);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (qInput) next.set('q', qInput); else next.delete('q');
        return next;
      }, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      api.entities.Load.filter({ company_id: companyId }, sort, 200),
      api.entities.LoadException.filter({ company_id: companyId }, '-created_date', 200),
    ]).then(([l, e]) => { setLoads(l || []); setExceptions((e || []).filter((x) => x.status !== 'resolved')); })
      .finally(() => setLoading(false));
  }, [companyId, sort]);

  const excIds = useMemo(() => new Set(exceptions.map((e) => e.load_id)), [exceptions]);

  const openLoad = (loadId) => {
    if (!loadId) { toast({ title: 'Load not found', variant: 'destructive' }); return; }
    navigate(`/loads/${loadId}`);
  };

  const filtered = useMemo(() => {
    let r = carrierId === 'all' ? loads : loads.filter((l) => l.carrier_id === carrierId);
    if (status === 'active') r = r.filter((l) => ACTIVE.includes(l.status));
    else if (status !== 'all') r = r.filter((l) => l.status === status);
    if (pickup === 'today') r = r.filter((l) => l.pickup_date === todayISO());
    if (delivery === 'today') r = r.filter((l) => l.delivery_date === todayISO());
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((l) => [l.load_number, l.broker_name, l.broker_reference, l.pickup_city, l.delivery_city].some((v) => (v || '').toLowerCase().includes(s)));
    }
    return r;
  }, [loads, carrierId, status, pickup, delivery, q]);

  return (
    <div>
      <PageHeader title="Loads" subtitle="All loads across your workspace." actions={
        <Link to="/loads/new"><Button><Plus className="w-4 h-4 mr-1" /> New load</Button></Link>
      } />
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search load #, broker, reference, city…" className="sm:max-w-xs h-9" />
        <Select value={status} onValueChange={(v) => setParam('status', v)}>
          <SelectTrigger className="h-9 sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active loads</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="h-9 sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="-created_date">Newest</SelectItem>
            <SelectItem value="-rate">Highest rate</SelectItem>
            <SelectItem value="pickup_date">Pickup date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(pickup === 'today' || delivery === 'today') && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {pickup === 'today' && (
            <button type="button" onClick={() => setParam('pickup', '')} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent">
              Pickup today <X className="w-3 h-3" />
            </button>
          )}
          {delivery === 'today' && (
            <button type="button" onClick={() => setParam('delivery', '')} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:bg-accent">
              Delivery today <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {loading ? <p className="text-muted-foreground">Loading…</p> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No loads found" message="Adjust filters or create a new load."
          action={<Link to="/loads/new"><Button><Plus className="w-4 h-4 mr-1" /> New load</Button></Link>} />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="text-left p-3">Load</th>
                <th className="text-left p-3 hidden md:table-cell">Route</th>
                <th className="text-left p-3 hidden sm:table-cell">Pickup</th>
                <th className="text-right p-3">Rate</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => openLoad(l.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLoad(l.id); } }}
                  className="border-t border-border hover:bg-accent cursor-pointer focus-visible:outline-none focus-visible:bg-accent"
                >
                  <td className="p-3">
                    <Link to={`/loads/${l.id}`} className="font-medium hover:underline">{l.load_number || 'Untitled'}</Link>
                    <p className="text-xs text-muted-foreground">{l.broker_name || '—'}</p>
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{l.pickup_city}, {l.pickup_state} → {l.delivery_city}, {l.delivery_state}</td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground">{l.pickup_date || '—'}</td>
                  <td className="p-3 text-right tabular-nums">{currency(l.rate)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {excIds.has(l.id) && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      <StatusBadge status={l.status} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}