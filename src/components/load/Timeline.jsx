import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { dateTimeStr } from '@/lib/format';
import { titleCase } from '@/lib/format';

const SOURCE_TONE = { dispatcher: 'info', driver: 'success', system: 'neutral', ai: 'warning' };
import ToneBadge from '@/components/layout/ToneBadge';

export default function Timeline({ events }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    setItems([...(events || [])].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
  }, [events]);
  return (
    <Card>
      <CardHeader><CardTitle className="font-heading text-xl">Timeline</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
        {items.map((ev) => (
          <div key={ev.id} className="flex gap-3">
            <div className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{titleCase(ev.type)}</span>
                <ToneBadge tone={SOURCE_TONE[ev.source] || 'neutral'}>{ev.source}</ToneBadge>
              </div>
              <p className="text-xs text-muted-foreground">{dateTimeStr(ev.created_date)}</p>
              {ev.notes && <p className="text-sm mt-0.5">{ev.notes}</p>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}