import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/layout/PageHeader';
import CostBreakdown from '@/components/load/CostBreakdown';
import DispatcherShare from '@/components/load/DispatcherShare';
import DecisionCard from '@/components/load/DecisionCard';
import RiskPanel from '@/components/load/RiskPanel';
import DeliveryTimingCard from '@/components/load/DeliveryTimingCard';
import { computeEconomics, computeDispatcherShare, computeDecision, computeDeliveryTiming } from '@/lib/calculations';
import { computeIssues } from '@/lib/risk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label as LabelComp } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Zap, Save, Eraser } from 'lucide-react';

export default function QuickCheck() {
  const { settings, carriers, companyId } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [f, setF] = useState({
    carrier_id: '', rate: '', loaded_miles: '', deadhead_miles: '', weight_lb: '',
    pickup_city: '', pickup_state: '', pickup_date: '', pickup_appointment: '',
    delivery_city: '', delivery_state: '', delivery_date: '', delivery_appointment: '',
    detention_terms: '', broker_name: '', broker_phone: '',
  });
  const [pasted, setPasted] = useState('');
  const [saving, setSaving] = useState(false);

  const carrier = carriers.find((c) => c.id === f.carrier_id) || {};
  const calc = useMemo(() => computeEconomics(f, settings, carrier), [f, settings, carrier]);
  const share = useMemo(() => computeDispatcherShare(f, calc, carrier), [f, calc, carrier]);
  const timing = useMemo(() => computeDeliveryTiming(f, settings), [f, settings]);
  const issues = useMemo(() => computeIssues(f, calc, settings, timing), [f, calc, settings, timing]);
  const decision = useMemo(() => computeDecision(f, calc, settings, issues), [f, calc, settings, issues]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value === '' ? '' : (['rate', 'loaded_miles', 'deadhead_miles', 'weight_lb'].includes(k) ? Number(e.target.value) : e.target.value) });

  const readPasted = async () => {
    if (!pasted.trim()) return;
    try {
      const res = await api.ai.extractOffer(pasted);
      const merged = { ...f };
      for (const [k, v] of Object.entries(res)) { if (v !== null && v !== undefined) merged[k] = v; }
      setF(merged);
      toast({ title: 'Offer text read' });
    } catch (e) {
      toast({ title: 'Could not read text', description: e.message, variant: 'destructive' });
    }
  };

  const saveAsLoad = async () => {
    setSaving(true);
    try {
      const load = await api.entities.Load.create({
        company_id: companyId, carrier_id: f.carrier_id || null,
        load_number: 'QC-' + Date.now().toString().slice(-6),
        broker_name: f.broker_name, broker_phone: f.broker_phone,
        pickup_city: f.pickup_city, pickup_state: f.pickup_state, pickup_date: f.pickup_date, pickup_appointment: f.pickup_appointment,
        delivery_city: f.delivery_city, delivery_state: f.delivery_state, delivery_date: f.delivery_date, delivery_appointment: f.delivery_appointment,
        rate: Number(f.rate) || null, loaded_miles: Number(f.loaded_miles) || null, deadhead_miles: Number(f.deadhead_miles) || null,
        weight_lb: Number(f.weight_lb) || null, detention_terms: f.detention_terms,
        status: 'draft',
      });
      await api.entities.TimelineEvent.create({ company_id: companyId, load_id: load.id, type: 'quick_check_saved', source: 'dispatcher', notes: 'Saved from Quick check' });
      toast({ title: 'Saved as draft load' });
      navigate(`/loads/${load.id}`);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Quick check" subtitle="Decide before you answer the broker. Enter the numbers or paste the offer text." />
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <LabelComp className="text-xs">Paste the offer text</LabelComp>
            <Textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3} placeholder="Paste the broker's text or email offer…" className="text-sm" />
            <Button size="sm" variant="outline" onClick={readPasted}><Zap className="w-4 h-4 mr-1" /> Read pasted text</Button>
            <p className="text-xs text-muted-foreground">Missing values are reported, never guessed. Text is treated as untrusted data.</p>
          </div>
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <LabelComp className="text-xs">Carrier</LabelComp>
                <Select value={f.carrier_id || ''} onValueChange={(v) => setF({ ...f, carrier_id: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Default costs" /></SelectTrigger>
                  <SelectContent>{carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><LabelComp className="text-xs">Rate ($)</LabelComp><Input type="number" value={f.rate} onChange={set('rate')} className="h-9" /></div>
              <div><LabelComp className="text-xs">Loaded miles</LabelComp><Input type="number" value={f.loaded_miles} onChange={set('loaded_miles')} className="h-9" /></div>
              <div><LabelComp className="text-xs">Deadhead miles</LabelComp><Input type="number" value={f.deadhead_miles} onChange={set('deadhead_miles')} className="h-9" /></div>
              <div><LabelComp className="text-xs">Weight (lb)</LabelComp><Input type="number" value={f.weight_lb} onChange={set('weight_lb')} className="h-9" /></div>
              <div><LabelComp className="text-xs">Broker</LabelComp><Input value={f.broker_name} onChange={set('broker_name')} className="h-9" /></div>
              <div><LabelComp className="text-xs">Pickup city, state</LabelComp><Input value={`${f.pickup_city || ''}`} onChange={(e) => setF({ ...f, pickup_city: e.target.value })} className="h-9" /></div>
              <div><LabelComp className="text-xs">Delivery city, state</LabelComp><Input value={f.delivery_city || ''} onChange={(e) => setF({ ...f, delivery_city: e.target.value })} className="h-9" /></div>
              <div><LabelComp className="text-xs">Pickup date</LabelComp><Input type="date" value={f.pickup_date} onChange={set('pickup_date')} className="h-9" /></div>
              <div><LabelComp className="text-xs">Delivery date</LabelComp><Input type="date" value={f.delivery_date} onChange={set('delivery_date')} className="h-9" /></div>
              <div><LabelComp className="text-xs">Pickup appt</LabelComp><Input value={f.pickup_appointment} onChange={set('pickup_appointment')} placeholder="08:00-10:00" className="h-9" /></div>
              <div><LabelComp className="text-xs">Delivery appt</LabelComp><Input value={f.delivery_appointment} onChange={set('delivery_appointment')} placeholder="14:00" className="h-9" /></div>
              <div className="sm:col-span-2"><LabelComp className="text-xs">Detention terms (if stated)</LabelComp><Input value={f.detention_terms} onChange={set('detention_terms')} className="h-9" /></div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={saveAsLoad} disabled={saving}><Save className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save as load'}</Button>
              <Button variant="outline" onClick={() => setF({ carrier_id: f.carrier_id })}><Eraser className="w-4 h-4 mr-1" /> Clear</Button>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <DecisionCard decision={decision} />
          <CostBreakdown calc={calc} />
          <DispatcherShare share={share} calc={calc} />
          <DeliveryTimingCard timing={timing} />
          <RiskPanel issues={issues} />
        </div>
      </div>
    </div>
  );
}