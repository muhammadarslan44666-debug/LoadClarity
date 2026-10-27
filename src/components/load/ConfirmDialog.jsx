import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, destructive, onConfirm, saving, withReason, reasonLabel = 'Reason (optional)', reasonPlaceholder }) {
  const [reason, setReason] = useState('');

  useEffect(() => { if (open) setReason(''); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {withReason && (
          <div className="space-y-2">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Textarea id="confirm-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonPlaceholder} />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={() => onConfirm(reason)} disabled={saving}>
            {saving ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}