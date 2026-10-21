import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/api/client';
import { computeDetention } from '@/lib/calculations';
import { currency } from '@/lib/format';
import { useToast } from '@/components/ui/use-toast';
import { userCompanyId } from '@/lib/useWorkspace';
import { useAuth } from '@/lib/AuthContext';

export default function DetentionPanel({ load, settings }) {
  const { user } = useAuth();
  const companyId = userCompanyId(user);
  const { toast } = useToast();
  const [event, setEvent] = useState(null);
  const [now, setNow] = useState(new Date());
  const [rate, setRate] = useState(0);
  const [terms, setTerms] = useState('');
  const [loading, setLoading] = useState(true);

  const loadEvent = useCallback(async () => {
    if (!load?.id) return;
    setLoading(true);
    try {
      const list = await api.entities.DetentionEvent.filter({ load_id: load.id });
      let ev = list[0];
      if (!ev) {
        ev = await api.entities.DetentionEvent.create({
          company_id: companyId, load_id: load.id,
          free_minutes: settings.free_detention_minutes || 120,
          status: 'no_detention',
        });
      }
      setEvent(ev);
      setRate(ev.detention_rate || 0);
      setTerms(ev.terms || load.detention_terms || '');
    } finally { setLoading(false); }
  }, [load?.id, companyId, settings.free_detention_minutes, load?.detention_terms]);

  useEffect(() => { loadEvent(); }, [loadEvent]);
  useEffect(() => {
    if (!event?.check_in_time || event?.departure_time) return;
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [event]);

  const calc = computeDetention(event || {}, settings, now);

  const stamp = async (field) => {
    const updated = await api.entities.DetentionEvent.update(event.id, {
      [field]: new Date().toISOString(),
      status: field === 'departure_time' ? 'confirmed' : 'potential',
    });
    setEvent(updated);
    toast({ title: field === 'check_in_time' ? 'Checked in' : 'Departed' });
  };

  const saveTerms = async () => {
    const updated = await api.entities.DetentionEvent.update(event.id, {
      detention_rate: Number(rate), terms,
    });
    setEvent(updated);
    toast({ title: 'Detention terms saved' });
  };

  if (loading) return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading detention…</CardContent></Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="font-heading text-xl">Detention assistant</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs text-muted-foreground">Arrival</p><p>{event.arrival_time ? new Date(event.arrival_time).toLocaleString() : '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Check-in</p><p>{event.check_in_time ? new Date(event.check_in_time).toLocaleString() : '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Departure</p><p>{event.departure_time ? new Date(event.departure_time).toLocaleString() : '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Status</p><p className="capitalize">{event.status?.replace('_', ' ')}</p></div>
        </div>
        <div className="flex gap-2">
          {!event.check_in_time && <Button size="sm" onClick={() => stamp('check_in_time')}>Check in now</Button>}
          {event.check_in_time && !event.departure_time && <Button size="sm" variant="secondary" onClick={() => stamp('departure_time')}>Departed now</Button>}
        </div>
        {calc.active && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">Live wait: {Math.floor(calc.waitMinutes)} min · Free: {calc.freeMinutes} min</p>
            <p className="font-heading text-2xl">{calc.potentialMinutes > 0 ? `${calc.potentialMinutes} min detention` : 'Within free time'}</p>
          </div>
        )}
        {calc.potentialMinutes > 0 && (
          <div className="flex justify-between font-semibold">
            <span>Potential amount</span><span className="tabular-nums text-primary">{currency(calc.potentialAmount)}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div>
            <Label className="text-xs">Detention rate ($/hr)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Free minutes</Label>
            <Input type="number" value={event.free_minutes || ''} disabled className="h-9" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Detention terms (from RateCon)</Label>
          <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className="text-sm" />
        </div>
        <Button size="sm" variant="outline" onClick={saveTerms}>Save terms</Button>
        <p className="text-xs text-muted-foreground">Potential detention amount based on entered/uploaded contractual terms. Not guaranteed.</p>
      </CardContent>
    </Card>
  );
}