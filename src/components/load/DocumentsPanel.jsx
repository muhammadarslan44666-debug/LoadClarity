import React, { useRef, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { api } from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import ToneBadge from '@/components/layout/ToneBadge';
import { DOC_TYPES, verifyDocument } from '@/lib/billing';
import { FileText, Upload, Trash2, ExternalLink } from 'lucide-react';

const RESULT = {
  pass: { tone: 'success', label: 'Pass' },
  needs_review: { tone: 'warning', label: 'Needs review' },
  mismatch: { tone: 'danger', label: 'Mismatch' },
};
const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function DocumentsPanel({ load, docs, onChange }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [type, setType] = useState('bol');
  const [busy, setBusy] = useState(false);

  const fail = (e, title = 'Something went wrong') => toast({ title, description: e.message, variant: 'destructive' });

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { toast({ title: 'Choose a file first', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const rec = await api.documents.upload(file, { load_id: load.id, doc_type: type });
      if (fileRef.current) fileRef.current.value = '';
      await onChange([rec, ...docs], { type: `${type}_uploaded`, notes: `${DOC_TYPES[type]} uploaded: ${rec.file_name}` });
      toast({ title: `${DOC_TYPES[type]} uploaded` });
    } catch (e) { fail(e, 'Upload failed'); } finally { setBusy(false); }
  };

  const remove = async (d) => {
    if (!window.confirm(`Remove ${d.file_name}?`)) return;
    try {
      await api.documents.remove(d.id);
      await onChange(docs.filter((x) => x.id !== d.id), { type: `${d.doc_type}_removed`, notes: `${DOC_TYPES[d.doc_type]} removed: ${d.file_name}` });
    } catch (e) { fail(e, 'Could not remove'); }
  };

  const patch = async (d, data, event) => {
    try {
      const updated = await api.entities.Document.update(d.id, data);
      await onChange(docs.map((x) => (x.id === d.id ? updated : x)), event);
    } catch (e) { fail(e, 'Could not save'); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><FileText className="w-4 h-4" /> Documents</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-44" aria-label="Document type"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label htmlFor="doc-file">File (PDF, JPG or PNG, up to 15 MB)</Label>
            <Input id="doc-file" ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
          </div>
          <Button onClick={upload} disabled={busy}><Upload className="w-4 h-4 mr-1" /> {busy ? 'Uploading…' : 'Attach'}</Button>
        </div>

        {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents attached yet.</p>}

        {docs.map((d) => {
          const isCheck = d.doc_type === 'bol' || d.doc_type === 'pod';
          const v = isCheck ? verifyDocument(load, d) : null;
          return (
            <div key={d.id} className="rounded-lg border p-3 space-y-2" data-testid="doc-row">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate"><ToneBadge tone="info" className="mr-2">{DOC_TYPES[d.doc_type]}</ToneBadge>{d.file_name}</p>
                  <p className="text-xs text-muted-foreground">{kb(d.size)} · {new Date(d.created_date).toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => api.documents.open(d.id).catch((e) => fail(e, 'Could not open'))}><ExternalLink className="w-3.5 h-3.5 mr-1" /> View</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(d)} aria-label={`Remove ${d.file_name}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {isCheck && (
                <div className="space-y-2">
                  <div className="grid sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`ln-${d.id}`} className="text-xs">Load # on document</Label>
                      <Input id={`ln-${d.id}`} defaultValue={d.entered_load_number || ''} onBlur={(e) => e.target.value !== (d.entered_load_number || '') && patch(d, { entered_load_number: e.target.value.trim() })} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`wt-${d.id}`} className="text-xs">Weight on document (lb)</Label>
                      <Input id={`wt-${d.id}`} type="number" min="0" defaultValue={d.entered_weight ?? ''} onBlur={(e) => String(e.target.value) !== String(d.entered_weight ?? '') && patch(d, { entered_weight: e.target.value === '' ? null : Number(e.target.value) })} />
                    </div>
                    {d.doc_type === 'pod' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Signature</Label>
                        <Select value={d.signature_confirmed ? 'yes' : 'no'} onValueChange={(x) => patch(d, { signature_confirmed: x === 'yes' })}>
                          <SelectTrigger className="h-9" aria-label="Signature"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="no">Not confirmed</SelectItem><SelectItem value="yes">Signed</SelectItem></SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge tone={d.approved ? 'success' : RESULT[v.result].tone}>{d.approved ? 'Approved' : RESULT[v.result].label}</ToneBadge>
                    <Button size="sm" variant={d.approved ? 'outline' : 'default'} onClick={() => patch(d, { approved: !d.approved }, { type: d.approved ? `${d.doc_type}_unapproved` : `${d.doc_type}_verified`, notes: `${DOC_TYPES[d.doc_type]} ${d.approved ? 'approval removed' : 'approved'}${!d.approved && v.result === 'mismatch' ? ' despite a mismatch' : ''}` })}>
                      {d.approved ? 'Remove approval' : v.result === 'mismatch' ? 'Approve anyway' : 'Approve'}
                    </Button>
                  </div>
                  {v.reasons.length > 0 && <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-0.5">{v.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                </div>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">Checks compare the values you type from the document with this load. They do not read the file. You make the final call.</p>
      </CardContent>
    </Card>
  );
}
