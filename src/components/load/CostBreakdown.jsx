import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { currency, miles, pct } from '@/lib/format';

export default function CostBreakdown({ calc }) {
  const rows = [
    { label: 'Revenue', value: currency(calc.rate), strong: true },
    { label: `Diesel (${calc.gallons.toFixed(1)} gal @ ${currency(calc.fuelPrice)}/gal)`, value: currency(calc.fuelCost) },
    { label: `Driver pay (${calc.driverPayMode === 'percent' ? `${calc.driverPayPercent}%` : `${currency(calc.driverPayPerMile)}/mi`})`, value: currency(calc.driverCost) },
    { label: `Maintenance (${currency(calc.maintenancePerMile)}/mi)`, value: currency(calc.maintenanceCost) },
    { label: 'Fixed allocation', value: currency(calc.fixedAllocation) },
    { label: 'Tolls & other', value: currency(calc.tollsOther) },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-xl">Cost breakdown <span className="text-xs font-body font-normal text-muted-foreground">Estimate</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4">
            <span className={r.strong ? 'font-semibold' : 'text-muted-foreground'}>{r.label}</span>
            <span className={r.strong ? 'font-semibold tabular-nums' : 'tabular-nums'}>{r.value}</span>
          </div>
        ))}
        <div className="border-t border-border pt-2 flex justify-between font-semibold">
          <span>Total trip cost</span><span className="tabular-nums">{currency(calc.tripCost)}</span>
        </div>
        <div className="flex justify-between font-semibold text-success">
          <span>Remaining margin</span>
          <span className="tabular-nums">{currency(calc.margin)} <span className="text-xs text-muted-foreground font-normal">({pct(calc.marginPct)})</span></span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-muted-foreground">
          <span>Total miles: {miles(calc.totalMiles)}</span>
          <span>Rev/total mile: {currency(calc.revPerTotalMile)}</span>
          <span>Deadhead: {pct(calc.deadheadPct)}</span>
          <span>Rev/loaded mile: {currency(calc.revPerLoadedMile)}</span>
        </div>
      </CardContent>
    </Card>
  );
}