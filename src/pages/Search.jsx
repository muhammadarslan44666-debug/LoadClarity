import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/layout/StatusBadge';
import EmptyState from '@/components/layout/EmptyState';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, Package, Users, Building2 } from 'lucide-react';

export default function Search() {
  const { companyId } = useWorkspace();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [loads, setLoads] = useState([]);
  const [brokers, setBrokers] = useState([]);
  const [carriers, setCarriers] = useState([]);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      api.entities.Load.filter({ company_id: companyId }, '-created_date', 300),
      api.entities.Broker.filter({ company_id: companyId }, '-created_date', 200),
      api.entities.Carrier.filter({ company_id: companyId }, '-created_date', 200),
    ]).then(([l, b, c]) => { setLoads(l || []); setBrokers(b || []); setCarriers(c || []); });
  }, [companyId]);

  const s = q.toLowerCase().trim();
  const match = (vals) => s === '' || vals.some((v) => (v || '').toLowerCase().includes(s));

  const loadResults = useMemo(() => s ? loads.filter((l) => match([l.load_number, l.broker_name, l.broker_reference, l.pickup_city, l.delivery_city, l.status])) : [], [loads, s]);
  const brokerResults = useMemo(() => s ? brokers.filter((b) => match([b.name, b.mc_number, b.contact_name, b.phone, b.email])) : [], [brokers, s]);
  const carrierResults = useMemo(() => s ? carriers.filter((c) => match([c.name, c.mc_number])) : [], [carriers, s]);

  return (
    <div>
      <PageHeader title="Search" subtitle="Across loads, brokers, and carriers." />
      <div className="relative max-w-md mb-5">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 h-10" autoFocus />
      </div>
      {!s ? <EmptyState icon={SearchIcon} title="Start typing to search" message="Find loads, brokers, and carriers across your workspace." /> : (
        <div className="space-y-5">
          <Section icon={Package} title="Loads" items={loadResults.map((l) => ({ to: `/loads/${l.id}`, primary: l.load_number || 'Untitled', secondary: `${l.broker_name || ''} ${l.pickup_city || ''} → ${l.delivery_city || ''}`, badge: <StatusBadge status={l.status} /> }))} />
          <Section icon={Users} title="Brokers" items={brokerResults.map((b) => ({ to: '/brokers', primary: b.name, secondary: `MC ${b.mc_number || '—'} · ${b.phone || b.email || ''}` }))} />
          <Section icon={Building2} title="Carriers" items={carrierResults.map((c) => ({ to: '/carriers', primary: c.name, secondary: `MC ${c.mc_number || '—'}` }))} />
          {loadResults.length + brokerResults.length + carrierResults.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <h2 className="font-heading text-lg mb-2 flex items-center gap-2"><Icon className="w-4 h-4" /> {title} <span className="text-xs text-muted-foreground">({items.length})</span></h2>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <Link key={i} to={it.to} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 hover:bg-accent">
            <div className="min-w-0"><p className="text-sm font-medium truncate">{it.primary}</p><p className="text-xs text-muted-foreground truncate">{it.secondary}</p></div>
            {it.badge}
          </Link>
        ))}
      </div>
    </div>
  );
}