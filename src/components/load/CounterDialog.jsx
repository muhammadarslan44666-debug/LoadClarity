import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { currency } from '@/lib/format';

export default function CounterDialog({ open, onOpenChange, currentRate, suggested, onSave, saving }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(suggested != null ? String(suggested) : currentRate != null ? String(currentRate) : '');
      setNote('');
    }
  }, [open, suggested, currentRate]);

  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Send counter offer</DialogTitle>
          <DialogDescription>Review the rates and enter your counter. This does not book the load.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-muted-foreground">Current broker rate</span>
            <span className="font-medium">{currency(currentRate)}</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
            <span className="text-muted-foreground">Suggested counter</span>
            <span className="font-medium">{currency(suggested)}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="counter-amount">Your counter rate</Label>
            <Input id="counter-amount" type="number" inputMode="decimal" min="0" step="25" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="counter-note">Negotiation note (optional)</Label>
            <Textarea id="counter-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Needs to cover deadhead and fuel" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave({ rate: value, note })} disabled={!valid || saving}>
            {saving ? 'Saving…' : 'Send counter offer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}