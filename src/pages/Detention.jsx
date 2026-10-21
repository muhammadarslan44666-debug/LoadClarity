import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import { useCarrier } from '@/components/layout/CarrierContext';
import PageHeader from '@/components/layout/PageHeader';
import ToneBadge from '@/components/layout/ToneBadge';
import EmptyState from '@/components/layout/EmptyState';
import { computeDetention } from '@/lib/calculations';
import { currency, dateTimeStr } from '@/lib/format';
import { Clock } from 'lucide-react';

const STATUS_TONE = { no_detention: 'neutral', potential: 'warning', confirmed: 'warning', evidence_collected: 'info', submitted: 'info', resolved: 'success' };

export default function Detention() {
  const { companyId, settings } = useWorkspace();
  const { carrierId } = useCarrier();
  const [events, setEvents] = useState([]);
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      api.entities.DetentionEvent.filter({ company_id: companyId }, '-created_date', 200),
      api.entities.Load.filter({ company_id: companyId }, '-created_date', 200),
    ]).then(([e, l]) => { setEvents(e || []); setLoads(l || []); }).finally(() => setLoading(false));
  }, [companyId]);

  const loadMap = useMemo(() => new Map(loads.map((l) => [l.id, l])), [loads]);
  const filtered = useMemo(() => (carrierId === 'all' ? events : events.filter((e) => loadMap.get(e.load_id)?.carrier_id === carrierId)), [events, carrierId, loadMap]);

  return (
    <div>
      <PageHeader title="Detention" subtitle="Potential detention across loads. Potential amounts are not guaranteed." />
      {loading ? <p className="text-muted-foreground">Loading…</p> : filtered.length === 0 ? (
        <EmptyState icon={Clock} title="No detention events" message="Use the detention panel on a load to check in and track wait time." />
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const load = loadMap.get(e.load_id);
            const calc = computeDetention(e, settings);
            return (
              <Link key={e.id} to={`/loads/${e.load_id}`} className="block rounded-lg border border-border p-3 hover:bg-accent">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{load?.load_number || 'Load'}</p>
                    <p className="text-xs text-muted-foreground">Check-in {e.check_in_time ? dateTimeStr(e.check_in_time) : '—'} · Departure {e.departure_time ? dateTimeStr(e.departure_time) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {calc.potentialMinutes > 0 && <span className="font-heading text-lg text-primary">{currency(calc.potentialAmount)}</span>}
                    <ToneBadge tone={STATUS_TONE[e.status] || 'neutral'}>{e.status?.replace('_', ' ')}</ToneBadge>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}