import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function Settings() {
  const { company, refresh, loading } = useWorkspace();
  const { toast } = useToast();
  const [f, setF] = useState(null);

  useEffect(() => { if (company) setF({ ...company }); }, [company]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value === '' ? '' : Number(e.target.value) });
  const save = async () => {
    await api.entities.Company.update(company.id, {
      name: f.name, fuel_price: Number(f.fuel_price), mpg: Number(f.mpg),
      driver_pay_mode: f.driver_pay_mode, driver_pay_per_mile: Number(f.driver_pay_per_mile),
      driver_pay_percent: Number(f.driver_pay_percent), maintenance_per_mile: Number(f.maintenance_per_mile),
      fixed_allocation: Number(f.fixed_allocation), tolls_other: Number(f.tolls_other),
      min_margin_pct: Number(f.min_margin_pct), min_per_mile: Number(f.min_per_mile),
      avg_speed: Number(f.avg_speed), expected_payment_days: Number(f.expected_payment_days),
      free_detention_minutes: Number(f.free_detention_minutes),
    });
    await refresh();
    toast({ title: 'Settings saved' });
  };

  if (loading || !f) return <p className="text-muted-foreground">Loading…</p>;

  const Field = ({ label, k, type = 'number' }) => (
    <div><Label className="text-xs">{label}</Label><Input type={type} step="any" value={f[k] ?? ''} onChange={set(k)} className="h-9" /></div>
  );

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company profile, cost defaults, and decision thresholds." actions={<Button onClick={save}>Save settings</Button>} />
      <div className="space-y-5 max-w-3xl">
        <Card>
          <CardHeader><CardTitle className="font-heading text-xl">Company</CardTitle></CardHeader>
          <CardContent><div><Label>Company name</Label><Input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-9" /></div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-heading text-xl">Cost defaults</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-3">
            <Field label="Fuel price ($/gal)" k="fuel_price" />
            <Field label="MPG" k="mpg" />
            <div>
              <Label className="text-xs">Driver pay mode</Label>
              <Select value={f.driver_pay_mode || 'per_mile'} onValueChange={(v) => setF({ ...f, driver_pay_mode: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="per_mile">Per mile</SelectItem><SelectItem value="percent">Percent of revenue</SelectItem></SelectContent>
              </Select>
            </div>
            <Field label="Driver pay ($/mi)" k="driver_pay_per_mile" />
            <Field label="Driver pay (%)" k="driver_pay_percent" />
            <Field label="Maintenance ($/mi)" k="maintenance_per_mile" />
            <Field label="Fixed cost ($/trip)" k="fixed_allocation" />
            <Field label="Tolls & other ($)" k="tolls_other" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-heading text-xl">Decision thresholds</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-3">
            <Field label="Minimum margin %" k="min_margin_pct" />
            <Field label="Min $/total mile (0 = off)" k="min_per_mile" />
            <Field label="Average speed (mph)" k="avg_speed" />
            <Field label="Expected payment days" k="expected_payment_days" />
            <Field label="Free detention minutes" k="free_detention_minutes" />
          </CardContent>
        </Card>
        <Button onClick={save}>Save settings</Button>
      </div>
    </div>
  );
}