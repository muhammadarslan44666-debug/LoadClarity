import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ToneBadge from '@/components/layout/ToneBadge';
import { severityTone } from '@/lib/risk';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export default function RiskPanel({ issues }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Check for problems</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {issues.length === 0 && (
          <p className="text-muted-foreground">No issues detected from the current data. Confirm paperwork and appointments before booking.</p>
        )}
        {issues.map((iss) => (
          <div key={iss.key} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{iss.title}</span>
              </div>
              <ToneBadge tone={severityTone(iss.severity)}>{iss.severity}</ToneBadge>
            </div>
            <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Fact: </span>{iss.evidence}</p>
            <p className="text-xs mt-1"><span className="font-semibold">Action: </span>{iss.action}</p>
            {iss.broker_question && (
              <p className="text-xs mt-1 flex items-start gap-1 text-info">
                <HelpCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span><span className="font-semibold">Ask broker: </span>{iss.broker_question}</span>
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}