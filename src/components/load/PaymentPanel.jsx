import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { userCompanyId } from '@/lib/useWorkspace';
import { useAuth } from '@/lib/AuthContext';
import ToneBadge from '@/components/layout/ToneBadge';

export default function PaymentPanel({ load, settings }) {
  const { user } = useAuth();
  const companyId = userCompanyId(user);
  const { toast } = useToast();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ invoice_date: '', invoice_amount: '', paid_date: '', amount_received: '', note: '' });

  const loadPayment = useCallback(async () => {
    if (!load?.id) return;
    setLoading(true);
    try {
      const list = await api.entities.Payment.filter({ load_id: load.id });
      let p = list[0];
      if (!p) {
        p = await api.entities.Payment.create({
          company_id: companyId, load_id: load.id, load_number: load.load_number,
          invoice_amount: load.rate || 0,
        });
      }
      setPayment(p);
      setForm({
        invoice_date: p.invoice_date || '', invoice_amount: p.invoice_amount ?? '',
        paid_date: p.paid_date || '', amount_received: p.amount_received ?? '', note: p.note || '',
      });
    } finally { setLoading(false); }
  }, [load?.id, companyId, load?.load_number, load?.rate]);

  useEffect(() => { loadPayment(); }, [loadPayment]);

  const status = (() => {
    if (!payment) return 'not_invoiced';
    if (!payment.invoice_date) return 'not_invoiced';
    if (payment.paid_date && payment.amount_received >= 0 && payment.invoice_amount && Number(payment.amount_received) < Number(payment.invoice_amount)) return 'short_paid';
    if (payment.paid_date) return 'paid';
    const days = Math.floor((Date.now() - new Date(payment.invoice_date)) / 86400000);
    if (days > (settings.expected_payment_days || 30)) return 'overdue';
    return 'invoiced';
  })();

  const save = async () => {
    if (form.paid_date && !form.invoice_date) { toast({ title: 'Invoice date required before paid date', variant: 'destructive' }); return; }
    if (form.paid_date && form.invoice_date && form.paid_date < form.invoice_date) { toast({ title: 'Paid date cannot precede invoice date', variant: 'destructive' }); return; }
    const updated = await api.entities.Payment.update(payment.id, {
      invoice_date: form.invoice_date || null,
      invoice_amount: form.invoice_amount === '' ? null : Number(form.invoice_amount),
      paid_date: form.paid_date || null,
      amount_received: form.amount_received === '' ? null : Number(form.amount_received),
      note: form.note,
    });
    setPayment(updated);
    toast({ title: 'Payment saved' });
  };

  if (loading) return <Card><CardContent className="py-6 text-sm text-muted-foreground">Loading payment…</CardContent></Card>;

  const STATUS_TONE = { not_invoiced: 'neutral', invoiced: 'info', overdue: 'danger', paid: 'success', short_paid: 'warning' };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-xl">Payment</CardTitle>
          <ToneBadge tone={STATUS_TONE[status]}>{status.replace('_', ' ')}</ToneBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Invoice date</Label>
            <Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Invoice amount</Label>
            <Input type="number" value={form.invoice_amount} onChange={(e) => setForm({ ...form, invoice_amount: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Paid date</Label>
            <Input type="date" value={form.paid_date} onChange={(e) => setForm({ ...form, paid_date: e.target.value })} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Amount received</Label>
            <Input type="number" value={form.amount_received} onChange={(e) => setForm({ ...form, amount_received: e.target.value })} className="h-9" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Note (short-pay reason, quick-pay fee)</Label>
          <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className="text-sm" />
        </div>
        <Button size="sm" onClick={save}>Save payment</Button>
      </CardContent>
    </Card>
  );
}