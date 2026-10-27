import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import CostBreakdown from '@/components/load/CostBreakdown';
import DispatcherShare from '@/components/load/DispatcherShare';
import DecisionCard from '@/components/load/DecisionCard';
import RiskPanel from '@/components/load/RiskPanel';
import DeliveryTimingCard from '@/components/load/DeliveryTimingCard';
import Timeline from '@/components/load/Timeline';
import DetentionPanel from '@/components/load/DetentionPanel';
import PaymentPanel from '@/components/load/PaymentPanel';
import DocumentsPanel from '@/components/load/DocumentsPanel';
import BillingReadiness from '@/components/load/BillingReadiness';
import RouteMap from '@/components/load/RouteMap';
import { computeBillingReadiness } from '@/lib/billing';
import { computeEconomics, computeDispatcherShare, computeDecision, computeDeliveryTiming } from '@/lib/calculations';
import { computeIssues } from '@/lib/risk';
import { syncExceptions } from '@/lib/exceptions';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { currency, titleCase } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, ArrowLeft } from 'lucide-react';
import LoadDocumentsExport from '@/components/load/LoadDocumentsExport';

export default function LoadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings, carriers, companyId } = useWorkspace();
  const [load, setLoad] = useState(null);
  const [events, setEvents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const l = await api.entities.Load.get(id);
      setLoad(l);
      const [ev, fleetDrivers] = await Promise.all([
        api.entities.TimelineEvent.filter({ load_id: id }, '-created_date', 100),
        api.entities.Driver.filter({ company_id: companyId || l.company_id }, '-created_date', 100),
      ]);
      setEvents(ev);
      setDrivers(fleetDrivers || []);
      await syncExceptions(l, settings, carriers.find((c) => c.id === l.carrier_id) || {});
    } catch (e) {
      toast({ title: 'Load not found', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [id, settings, carriers, companyId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!id) return;
    api.entities.Document.filter({ load_id: id }, '-created_date', 100).then(setDocs).catch(() => {});
  }, [id]);

  const carrier = carriers.find((c) => c.id === load?.carrier_id) || {};
  const assignedDriver = drivers.find((driver) => driver.id === load?.driver_id);
  const calc = useMemo(() => computeEconomics(load || {}, settings, carrier), [load, settings, carrier]);
  const share = useMemo(() => computeDispatcherShare(load || {}, calc, carrier), [load, calc, carrier]);
  const timing = useMemo(() => computeDeliveryTiming(load || {}, settings), [load, settings]);
  const issues = useMemo(() => computeIssues(load || {}, calc, settings, timing), [load, calc, settings, timing]);
  const decision = useMemo(() => computeDecision(load || {}, calc, settings, issues), [load, calc, settings, issues]);

  const readiness = useMemo(() => computeBillingReadiness(load || {}, docs, issues), [load, docs, issues]);

  // Called by the Documents panel after any upload, removal, or review change.
  const handleDocsChange = async (nextDocs, event) => {
    setDocs(nextDocs);
    if (event) {
      await api.entities.TimelineEvent.create({ company_id: load.company_id, load_id: load.id, type: event.type, source: 'dispatcher', notes: event.notes });
      setEvents((e) => [{ id: 'tmp' + Date.now(), type: event.type, source: 'dispatcher', notes: event.notes, created_date: new Date().toISOString() }, ...e]);
    }
    const flags = { pod_present: nextDocs.some((d) => d.doc_type === 'pod'), bol_present: nextDocs.some((d) => d.doc_type === 'bol'), ratecon_present: nextDocs.some((d) => d.doc_type === 'rate_confirmation') };
    if (flags.pod_present !== load.pod_present || flags.bol_present !== load.bol_present || flags.ratecon_present !== load.ratecon_present) {
      const updated = await api.entities.Load.update(load.id, flags);
      setLoad(updated);
      await syncExceptions(updated, settings, carrier);
    }
  };

  const changeStatus = async (newStatus) => {
    if (newStatus === 'billing_ready' && !readiness.ready) {
      toast({ title: 'Not ready for billing', description: readiness.missing.join('. ') + '.', variant: 'destructive' });
      return;
    }
    const updated = await api.entities.Load.update(load.id, { status: newStatus });
    setLoad(updated);
    await api.entities.TimelineEvent.create({ company_id: load.company_id, load_id: load.id, type: 'status_change', source: 'dispatcher', notes: `Status → ${titleCase(newStatus)}` });
    setEvents((e) => [{ id: 'tmp' + Date.now(), type: 'status_change', source: 'dispatcher', notes: `Status → ${titleCase(newStatus)}`, created_date: new Date().toISOString() }, ...e]);
    await syncExceptions(updated, settings, carrier);
  };

  const addEvent = async (type, notes = '') => {
    await api.entities.TimelineEvent.create({ company_id: load.company_id, load_id: load.id, type, source: 'dispatcher', notes });
    setEvents((e) => [{ id: 'tmp' + Date.now(), type, source: 'dispatcher', notes, created_date: new Date().toISOString() }, ...e]);
  };

  const handleTake = async () => {
    const updated = await api.entities.Load.update(load.id, { status: 'booked', decision: 'take', decision_at: new Date().toISOString() });
    setLoad(updated);
    await addEvent('load_accepted', `Accepted at ${currency(load.rate)}`);
    await syncExceptions(updated, settings, carrier);
    toast({ title: 'Load accepted', description: 'Status set to Booked.' });
  };

  const handlePass = async (reason) => {
    const updated = await api.entities.Load.update(load.id, { status: 'cancelled', decision: 'pass', decision_at: new Date().toISOString(), pass_reason: reason || '' });
    setLoad(updated);
    await addEvent('load_passed', reason ? `Reason: ${reason}` : `Passed at ${currency(load.rate)}`);
    await syncExceptions(updated, settings, carrier);
    toast({ title: 'Load passed', description: 'Status set to Cancelled.' });
  };

  const handleCounter = async ({ rate, note }) => {
    const updated = await api.entities.Load.update(load.id, { decision: 'counter', decision_at: new Date().toISOString(), counter_rate: rate, counter_note: note || '' });
    setLoad(updated);
    await addEvent('counter_offer_sent', `Counter ${currency(rate)} (was ${currency(load.rate)})${note ? ` — ${note}` : ''}`);
    toast({ title: 'Counter offer sent', description: `Counter at ${currency(rate)}.` });
  };

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!load) return (
    <div className="py-16 text-center">
      <p className="font-heading text-xl">Load not found</p>
      <p className="text-sm text-muted-foreground mt-1">This load may have been removed or you may not have access.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/loads')}>Back to loads</Button>
    </div>
  );

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/loads')} className="mb-2 -ml-2"><ArrowLeft className="w-4 h-4 mr-1" /> Back to loads</Button>
      <PageHeader
        title={load.load_number || 'Untitled load'}
        subtitle={`${load.broker_name || '—'} · ${load.pickup_city}, ${load.pickup_state} → ${load.delivery_city}, ${load.delivery_state} · ${currency(load.rate)}`}
        actions={
          <div className="flex items-center gap-2">
            <Select value={load.status} onValueChange={changeStatus}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries({ ...{ draft: 'Draft', pending_review: 'Pending Review', ready: 'Ready', booked: 'Booked', driver_assigned: 'Driver Assigned', at_pickup: 'At Pickup', loading: 'Loading', in_transit: 'In Transit', at_delivery: 'At Delivery', delivered: 'Delivered', pod_pending: 'POD Pending', billing_review: 'Billing Review', billing_ready: 'Billing Ready', completed: 'Completed', cancelled: 'Cancelled' } }).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Link to={`/loads/${load.id}/edit`}><Button variant="outline"><Pencil className="w-4 h-4 mr-1" /> Edit</Button></Link>
          </div>
        }
      />

      <div className="mb-4"><LoadDocumentsExport load={load} /></div>

      <Card className="mb-5 border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned driver</p>
            <p className="mt-1 text-lg font-semibold">{assignedDriver?.name || (load.driver_id ? 'Assigned driver (details unavailable)' : 'No driver assigned')}</p>
            {assignedDriver && <p className="text-sm text-muted-foreground">{assignedDriver.phone || assignedDriver.email || 'Fleet driver'}</p>}
          </div>
          <Link to={`/loads/${load.id}/edit`}><Button variant="outline" size="sm">{load.driver_id ? 'Change driver' : 'Assign driver'}</Button></Link>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <RouteMap load={load} />
          <DecisionCard decision={decision} load={load} onTake={handleTake} onPass={handlePass} onCounter={handleCounter} />
          <CostBreakdown calc={calc} />
          <DispatcherShare share={share} calc={calc} />
          <DeliveryTimingCard timing={timing} />
        </div>
        <div className="space-y-4">
          <RiskPanel issues={issues} />
          <DocumentsPanel load={load} docs={docs} onChange={handleDocsChange} />
          <BillingReadiness readiness={readiness} />
          <DetentionPanel load={load} settings={settings} />
          <PaymentPanel load={load} settings={settings} />
          <Timeline events={events} />
        </div>
      </div>

      <Card className="mt-5">
        <CardContent className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <Info label="Pickup" value={`${load.pickup_company || ''} ${load.pickup_address || ''} ${load.pickup_city || ''} ${load.pickup_state || ''} ${load.pickup_zip || ''}`.trim() || '—'} sub={`${load.pickup_date || '—'} ${load.pickup_appointment || ''}`} />
          <Info label="Delivery" value={`${load.delivery_company || ''} ${load.delivery_address || ''} ${load.delivery_city || ''} ${load.delivery_state || ''} ${load.delivery_zip || ''}`.trim() || '—'} sub={`${load.delivery_date || '—'} ${load.delivery_appointment || ''}`} />
          <Info label="Commodity / weight" value={`${load.commodity || '—'} / ${load.weight_lb ? load.weight_lb + ' lb' : '—'}`} />
          <Info label="Equipment" value={titleCase(load.equipment_type)} />
          <Info label="Broker reference / MC" value={`${load.broker_reference || '—'} / ${load.broker_mc || '—'}`} />
          <Info label="Broker contact" value={`${load.broker_phone || ''} ${load.broker_email || ''}`.trim() || '—'} />
          {load.special_instructions && <Info label="Special instructions" value={load.special_instructions} />}
          {load.notes && <Info label="Notes" value={load.notes} />}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value, sub }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}