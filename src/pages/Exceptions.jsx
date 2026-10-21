import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import { useCarrier } from '@/components/layout/CarrierContext';
import PageHeader from '@/components/layout/PageHeader';
import ToneBadge from '@/components/layout/ToneBadge';
import EmptyState from '@/components/layout/EmptyState';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { computeIssues } from '@/lib/risk';
import { computeEconomics, computeDeliveryTiming } from '@/lib/calculations';

export default function Exceptions() {
  const { companyId, settings, carriers } = useWorkspace();
  const { carrierId } = useCarrier();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sev, setSev] = useState('all');
  const [status, setStatus] = useState('open');

  const load = async () => {
    setLoading(true);
    const [e, l] = await Promise.all([
      api.entities.LoadException.filter({ company_id: companyId }, '-created_date', 300),
      api.entities.Load.filter({ company_id: companyId }, '-created_date', 200),
    ]);
    setItems(e || []); setLoads(l || []); setLoading(false);
  };
  useEffect(() => { if (companyId) load(); }, [companyId]);

  const loadMap = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const filtered = useMemo(() => {
    let r = items;
    if (carrierId !== 'all') r = r.filter((e) => loadMap.get(e.load_id)?.carrier_id === carrierId);
    if (sev !== 'all') r = r.filter((e) => e.severity === sev);
    if (status !== 'all') r = r.filter((e) => e.status === status);
    return r;
  }, [items, carrierId, sev, status, loadMap]);

  const acknowledge = async (e) => { await api.entities.LoadException.update(e.id, { status: 'acknowledged' }); load(); };

  const resolve = async (e) => {
    const load = loadMap.get(e.load_id);
    if (!load) return;
    const carrier = carriers.find((c) => c.id === load.carrier_id) || {};
    const calc = computeEconomics(load, settings, carrier);
    const timing = computeDeliveryTiming(load, settings);
    const current = computeIssues(load, calc, settings, timing);
    if (current.some((i) => i.key === e.key)) {
      toast({ title: 'Cannot resolve', description: 'The underlying problem still exists. Fix the data first.', variant: 'destructive' });
      return;
    }
    await api.entities.LoadException.update(e.id, { status: 'resolved' });
    load();
  };

  return (
    <div>
      <PageHeader title="Exceptions" subtitle="Every open issue across your loads. Exceptions auto-clear when the data is fixed." />
      <div className="flex gap-2 mb-4">
        <Select value={sev} onValueChange={setSev}><SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All severities</SelectItem>{['Critical', 'High', 'Review', 'Info'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{['open', 'acknowledged', 'resolved', 'reopened'].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      </div>
      {loading ? <p className="text-muted-foreground">Loading…</p> : filtered.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No exceptions" message="Nothing needs attention right now." />
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <div key={e.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/loads/${e.load_id}`} className="font-medium hover:underline">{e.title}</Link>
                <p className="text-xs text-muted-foreground">Load {e.load_number || '—'} · {e.evidence}</p>
                <div className="flex items-center gap-2 mt-1">
                  <ToneBadge tone={e.severity === 'Critical' ? 'danger' : e.severity === 'High' ? 'warning' : 'info'}>{e.severity}</ToneBadge>
                  <ToneBadge tone="neutral">{e.status}</ToneBadge>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {e.status === 'open' && <Button size="sm" variant="outline" onClick={() => acknowledge(e)}>Acknowledge</Button>}
                {e.status !== 'resolved' && <Button size="sm" variant="outline" onClick={() => resolve(e)}><CheckCircle2 className="w-4 h-4 mr-1" /> Resolve</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}