import React, { useEffect, useState } from 'react';
import { api } from '@/api/client';
import { useWorkspace } from '@/lib/useWorkspace';
import PageHeader from '@/components/layout/PageHeader';
import PlanCard from '@/components/pricing/PlanCard';
import PlanComparison from '@/components/pricing/PlanComparison';
import { PLANS, planById } from '@/lib/plans';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Info, ShieldCheck, Sparkles } from 'lucide-react';

const LEMON_SQUEEZY_SCRIPT = 'https://assets.lemonsqueezy.com/lemon.js';

const CHECKOUT_URLS = {
  solo: {
    monthly: 'https://loadclarity.lemonsqueezy.com/checkout/buy/3cd2c370-78bb-4921-987d-de1b96aeb8a7',
    yearly: 'https://loadclarity.lemonsqueezy.com/checkout/buy/2a0ef027-499f-4b2d-8e2e-d262f2298f02',
  },
  pro: {
    monthly: 'https://loadclarity.lemonsqueezy.com/checkout/buy/9334024a-b9df-4b30-a07d-616ba242cf03',
    yearly: 'https://loadclarity.lemonsqueezy.com/checkout/buy/2986ecbb-019e-4aed-a249-c2ec22310766',
  },
  team: {
    monthly: 'https://loadclarity.lemonsqueezy.com/checkout/buy/7a6a5d91-7c9e-407a-bb0f-aab8b7c5e07d',
    yearly: 'https://loadclarity.lemonsqueezy.com/checkout/buy/d723b66c-fbf4-4489-8cf5-de10ad0a4835',
  },
};

const TRUST = [
  'No per-load commission.',
  'No hidden percentage of your freight revenue.',
  'Your saved data remains yours.',
];

export default function Pricing() {
  const { company, carriers, refresh } = useWorkspace();
  const { toast } = useToast();
  const [cycle, setCycle] = useState('monthly');
  const [selected, setSelected] = useState('free');
  const [trucks, setTrucks] = useState(0);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState(null);

  useEffect(() => { if (company?.plan) setSelected(company.plan); }, [company]);

  useEffect(() => {
    const initializeOverlay = () => {
      if (typeof window.createLemonSqueezy === 'function') window.createLemonSqueezy();
    };
    const existingScript = document.querySelector(`script[src="${LEMON_SQUEEZY_SCRIPT}"]`);
    if (existingScript) {
      if (typeof window.createLemonSqueezy === 'function') initializeOverlay();
      else existingScript.addEventListener('load', initializeOverlay, { once: true });
      return () => existingScript.removeEventListener('load', initializeOverlay);
    }
    const script = document.createElement('script');
    script.src = LEMON_SQUEEZY_SCRIPT;
    script.async = true;
    script.onload = initializeOverlay;
    document.head.appendChild(script);
    return () => script.removeEventListener('load', initializeOverlay);
  }, []);

  useEffect(() => {
    if (!company?.id) return;
    api.entities.Truck.filter({ company_id: company.id }, '-created_date', 200)
      .then((t) => setTrucks((t || []).length))
      .catch(() => {});
  }, [company?.id]);

  useEffect(() => {
    if (!company?.id) return undefined;
    let stopped = false;
    const checkSubscription = async () => {
      try {
        const status = await api.billing.status();
        if (!stopped && status?.plan && status.plan !== (company.plan || 'free')) await refresh();
      } catch { /* keep pricing usable if billing status is temporarily unavailable */ }
    };
    const timer = window.setInterval(checkSubscription, 15000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [company?.id, company?.plan, refresh]);

  const applyPlan = async (id) => {
    setBusy(true);
    try {
      // Free is the only plan selectable without checkout; paid plan status is webhook-managed.
      if (id !== 'free') return;
      setSelected('free');
      toast({ title: `${planById('free').name} plan`, description: 'Free plan selected. Paid subscriptions are managed through Lemon Squeezy checkout and verified subscription events.' });
    } finally {
      setBusy(false);
      setWarning(null);
    }
  };

  const checkoutUrlFor = (planId) => {
    const base = CHECKOUT_URLS[planId]?.[cycle];
    if (!base) return undefined;
    const url = new URL(base);
    // Lemon Squeezy forwards checkout custom data to signed webhook events. The webhook also verifies the customer email against the workspace owner.
    if (company?.id) url.searchParams.set('checkout[custom][company_id]', company.id);
    url.searchParams.set('checkout[custom][plan_id]', planId);
    return url.toString();
  };

  const selectPlan = (plan) => {
    if (plan.id === 'free' && company?.plan && company.plan !== 'free') {
      toast({ title: 'Manage your subscription', description: 'Your current paid plan is managed by Lemon Squeezy. Use the subscription management link in your Lemon Squeezy receipt/portal to cancel; the plan changes after a verified webhook event.' });
      return;
    }
    const msgs = [];
    if (carriers.length > plan.limits.carriers) {
      msgs.push(`Your workspace has ${carriers.length} carriers. ${plan.name} supports ${plan.limits.carriers}.`);
    }
    if (trucks > plan.limits.trucks) {
      msgs.push(`Your workspace has ${trucks} trucks. ${plan.name} supports ${plan.limits.trucks}.`);
    }
    if (msgs.length) { setWarning({ plan, msgs }); return; }
    applyPlan(plan.id);
  };

  return (
    <div>
      <PageHeader
        title="Simple Pricing for Small Dispatch Teams"
        subtitle="Start free. Upgrade when LoadClarity saves you enough time and prevents enough costly load mistakes to pay for itself."
      />

      <p className="text-sm text-muted-foreground mb-4 max-w-3xl">
        Built for independent dispatchers and small carriers — without enterprise TMS pricing.
      </p>

      <div className="grid gap-3 mb-5">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Early Bird — first 50 users.</span> Launch pricing is planned for the first 50 subscribers. Paid plans open a secure Lemon Squeezy checkout overlay. Any founding-price eligibility and renewal terms are confirmed during checkout.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-info" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Secure checkout.</span> Selecting a paid plan opens Lemon Squeezy checkout in an overlay. Review the final price, taxes, renewal terms, and payment details before confirming.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="inline-flex rounded-lg border border-border p-1">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              cycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle('yearly')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              cycle === 'yearly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Yearly
          </button>
        </div>
        {cycle === 'yearly' && <span className="text-xs font-medium text-success">Save ~2 months</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-3">
        {PLANS.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            cycle={cycle}
            selected={selected}
            onSelect={selectPlan}
            checkoutUrl={checkoutUrlFor(p.id)}
            busy={busy}
          />
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border p-3 mt-5">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          AI usage limits help us keep pricing affordable. Every plan includes a generous monthly allowance of AI load
          and document analyses, and you can upgrade any time as your volume grows.
        </p>
      </div>

      <h2 className="font-heading text-xl mt-8 mb-3">Compare plans</h2>
      <PlanComparison />

      <div className="mt-8">
        <h2 className="font-heading text-xl mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Straightforward by design
        </h2>
        <ul className="grid sm:grid-cols-3 gap-2">
          {TRUST.map((t) => (
            <li key={t} className="rounded-lg border border-border p-3 text-sm text-muted-foreground">{t}</li>
          ))}
        </ul>
      </div>

      <Dialog open={!!warning} onOpenChange={(o) => { if (!o) setWarning(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm plan change</DialogTitle></DialogHeader>
          {warning && (
            <div className="space-y-3 text-sm">
              <p>Switching to {warning.plan.name} lowers some limits:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                {warning.msgs.map((m) => <li key={m}>{m}</li>)}
              </ul>
              <p className="text-muted-foreground">
                No data will be deleted. Please review which records stay active before continuing.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setWarning(null)}>Cancel</Button>
                <Button disabled={busy} onClick={() => applyPlan(warning.plan.id)}>
                  Select {warning.plan.name}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}