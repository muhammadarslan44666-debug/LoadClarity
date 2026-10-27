import React, { useRef, useState } from 'react';
import { FileUp, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { readRateConfirmation } from '@/lib/load/rateConfirmationParser';
import { Link } from 'react-router-dom';
import { useWorkspace } from '@/lib/useWorkspace';

export default function RateConfirmationImporter({ onParsed }) {
  const { company, refresh } = useWorkspace();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const freeUsed = Number(company?.ratecon_upload_count || 0);
  const quotaBlocked = (company?.plan || 'free') === 'free' && freeUsed >= 5;
  const process = async (file) => {
    if (!file) return;
    if (quotaBlocked) { setStatus({ type: 'error', message: 'Your 5 free Rate Confirmation uploads have been used. Upgrade to continue.' }); return; }
    setBusy(true); setStatus(null);
    let reservation = null;
    try {
      // The server enforces the lifetime Free quota; client-side counters are display-only.
      reservation = await api.billing.reserveRateConUpload();
      const result = await readRateConfirmation(file, (message) => setStatus({ type: 'working', message }));
      onParsed(result.fields);
      if (reservation.plan === 'free') await refresh();
      const remainingText = reservation.plan === 'free' ? ` ${reservation.remaining} free upload(s) remain.` : '';
      setStatus({ type: 'success', message: `Extracted ${Object.keys(result.fields).length} field(s). Please review the auto-filled values before saving.${remainingText}` });
    } catch (error) {
      if (reservation?.counted) { try { await api.billing.releaseRateConUpload(); await refresh(); } catch { /* keep the original extraction error visible */ } }
      setStatus({ type: 'error', message: error.message || 'Unable to read this document.' });
    }
    finally { setBusy(false); }
  };
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4 text-primary" /> Import Rate Confirmation</CardTitle></CardHeader>
      <CardContent>
        <div role="button" tabIndex={0} onClick={() => !busy && inputRef.current?.click()} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !busy) inputRef.current?.click(); }} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); process(e.dataTransfer.files?.[0]); }} className={`cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'} ${busy ? 'opacity-70' : ''}`}>
          {busy ? <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" /> : <FileUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />}
          <p className="text-sm font-medium">Drop broker Rate Confirmation here</p>
          <p className="mt-1 text-xs text-muted-foreground">or browse PDF, JPG, PNG, WEBP</p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">{(company?.plan || 'free') === 'free' ? `${Math.max(0, 5 - freeUsed)} of 5 free uploads remaining` : 'Unlimited RateCon uploads on your paid plan'}</p>
          <input ref={inputRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { process(e.target.files?.[0]); e.target.value = ''; }} disabled={busy || quotaBlocked} />
          <Button type="button" variant="outline" size="sm" className="mt-3" disabled={busy || quotaBlocked} onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>Choose document</Button>
        </div>
        {status && <div className={`mt-3 flex items-start gap-2 text-xs ${status.type === 'error' ? 'text-destructive' : status.type === 'success' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
          {status.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : status.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
          <span>{status.message}</span>
        </div>}
        {quotaBlocked && <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><p className="font-medium">Free upload limit reached</p><p className="mt-1 text-xs text-muted-foreground">Upgrade to Starter ($29/month) or Pro Dispatcher ($79/month) to continue parsing.</p><Link className="mt-2 inline-flex text-sm font-semibold text-primary hover:underline" to="/pricing">View plans →</Link></div>}
        <p className="mt-3 text-xs text-muted-foreground">Runs in your browser. Extraction can vary by document layout; verify every field before saving.</p>
      </CardContent>
    </Card>
  );
}
