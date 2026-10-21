import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { EQUIPMENT_LABELS, STATUS_LABELS } from '@/lib/format';
import RateConfirmationImporter from '@/components/load/RateConfirmationImporter';
import BrokerEmailAssistant from '@/components/load/BrokerEmailAssistant';

const field = (label, key, type = 'text', opts = {}) => (
  <div>
    <Label className="text-xs">{label}</Label>
    <Input
      type={type}
      value={opts.value ?? ''}
      onChange={opts.onChange}
      placeholder={opts.placeholder}
      className="h-9"
      step={type === 'number' ? 'any' : undefined}
    />
  </div>
);

export default function LoadForm({ initial, carriers, brokers, drivers, trucks, onSave, onCancel, saving, submitLabel = 'Save' }) {
  const [f, setF] = useState(initial || {});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setSel = (k) => (v) => setF({ ...f, [k]: v });
  const num = (k) => (e) => setF({ ...f, [k]: e.target.value === '' ? '' : Number(e.target.value) });
  const applyParsedFields = (parsed) => setF((current) => ({ ...current, ...parsed }));

  return (
    <div className="space-y-5">
      <RateConfirmationImporter onParsed={applyParsedFields} />
      <Card>
        <CardHeader><CardTitle className="font-heading text-xl">Broker & reference</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Carrier</Label>
            <Select value={f.carrier_id || ''} onValueChange={setSel('carrier_id')}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select carrier" /></SelectTrigger>
              <SelectContent>{carriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Broker (saved)</Label>
            <Select value={f.broker_id || ''} onValueChange={setSel('broker_id')}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select broker" /></SelectTrigger>
              <SelectContent>{brokers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {field('Load number', 'load_number', 'text', { value: f.load_number, onChange: set('load_number') })}
          {field('Broker name (if not saved)', 'broker_name', 'text', { value: f.broker_name, onChange: set('broker_name') })}
          {field('Broker reference', 'broker_reference', 'text', { value: f.broker_reference, onChange: set('broker_reference') })}
          {field('Broker MC', 'broker_mc', 'text', { value: f.broker_mc, onChange: set('broker_mc') })}
          {field('Broker phone', 'broker_phone', 'text', { value: f.broker_phone, onChange: set('broker_phone') })}
          {field('Broker email', 'broker_email', 'text', { value: f.broker_email, onChange: set('broker_email') })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-heading text-xl">Pickup</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {field('Company', 'pickup_company', 'text', { value: f.pickup_company, onChange: set('pickup_company') })}
          {field('Address', 'pickup_address', 'text', { value: f.pickup_address, onChange: set('pickup_address') })}
          {field('City', 'pickup_city', 'text', { value: f.pickup_city, onChange: set('pickup_city') })}
          {field('State', 'pickup_state', 'text', { value: f.pickup_state, onChange: set('pickup_state') })}
          {field('ZIP', 'pickup_zip', 'text', { value: f.pickup_zip, onChange: set('pickup_zip') })}
          {field('Date', 'pickup_date', 'date', { value: f.pickup_date, onChange: set('pickup_date') })}
          {field('Appointment / window', 'pickup_appointment', 'text', { value: f.pickup_appointment, onChange: set('pickup_appointment'), placeholder: 'e.g. 08:00-10:00' })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-heading text-xl">Delivery</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {field('Company', 'delivery_company', 'text', { value: f.delivery_company, onChange: set('delivery_company') })}
          {field('Address', 'delivery_address', 'text', { value: f.delivery_address, onChange: set('delivery_address') })}
          {field('City', 'delivery_city', 'text', { value: f.delivery_city, onChange: set('delivery_city') })}
          {field('State', 'delivery_state', 'text', { value: f.delivery_state, onChange: set('delivery_state') })}
          {field('ZIP', 'delivery_zip', 'text', { value: f.delivery_zip, onChange: set('delivery_zip') })}
          {field('Date', 'delivery_date', 'date', { value: f.delivery_date, onChange: set('delivery_date') })}
          {field('Appointment / window', 'delivery_appointment', 'text', { value: f.delivery_appointment, onChange: set('delivery_appointment'), placeholder: 'e.g. 14:00' })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-heading text-xl">Load details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {field('Commodity', 'commodity', 'text', { value: f.commodity, onChange: set('commodity') })}
          {field('Weight (lb)', 'weight_lb', 'number', { value: f.weight_lb, onChange: num('weight_lb') })}
          <div>
            <Label className="text-xs">Equipment</Label>
            <Select value={f.equipment_type || 'dry_van'} onValueChange={setSel('equipment_type')}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(EQUIPMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {field('Rate ($)', 'rate', 'number', { value: f.rate, onChange: num('rate') })}
          {field('Loaded miles', 'loaded_miles', 'number', { value: f.loaded_miles, onChange: num('loaded_miles') })}
          {field('Deadhead miles', 'deadhead_miles', 'number', { value: f.deadhead_miles, onChange: num('deadhead_miles') })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-heading text-xl">Terms & accessorials</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Detention terms</Label><Textarea value={f.detention_terms || ''} onChange={set('detention_terms')} rows={2} className="text-sm" /></div>
          <div><Label className="text-xs">Layover terms</Label><Textarea value={f.layover_terms || ''} onChange={set('layover_terms')} rows={2} className="text-sm" /></div>
          <div><Label className="text-xs">TONU terms</Label><Textarea value={f.tonu_terms || ''} onChange={set('tonu_terms')} rows={2} className="text-sm" /></div>
          <div><Label className="text-xs">Lumper terms</Label><Textarea value={f.lumper_terms || ''} onChange={set('lumper_terms')} rows={2} className="text-sm" /></div>
          {field('Lumper amount ($)', 'lumper_amount', 'number', { value: f.lumper_amount, onChange: num('lumper_amount') })}
          <div><Label className="text-xs">Other accessorials</Label><Textarea value={f.other_accessorials || ''} onChange={set('other_accessorials')} rows={2} className="text-sm" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Special instructions</Label><Textarea value={f.special_instructions || ''} onChange={set('special_instructions')} rows={2} className="text-sm" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Notes</Label><Textarea value={f.notes || ''} onChange={set('notes')} rows={2} className="text-sm" /></div>
        </CardContent>
      </Card>

      <BrokerEmailAssistant load={f} />

      <Card>
        <CardHeader><CardTitle className="font-heading text-xl">Assignment & status</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Driver</Label>
            <Select value={f.driver_id || ''} onValueChange={setSel('driver_id')}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>{drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Truck</Label>
            <Select value={f.truck_id || ''} onValueChange={setSel('truck_id')}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent>{trucks.map((t) => <SelectItem key={t.id} value={t.id}>{t.unit_number}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={f.status || 'draft'} onValueChange={setSel('status')}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="font-heading text-xl">Dispatcher fee (override)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Fee mode</Label>
            <Select value={f.fee_mode || ''} onValueChange={setSel('fee_mode')}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Use carrier default" /></SelectTrigger>
              <SelectContent><SelectItem value="percent">Percent</SelectItem><SelectItem value="flat">Flat</SelectItem></SelectContent>
            </Select>
          </div>
          {field('Fee %', 'fee_percent', 'number', { value: f.fee_percent, onChange: num('fee_percent') })}
          {field('Flat fee ($)', 'fee_flat', 'number', { value: f.fee_flat, onChange: num('fee_flat') })}
          <div>
            <Label className="text-xs">Fee base</Label>
            <Select value={f.fee_base || ''} onValueChange={setSel('fee_base')}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Use carrier default" /></SelectTrigger>
              <SelectContent><SelectItem value="gross">Gross rate</SelectItem><SelectItem value="net">Net after fuel/lumper</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button onClick={() => onSave(f)} disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
      </div>
    </div>
  );
}