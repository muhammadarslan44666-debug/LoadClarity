import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlanCard({ plan, cycle, selected, onSelect, checkoutUrl, busy }) {
  const price = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const suffix = cycle === 'yearly' ? '/year' : '/month';
  const isFree = plan.priceMonthly === 0;
  const isSelected = selected === plan.id;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl border bg-card p-5',
        plan.popular ? 'border-primary ring-1 ring-primary' : 'border-border'
      )}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
          <Sparkles className="w-3 h-3" /> Most Popular
        </span>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-xl">{plan.name}</h3>
        {isSelected && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-foreground/90">
            Current Selection
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground min-h-[2rem]">{plan.tagline}</p>

      <div className="mt-3 flex items-end gap-1">
        <span className="font-heading text-4xl leading-none">${price}</span>
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
      {!isFree && <p className="mt-1 text-xs text-muted-foreground">Founding / Launch Price</p>}
      {!isFree && cycle === 'yearly' && <p className="text-xs font-medium text-success">Save ~2 months</p>}

      <div className="mt-4 flex-1 space-y-2">
        {plan.inherits && <p className="text-xs font-medium text-muted-foreground">{plan.inherits}, plus:</p>}
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <span>{f}</span>
          </div>
        ))}
      </div>

      {isFree ? (
        <Button
          className="mt-5"
          variant={plan.popular ? 'default' : 'outline'}
          disabled={busy || isSelected}
          onClick={() => onSelect(plan)}
        >
          {isSelected ? 'Current Selection' : plan.cta}
        </Button>
      ) : (
        <Button
          asChild
          className="lemonsqueezy-button mt-5"
          variant={plan.popular ? 'default' : 'outline'}
        >
          <a href={checkoutUrl}>
            {plan.cta}
          </a>
        </Button>
      )}
    </div>
  );
}