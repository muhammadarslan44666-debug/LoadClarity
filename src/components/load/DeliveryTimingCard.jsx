import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import ToneBadge from '@/components/layout/ToneBadge';

const TONE = { danger: 'danger', warning: 'warning', success: 'success', info: 'info', missing: 'info' };

export default function DeliveryTimingCard({ timing }) {
  if (timing.verdict === 'missing') {
    return (
      <Card>
        <CardHeader><CardTitle className="font-heading text-xl">Delivery timing</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <ToneBadge tone="info">Missing info</ToneBadge>
          <p className="mt-2 text-muted-foreground">Missing: {timing.missing.join(', ')}.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-xl">Delivery timing</CardTitle>
          <ToneBadge tone={TONE[timing.tone]}>{timing.label}</ToneBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Driving hours</span><span className="tabular-nums">{timing.drivingHours.toFixed(1)} h</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Breaks / resets</span><span className="tabular-nums">{(timing.shortBreaks + timing.longResets).toFixed(1)} h</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Time needed</span><span className="tabular-nums">{timing.timeNeeded.toFixed(1)} h</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Available</span><span className="tabular-nums">{timing.availableHours.toFixed(1)} h</span></div>
        <div className="flex justify-between font-semibold border-t border-border pt-1.5"><span>Slack</span><span className="tabular-nums">{timing.slack.toFixed(1)} h</span></div>
        <p className="text-xs text-muted-foreground pt-1">Rough planning estimate, compared as entered. Not an hours-of-service ruling — check with the driver.</p>
      </CardContent>
    </Card>
  );
}