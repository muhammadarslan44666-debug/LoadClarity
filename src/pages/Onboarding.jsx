import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Truck } from 'lucide-react';

export default function Onboarding() {
  const { user, checkUserAuth } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: '', fuel_price: 3.85, mpg: 7.5, driver_pay_per_mile: 0.65,
    maintenance_per_mile: 0.15, fixed_allocation: 0, min_margin_pct: 20,
    avg_speed: 50, expected_payment_days: 30, free_detention_minutes: 120,
    carrier_name: '', carrier_fee_percent: 5,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value === '' ? '' : (typeof f[k] === 'number' ? Number(e.target.value) : e.target.value) });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { toast({ title: 'Company name is required', variant: 'destructive' }); return; }
    if (!user) { toast({ title: 'User not authenticated', variant: 'destructive' }); return; }
    
    setSaving(true);
    try {
      // Insert workspace data into Supabase
      const { data, error } = await supabase
        .from('workspaces')
        .insert([
          {
            user_id: user.id,
            name: f.name,
            fuel_price: Number(f.fuel_price),
            mpg: Number(f.mpg),
            driver_pay_per_mile: Number(f.driver_pay_per_mile),
            maintenance_per_mile: Number(f.maintenance_per_mile),
            fixed_allocation: Number(f.fixed_allocation),
            min_margin_pct: Number(f.min_margin_pct),
            avg_speed: Number(f.avg_speed),
            expected_payment_days: Number(f.expected_payment_days),
            free_detention_minutes: Number(f.free_detention_minutes),
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Update auth state in background
      if (checkUserAuth) {
        checkUserAuth().catch(console.error);
      }

      // Show success toast
      toast({ title: 'Workspace created successfully!' });

      // Direct redirection to ensure navigation happens smoothly
      window.location.href = '/loads';
    } catch (err) {
      toast({ title: err.message || 'Onboarding failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            <div>
              <CardTitle className="font-heading text-2xl">Welcome to LoadClarity</CardTitle>
              <p className="text-sm text-muted-foreground">Set up your workspace to start analyzing loads.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label>Company / workspace name</Label>
              <Input value={f.name} onChange={set('name')} placeholder="e.g. Apex Dispatch" className="h-10" />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><Label className="text-xs">Fuel price ($/gal)</Label><Input type="number" step="any" value={f.fuel_price} onChange={set('fuel_price')} className="h-9" /></div>
              <div><Label className="text-xs">MPG</Label><Input type="number" step="any" value={f.mpg} onChange={set('mpg')} className="h-9" /></div>
              <div><Label className="text-xs">Driver pay ($/mi)</Label><Input type="number" step="any" value={f.driver_pay_per_mile} onChange={set('driver_pay_per_mile')} className="h-9" /></div>
              <div><Label className="text-xs">Maintenance ($/mi)</Label><Input type="number" step="any" value={f.maintenance_per_mile} onChange={set('maintenance_per_mile')} className="h-9" /></div>
              <div><Label className="text-xs">Fixed cost ($/trip)</Label><Input type="number" step="any" value={f.fixed_allocation} onChange={set('fixed_allocation')} className="h-9" /></div>
              <div><Label className="text-xs">Min margin %</Label><Input type="number" step="any" value={f.min_margin_pct} onChange={set('min_margin_pct')} className="h-9" /></div>
              <div><Label className="text-xs">Avg speed (mph)</Label><Input type="number" value={f.avg_speed} onChange={set('avg_speed')} className="h-9" /></div>
              <div><Label className="text-xs">Expected payment days</Label><Input type="number" value={f.expected_payment_days} onChange={set('expected_payment_days')} className="h-9" /></div>
              <div><Label className="text-xs">Free detention (min)</Label><Input type="number" value={f.free_detention_minutes} onChange={set('free_detention_minutes')} className="h-9" /></div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-2">Your first carrier (optional)</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">Carrier name</Label><Input value={f.carrier_name} onChange={set('carrier_name')} placeholder="e.g. Carrier A" className="h-9" /></div>
                <div><Label className="text-xs">Dispatch fee %</Label><Input type="number" step="any" value={f.carrier_fee_percent} onChange={set('carrier_fee_percent')} className="h-9" /></div>
              </div>
            </div>
            <Button type="submit" className="w-full h-11" disabled={saving}>
              {saving ? 'Setting up…' : 'Create workspace & start'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}