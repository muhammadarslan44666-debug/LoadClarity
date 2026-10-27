import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ToneBadge from '@/components/layout/ToneBadge';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function BillingReadiness({ readiness }) {
  return (
    <Card>
      <CardHeader><CardTitle className="font-heading text-lg">Billing readiness</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {readiness.ready ? (
          <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-success" /> <ToneBadge tone="success">Ready for billing</ToneBadge> All required items are in place.</p>
        ) : (
          <>
            <p className="text-sm"><ToneBadge tone="warning">Not ready</ToneBadge> <span className="ml-1 text-muted-foreground">Still missing:</span></p>
            <ul className="space-y-1">
              {readiness.missing.map((m) => (
                <li key={m} className="flex items-start gap-2 text-sm"><XCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" /> {m}</li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
