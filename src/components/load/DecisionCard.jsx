import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import CounterDialog from './CounterDialog';
import ConfirmDialog from './ConfirmDialog';
import { currency } from '@/lib/format';

const HERO = {
  danger: 'bg-destructive/10 border-destructive/30 text-destructive',
  warning: 'bg-warning/15 border-warning/40 text-warning-foreground',
  success: 'bg-success/10 border-success/30 text-success',
  info: 'bg-info/10 border-info/30 text-info',
};

const BANNER_STYLE = {
  warning: 'bg-warning text-warning-foreground border-warning',
  danger: 'bg-destructive text-destructive-foreground border-destructive',
};

const BANNER = {
  take_after_confirming: { text: 'CONDITIONAL — CONFIRM FIRST', tone: 'warning', hint: 'Confirm the open items in writing before booking.' },
  negotiate: { text: 'NEGOTIATE BEFORE BOOKING', tone: 'warning', hint: 'Get the rate up before you book this load.' },
  pass_at_this_rate: { text: 'PASS / HIGH RISK', tone: 'danger', hint: 'The numbers do not work — passing is recommended.' },
};

export default function DecisionCard({ decision, load, onTake, onPass, onCounter }) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const banner = BANNER[decision.verdict];

  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); setConfirm(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Suggested decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className={`rounded-lg border p-4 ${HERO[decision.tone] || HERO.info}`}>
          <p className="text-xs uppercase tracking-wide opacity-80">Current recommendation</p>
          <p className="font-heading text-3xl leading-tight mt-0.5">{decision.label}</p>
        </div>

        {banner && (
          <div className={`rounded-md border px-3 py-2 text-center ${BANNER_STYLE[banner.tone]}`}>
            <p className="font-heading text-lg tracking-wide">{banner.text}</p>
            <p className="text-xs opacity-90">{banner.hint}</p>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Why</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {decision.why.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>

        {decision.counter != null && (
          <div className="rounded-lg bg-muted p-3">
            <span className="text-xs text-muted-foreground">Suggested counter rate</span>
            <p className="font-heading text-2xl">{currency(decision.counter)}</p>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Options</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            {decision.options.map((o, i) => <li key={i}>{o}</li>)}
          </ol>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <Button onClick={() => setConfirm('take')} disabled={busy}>TAKE LOAD</Button>
          <Button variant="outline" onClick={() => setCounterOpen(true)} disabled={busy}>COUNTER</Button>
          <Button
            variant="outline"
            onClick={() => setConfirm('pass')}
            disabled={busy}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            PASS LOAD
          </Button>
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-2">
          You make the final call. This is not a guarantee of profit or payment.
        </p>
      </CardContent>

      <CounterDialog
        open={counterOpen}
        onOpenChange={setCounterOpen}
        currentRate={load?.rate}
        suggested={decision.counter}
        saving={busy}
        onSave={({ rate, note }) => run(async () => { await onCounter({ rate, note }); setCounterOpen(false); })}
      />

      <ConfirmDialog
        open={confirm === 'take'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Take this load?"
        description="This sets the load status to Booked and records “Load Accepted” in the timeline. No driver is assigned."
        confirmLabel="Yes, take load"
        saving={busy}
        onConfirm={() => run(onTake)}
      />

      <ConfirmDialog
        open={confirm === 'pass'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Pass this load?"
        description="This marks the load as Cancelled and records “Load Passed” in the timeline. The load is not deleted."
        confirmLabel="Yes, pass load"
        destructive
        withReason
        reasonLabel="Reason (optional)"
        reasonPlaceholder="e.g. Rate too low for the miles"
        saving={busy}
        onConfirm={(reason) => run(() => onPass(reason))}
      />
    </Card>
  );
}