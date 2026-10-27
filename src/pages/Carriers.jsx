import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import EmptyState from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { currency } from '@/lib/format';

const empty = { name: '', mc_number: '', fee_mode: 'percent', fee_percent: 5, fee_flat: 0, fee_base: 'gross', mpg: '', driver_pay_per_mile: '', maintenance_per_mile: '', fixed_allocation: '' };

export default function Carriers() {
  const { companyId } = useWorkspace();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState(empty);

  const load = async () => setItems(await api.entities.Carrier.filter({ company_id: companyId }, '-created_date', 100));
  useEffect(() => { if (companyId) load(); }, [companyId]);

  const openNew = () => { setEdit(null); setF(empty); setOpen(true); };
  const openEdit = (c) => { setEdit(c); setF({ ...empty, ...c }); setOpen(true); };

  const save = async () => {
    if (!f.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    const pct = Number(f.fee_percent);
    if (f.fee_mode === 'percent' && (pct < 0 || pct > 100)) { toast({ title: 'Fee % must be 0–100', variant: 'destructive' }); return; }
    const data = { ...f, fee_percent: Number(f.fee_percent), fee_flat: Number(f.fee_flat), mpg: f.mpg === '' ? null : Number(f.mpg), driver_pay_per_mile: f.driver_pay_per_mile === '' ? null : Number(f.driver_pay_per_mile), maintenance_per_mile: f.maintenance_per_mile === '' ? null : Number(f.maintenance_per_mile), fixed_allocation: f.fixed_allocation === '' ? null : Number(f.fixed_allocation) };
    if (edit) await api.entities.Carrier.update(edit.id, data);
    else await api.entities.Carrier.create({ ...data, company_id: companyId });
    setOpen(false); load(); toast({ title: 'Carrier saved' });
  };

  const remove = async (c) => {
    const loads = await api.entities.Load.filter({ company_id: companyId, carrier_id: c.id }, '-created_date', 1);
    if (loads.length) { toast({ title: 'Cannot delete: carrier has loads', variant: 'destructive' }); return; }
    await api.entities.Carrier.delete(c.id); load();
  };

  return (
    <div>
      <PageHeader title="Carriers" subtitle="Multi-carrier workspace with per-carrier costs and dispatch fees." actions={<Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add carrier</Button>} />
      {items.length === 0 ? (
        <EmptyState icon={Building2} title="No carriers" message="Add a carrier to assign loads and track fees." action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add carrier</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading text-lg">{c.name}</p>
                  <p className="text-xs text-muted-foreground">MC {c.mc_number || '—'}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <p className="mt-2 text-sm">Fee: {c.fee_mode === 'flat' ? currency(c.fee_flat) : `${c.fee_percent}% (${c.fee_base})`}</p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? 'Edit carrier' : 'Add carrier'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>MC number</Label><Input value={f.mc_number} onChange={(e) => setF({ ...f, mc_number: e.target.value })} /></div>
            <div>
              <Label>Fee mode</Label>
              <Select value={f.fee_mode} onValueChange={(v) => setF({ ...f, fee_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percent">Percent</SelectItem><SelectItem value="flat">Flat</SelectItem></SelectContent>
              </Select>
            </div>
            {f.fee_mode === 'percent' ? (
              <div><Label>Fee %</Label><Input type="number" step="any" value={f.fee_percent} onChange={(e) => setF({ ...f, fee_percent: e.target.value })} /></div>
            ) : (
              <div><Label>Flat fee ($)</Label><Input type="number" step="any" value={f.fee_flat} onChange={(e) => setF({ ...f, fee_flat: e.target.value })} /></div>
            )}
            <div>
              <Label>Fee base</Label>
              <Select value={f.fee_base} onValueChange={(v) => setF({ ...f, fee_base: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gross">Gross rate</SelectItem><SelectItem value="net">Net after fuel/lumper</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>MPG (override)</Label><Input type="number" step="any" value={f.mpg} onChange={(e) => setF({ ...f, mpg: e.target.value })} placeholder="Default" /></div>
            <div><Label>Driver $/mi (override)</Label><Input type="number" step="any" value={f.driver_pay_per_mile} onChange={(e) => setF({ ...f, driver_pay_per_mile: e.target.value })} placeholder="Default" /></div>
            <div><Label>Maintenance $/mi</Label><Input type="number" step="any" value={f.maintenance_per_mile} onChange={(e) => setF({ ...f, maintenance_per_mile: e.target.value })} placeholder="Default" /></div>
            <div><Label>Fixed $/trip</Label><Input type="number" step="any" value={f.fixed_allocation} onChange={(e) => setF({ ...f, fixed_allocation: e.target.value })} placeholder="Default" /></div>
          </div>
          <Button onClick={save} className="mt-2">Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}