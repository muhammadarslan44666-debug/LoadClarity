import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import EmptyState from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Wrench, Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { EQUIPMENT_LABELS, titleCase } from '@/lib/format';

export default function Fleet() {
  const { companyId } = useWorkspace();
  const { toast } = useToast();
  const [tab, setTab] = useState('trucks');
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loads, setLoads] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState({});

  const load = async () => {
    const [t, d, l] = await Promise.all([
      api.entities.Truck.filter({ company_id: companyId }, '-created_date', 100),
      api.entities.Driver.filter({ company_id: companyId }, '-created_date', 100),
      api.entities.Load.filter({ company_id: companyId }, '-created_date', 200),
    ]);
    setTrucks(t || []); setDrivers(d || []); setLoads(l || []);
  };
  useEffect(() => { if (companyId) load(); }, [companyId]);

  const activeLoadFor = (id, field) => loads.some((l) => l[field] === id && !['completed', 'cancelled'].includes(l.status));

  const openNew = (kind) => { setEdit(null); setF(kind === 'truck' ? { unit_number: '', vin: '', equipment_type: 'dry_van', mpg: '', status: 'available', notes: '' } : { name: '', phone: '', email: '', truck_id: '', status: 'available', notes: '' }); setOpen(true); };
  const openEdit = (item) => { setEdit(item); setF(item); setOpen(true); };

  const save = async () => {
    if (tab === 'trucks') {
      if (!f.unit_number?.trim()) { toast({ title: 'Unit number required', variant: 'destructive' }); return; }
      const data = { unit_number: f.unit_number, vin: f.vin, equipment_type: f.equipment_type, mpg: f.mpg === '' ? null : Number(f.mpg), status: f.status, notes: f.notes };
      if (edit) await api.entities.Truck.update(edit.id, data); else await api.entities.Truck.create({ ...data, company_id: companyId });
    } else {
      if (!f.name?.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
      const data = { name: f.name, phone: f.phone, email: f.email, truck_id: f.truck_id || null, status: f.status, notes: f.notes };
      if (edit) await api.entities.Driver.update(edit.id, data); else await api.entities.Driver.create({ ...data, company_id: companyId });
    }
    setOpen(false); await load();
    if (tab === 'drivers') window.dispatchEvent(new CustomEvent('loadclarity:fleet-drivers-changed'));
    toast({ title: 'Saved' });
  };

  const remove = async (item) => {
    const kind = tab === 'trucks' ? 'truck' : 'driver';
    if (activeLoadFor(item.id, kind + '_id')) { toast({ title: `Cannot delete: assigned to an active load`, variant: 'destructive' }); return; }
    if (tab === 'trucks') await api.entities.Truck.delete(item.id); else await api.entities.Driver.delete(item.id);
    await load();
    if (tab === 'drivers') window.dispatchEvent(new CustomEvent('loadclarity:fleet-drivers-changed'));
  };

  return (
    <div>
      <PageHeader title="Fleet" subtitle="Trucks and drivers. Assign them to loads from the load form." actions={<Button onClick={() => openNew(tab === 'trucks' ? 'truck' : 'driver')}><Plus className="w-4 h-4 mr-1" /> Add {tab === 'trucks' ? 'truck' : 'driver'}</Button>} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="trucks">Trucks</TabsTrigger><TabsTrigger value="drivers">Drivers</TabsTrigger></TabsList>
        <TabsContent value="trucks">
          {trucks.length === 0 ? <EmptyState icon={Wrench} title="No trucks" message="Add a truck to assign to loads." /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {trucks.map((t) => (
                <div key={t.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between">
                    <div><p className="font-heading text-lg">Unit {t.unit_number}</p><p className="text-xs text-muted-foreground">{EQUIPMENT_LABELS[t.equipment_type]}</p></div>
                    <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(t)}><Trash2 className="w-4 h-4" /></Button></div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground capitalize">{t.status?.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="drivers">
          {drivers.length === 0 ? <EmptyState icon={Users} title="No drivers" message="Add a driver to assign to loads." /> : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {drivers.map((d) => (
                <div key={d.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between">
                    <div><p className="font-heading text-lg">{d.name}</p><p className="text-xs text-muted-foreground">{d.phone || d.email || '—'}</p></div>
                    <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Pencil className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => remove(d)}><Trash2 className="w-4 h-4" /></Button></div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground capitalize">{d.status?.replace('_', ' ')}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{edit ? 'Edit' : 'Add'} {tab === 'trucks' ? 'truck' : 'driver'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {tab === 'trucks' ? (
              <>
                <div className="col-span-2"><Label>Unit number</Label><Input value={f.unit_number || ''} onChange={(e) => setF({ ...f, unit_number: e.target.value })} /></div>
                <div className="col-span-2"><Label>VIN (optional)</Label><Input value={f.vin || ''} onChange={(e) => setF({ ...f, vin: e.target.value })} /></div>
                <div><Label>Equipment</Label><Select value={f.equipment_type} onValueChange={(v) => setF({ ...f, equipment_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(EQUIPMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>MPG</Label><Input type="number" step="any" value={f.mpg || ''} onChange={(e) => setF({ ...f, mpg: e.target.value })} placeholder="Default" /></div>
                <div className="col-span-2"><Label>Status</Label><Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['available', 'dispatched', 'in_transit', 'out_of_service', 'maintenance'].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent></Select></div>
              </>
            ) : (
              <>
                <div className="col-span-2"><Label>Name</Label><Input value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
                <div className="col-span-2"><Label>Status</Label><Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['available', 'dispatched', 'in_transit', 'off'].map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent></Select></div>
              </>
            )}
            <div className="col-span-2"><Label>Notes</Label><Input value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          </div>
          <Button onClick={save} className="mt-2">Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}