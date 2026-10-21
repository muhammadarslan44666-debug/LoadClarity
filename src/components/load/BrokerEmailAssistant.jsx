import React, { useMemo, useState } from 'react';
import { Copy, Mail, MessageSquareText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const money = (n) => Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '[your target rate]';

export default function BrokerEmailAssistant({ load }) {
  const issues = useMemo(() => {
    const found = [];
    if (!String(load.detention_terms || '').trim()) found.push({ id: 'detention', label: 'Detention terms not found' });
    if (!String(load.pickup_appointment || '').trim()) found.push({ id: 'pickup', label: 'Pickup appointment missing' });
    if (!String(load.delivery_appointment || '').trim()) found.push({ id: 'delivery', label: 'Delivery appointment missing' });
    const rate = Number(load.rate || 0);
    const miles = Number(load.loaded_miles || 0);
    if (rate > 0 && miles > 0 && rate / miles < 2) found.push({ id: 'counter', label: 'Rate may be low (under $2.00/loaded mile)' });
    return found;
  }, [load]);
  const [subject, setSubject] = useState('Load details confirmation');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const generate = (issue) => {
    if (!issue) return;
    const route = `${load.pickup_city || '[pickup city]'}, ${load.pickup_state || '[state]'} to ${load.delivery_city || '[delivery city]'}, ${load.delivery_state || '[state]'}`;
    const ref = load.load_number || load.broker_reference || '[load reference]';
    const templates = {
      detention: { subject: `Load ${ref}: detention terms confirmation`, body: `Hello ${load.broker_name || 'Broker Team'},\n\nBefore dispatching load ${ref} (${route}), could you please confirm the detention policy, free-time allowance, and applicable hourly rate? Please also advise how detention must be documented and approved.\n\nThank you,\n[Your name]` },
      pickup: { subject: `Load ${ref}: pickup appointment details`, body: `Hello ${load.broker_name || 'Broker Team'},\n\nCould you please confirm the pickup appointment date and time/window for load ${ref} (${route})? Please share any check-in instructions or appointment number.\n\nThank you,\n[Your name]` },
      delivery: { subject: `Load ${ref}: delivery appointment details`, body: `Hello ${load.broker_name || 'Broker Team'},\n\nCould you please confirm the delivery appointment date and time/window for load ${ref} (${route})? Please share any receiver check-in instructions or appointment number.\n\nThank you,\n[Your name]` },
      counter: { subject: `Load ${ref}: rate discussion`, body: `Hello ${load.broker_name || 'Broker Team'},\n\nThank you for the offer on load ${ref} (${route}). Based on the loaded miles, operating costs, and current capacity, would you be able to revise the rate from ${money(load.rate)} to ${money(load.suggested_counter_rate || Math.max(Number(load.rate || 0) + 150, Number(load.loaded_miles || 0) * 2.25))}?\n\nWe appreciate your consideration and look forward to working together.\n\nBest regards,\n[Your name]` },
    };
    const template = templates[issue.id]; setSubject(template.subject); setMessage(template.body); setCopied(false);
  };
  const openMail = () => { const url = `mailto:${encodeURIComponent(load.broker_email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`; window.location.href = url; };
  const copy = async () => { try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${message}`); setCopied(true); } catch { setCopied(false); } };
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4 text-primary" /> Broker Email & Counter Generator</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {issues.length ? <div className="space-y-2">{issues.map((issue) => <div key={issue.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"><span className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" />{issue.label}</span><Button type="button" size="sm" variant="outline" onClick={() => generate(issue)}>Generate message</Button></div>)}</div> : <p className="text-sm text-muted-foreground">No common missing-term or low-rate warnings detected. You can still generate a message by filling in load details and reviewing the warnings.</p>}
        {message && <div className="space-y-3 border-t border-border pt-4"><div><Label className="text-xs">Email subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" /></div><div><Label className="text-xs">Message</Label><Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} className="mt-1 text-sm" /></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={copy}><Copy className="mr-2 h-4 w-4" />{copied ? 'Copied' : 'Copy email'}</Button><Button type="button" variant="outline" onClick={openMail}><Mail className="mr-2 h-4 w-4" />Open in email app</Button></div><p className="text-xs text-muted-foreground">Review and personalize the draft before sending. “Open in email app” uses your device’s configured mail handler.</p></div>}
      </CardContent>
    </Card>
  );
}
