import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { currency } from '@/lib/format';

export default function DispatcherShare({ share, calc }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Dispatcher share <span className="text-xs font-body font-normal text-muted-foreground">Estimate</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Fee mode</span>
          <span className="font-medium capitalize">{share.feeMode} {share.feeMode === 'percent' && `(${share.feeBase} base)`}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Dispatcher fee</span>
          <span className="tabular-nums text-primary">{currency(share.fee)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Estimated carrier profit</span>
          <span className="tabular-nums">{currency(share.carrierKeeps)}</span>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          Carrier keeps = remaining margin ({currency(calc.margin)}) − fee. Estimates only — check against actual broker payments.
        </p>
      </CardContent>
    </Card>
  );
}