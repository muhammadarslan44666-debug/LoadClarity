import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import LoadForm from '@/components/load/LoadForm';
import { useToast } from '@/components/ui/use-toast';
import { titleCase } from '@/lib/format';

export default function LoadEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { companyId, carriers } = useWorkspace();
  const [brokers, setBrokers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [initial, setInitial] = useState(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!id;

  useEffect(() => {
    let mounted = true;
    const refreshFleetDrivers = async () => {
      try {
        const d = await api.entities.Driver.filter({ company_id: companyId }, '-created_date', 100);
        if (mounted) setDrivers((d || []).filter((driver) => !['inactive', 'disabled', 'deleted'].includes(String(driver.status || 'available').toLowerCase())));
      } catch { /* Keep the last known driver list if a refresh temporarily fails. */ }
    };
    Promise.all([
      api.entities.Broker.filter({ company_id: companyId }, '-created_date', 100),
      api.entities.Driver.filter({ company_id: companyId }, '-created_date', 100),
      api.entities.Truck.filter({ company_id: companyId }, '-created_date', 100),
    ]).then(([b, d, t]) => {
      if (!mounted) return;
      setBrokers(b || []);
      setDrivers((d || []).filter((driver) => !['inactive', 'disabled', 'deleted'].includes(String(driver.status || 'available').toLowerCase())));
      setTrucks(t || []);
    });
    window.addEventListener('loadclarity:fleet-drivers-changed', refreshFleetDrivers);
    if (isEdit) api.entities.Load.get(id).then((load) => { if (mounted) setInitial(load); });
    return () => { mounted = false; window.removeEventListener('loadclarity:fleet-drivers-changed', refreshFleetDrivers); };
  }, [companyId, id, isEdit]);

  const clean = (f) => {
    const out = { ...f };
    for (const k of ['rate', 'loaded_miles', 'deadhead_miles', 'weight_lb', 'lumper_amount', 'fee_percent', 'fee_flat']) {
      if (out[k] === '' || out[k] === undefined) out[k] = null;
    }
    for (const k of ['fee_mode', 'fee_base', 'fee_percent', 'fee_flat']) {
      if (!out[k]) delete out[k];
    }
    return out;
  };

  const onSave = async (f) => {
    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        const before = initial;
        saved = await api.entities.Load.update(id, clean(f));
        const changes = [];
        for (const k of Object.keys(f)) {
          if (String(before[k] ?? '') !== String(f[k] ?? '')) changes.push(`${titleCase(k)}: ${before[k] ?? '—'} → ${f[k] ?? '—'}`);
        }
        if (changes.length) await api.entities.TimelineEvent.create({ company_id: companyId, load_id: id, type: 'load_edited', source: 'dispatcher', notes: changes.join('\n') });
      } else {
        saved = await api.entities.Load.create({ ...clean(f), company_id: companyId, status: f.status || 'draft' });
        await api.entities.TimelineEvent.create({ company_id: companyId, load_id: saved.id, type: 'load_created', source: 'dispatcher', notes: 'Load created' });
      }
      toast({ title: isEdit ? 'Load updated' : 'Load created' });
      navigate(`/loads/${saved.id}`);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (isEdit && !initial) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit load' : 'New load'} subtitle={isEdit ? initial?.load_number || '' : 'Enter the load details to analyze it.'} />
      <LoadForm
        initial={initial || {}}
        carriers={carriers}
        brokers={brokers}
        drivers={drivers}
        trucks={trucks}
        onSave={onSave}
        onCancel={() => navigate(-1)}
        saving={saving}
        submitLabel={isEdit ? 'Save changes' : 'Save and analyze'}
      />
    </div>
  );
}