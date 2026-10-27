import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import EmptyState from '@/components/layout/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';

const empty = { name: '', mc_number: '', dot_number: '', contact_name: '', phone: '', email: '', website: '', notes: '' };

export default function Brokers() {
  const { companyId } = useWorkspace();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [f, setF] = useState(empty);

  const load = async () => setItems(await api.entities.Broker.filter({ company_id: companyId }, '-created_date', 200));
  useEffect(() => { if (companyId) load(); }, [companyId]);

  const openNew = () => { setEdit(null); setF(empty); setOpen(true); };
  const openEdit = (b) => { setEdit(b); setF({ ...empty, ...b }); setOpen(true); };

  const save = async () => {
    if (!f.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    if (edit) await api.entities.Broker.update(edit.id, f); else await api.entities.Broker.create({ ...f, company_id: companyId });
    setOpen(false); load(); toast({ title: 'Broker saved' });
  };

  return (
    <div>
      <PageHeader title="Brokers" subtitle="Your internal broker records and notes. Authority/fraud check coming soon." actions={<Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add broker</Button>} />
      {items.length === 0 ? (
        <EmptyState icon={Users} title="No brokers" message="Add brokers or they'll be built automatically from your loads." action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add broker</Button>} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((b) => (
            <div key={b.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between">
                <div><p className="font-heading text-lg">{b.name}</p><p className="text-xs text-muted-foreground">MC {b.mc_number || '—'} · DOT {b.dot_number || '—'}</p></div>
                <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={async () => { await api.entities.Broker.delete(b.id); load(); }}><Trash2 className="w-4 h-4" /></Button></div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{b.contact_name || ''} {b.phone || ''} {b.email || ''}</p>
              {b.notes && <p className="mt-1 text-xs text-muted-foreground">Your notes: {b.notes}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? 'Edit broker' : 'Add broker'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>MC number</Label><Input value={f.mc_number} onChange={(e) => setF({ ...f, mc_number: e.target.value })} /></div>
            <div><Label>DOT number</Label><Input value={f.dot_number} onChange={(e) => setF({ ...f, dot_number: e.target.value })} /></div>
            <div><Label>Contact name</Label><Input value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><Label>Website</Label><Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></div>
            <div className="col-span-2"><Label>Internal notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></div>
          </div>
          <Button onClick={save} className="mt-2">Save</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}