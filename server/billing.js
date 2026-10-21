import express from 'express';
import { requireAuth } from './auth.js';
import { state, save, nowIso, table } from './db.js';
import { verifyLemonSignature } from './lemonSignature.js';

const PAID_PLANS = new Set(['solo', 'pro', 'team']);
const FREE_UPLOAD_LIMIT = 5;
const PLAN_VARIANTS = new Map([
  [process.env.LEMON_VARIANT_SOLO_MONTHLY, 'solo'],
  [process.env.LEMON_VARIANT_SOLO_YEARLY, 'solo'],
  [process.env.LEMON_VARIANT_PRO_MONTHLY, 'pro'],
  [process.env.LEMON_VARIANT_PRO_YEARLY, 'pro'],
  [process.env.LEMON_VARIANT_TEAM_MONTHLY, 'team'],
  [process.env.LEMON_VARIANT_TEAM_YEARLY, 'team'],
].filter(([id]) => id));

function ownerCompany(companyId, email) {
  if (!companyId || !email) return null;
  const company = table('Company')[String(companyId)];
  if (!company) return null;
  const user = state.users.find((u) => u.id === company.created_by_id);
  return user && user.email.toLowerCase() === String(email).toLowerCase() ? company : null;
}

export const billingRouter = express.Router();
billingRouter.use(requireAuth);

billingRouter.get('/status', (req, res) => {
  const company = req.user.company_id ? table('Company')[req.user.company_id] : null;
  if (!company) return res.json({ plan: 'free', subscription_status: 'inactive', ratecon_upload_count: 0, free_upload_limit: FREE_UPLOAD_LIMIT });
  res.json({
    plan: company.plan || 'free',
    subscription_status: company.subscription_status || 'inactive',
    subscription_renews_at: company.subscription_renews_at || null,
    subscription_ends_at: company.subscription_ends_at || null,
    ratecon_upload_count: Number(company.ratecon_upload_count || 0),
    free_upload_limit: FREE_UPLOAD_LIMIT,
  });
});

billingRouter.post('/ratecon-usage/reserve', (req, res) => {
  const company = req.user.company_id ? table('Company')[req.user.company_id] : null;
  if (!company) return res.status(400).json({ error: 'Finish setting up your company first.' });
  const plan = company.plan || 'free';
  if (plan !== 'free') return res.json({ allowed: true, plan, remaining: null, counted: false });
  const used = Number(company.ratecon_upload_count || 0);
  if (used >= FREE_UPLOAD_LIMIT) return res.status(402).json({ error: 'Your five free Rate Confirmation uploads have been used. Upgrade to continue.', allowed: false, remaining: 0 });
  company.ratecon_upload_count = used + 1;
  company.updated_date = nowIso();
  save();
  res.json({ allowed: true, plan: 'free', remaining: Math.max(0, FREE_UPLOAD_LIMIT - company.ratecon_upload_count), counted: true });
});

billingRouter.post('/ratecon-usage/release', (req, res) => {
  const company = req.user.company_id ? table('Company')[req.user.company_id] : null;
  if (!company) return res.status(400).json({ error: 'Finish setting up your company first.' });
  if ((company.plan || 'free') === 'free') company.ratecon_upload_count = Math.max(0, Number(company.ratecon_upload_count || 0) - 1);
  company.updated_date = nowIso();
  save();
  res.json({ ok: true, ratecon_upload_count: Number(company.ratecon_upload_count || 0) });
});

// Mount this before express.json() so the exact signed request bytes are preserved.
export function lemonWebhookHandler(req, res) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || '';
  if (!secret) return res.status(503).json({ error: 'Billing webhook is not configured.' });
  if (!verifyLemonSignature(req.body, req.get('X-Signature'), secret)) return res.status(401).json({ error: 'Invalid webhook signature.' });
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ error: 'Invalid webhook payload.' }); }

  const eventName = String(event?.meta?.event_name || '');
  const data = event?.data || {};
  const attrs = data.attributes || {};
  const custom = event?.meta?.custom_data || attrs?.custom_data || {};
  const companyId = String(custom.company_id || '');
  const customerEmail = String(attrs.user_email || attrs.customer_email || '');
  let company = ownerCompany(companyId, customerEmail);
  if (!company && data.id && customerEmail) {
    company = Object.values(table('Company')).find((candidate) => {
      if (String(candidate.subscription_id || '') !== String(data.id)) return false;
      const owner = state.users.find((u) => u.id === candidate.created_by_id);
      return owner && owner.email.toLowerCase() === customerEmail.toLowerCase();
    }) || null;
  }
  if (!company) {
    // Do not activate a plan when the checkout cannot be tied to the workspace owner.
    console.warn(`[billing] Ignored ${eventName || 'unknown'} event: no verified workspace/customer match.`);
    return res.status(202).json({ received: true, applied: false });
  }

  const variantId = String(attrs.variant_id || company.subscription_variant_id || '');
  const variantPlan = PLAN_VARIANTS.get(variantId);
  const status = String(attrs.status || '').toLowerCase();
  const subscriptionEvents = new Set(['subscription_created', 'subscription_updated', 'subscription_resumed', 'subscription_unpaused', 'subscription_cancelled', 'subscription_expired', 'subscription_paused', 'subscription_payment_success', 'subscription_payment_recovered', 'subscription_payment_failed']);
  if (!subscriptionEvents.has(eventName)) return res.json({ received: true, applied: false, ignored: 'event_not_subscription_related' });

  company.subscription_id = String(data.id || company.subscription_id || '');
  company.subscription_customer_id = String(attrs.customer_id || company.subscription_customer_id || '');
  company.subscription_variant_id = variantId || company.subscription_variant_id || '';
  company.subscription_status = eventName === 'subscription_cancelled' ? 'cancelled' : (status || eventName.replace('subscription_', ''));
  company.subscription_renews_at = attrs.renews_at || null;
  company.subscription_ends_at = attrs.ends_at || null;
  company.subscription_updated_at = nowIso();

  const active = ['active', 'on_trial', 'past_due'].includes(status) && !attrs.cancelled;
  if (eventName === 'subscription_expired' || eventName === 'subscription_paused' || ['expired', 'paused', 'unpaid'].includes(status)) {
    company.plan = 'free';
  } else if (eventName === 'subscription_cancelled' || status === 'cancelled') {
    // Cancellation commonly ends renewal but keeps access until the paid-through date.
    const paidThrough = attrs.ends_at ? new Date(attrs.ends_at).getTime() : 0;
    if (!paidThrough || paidThrough <= Date.now()) company.plan = 'free';
  } else if (active && variantPlan && PAID_PLANS.has(variantPlan)) {
    company.plan = variantPlan;
  } else if (eventName === 'subscription_payment_failed') {
    // Keep current plan during payment recovery; record status for UI/admin review.
    company.subscription_status = 'past_due';
  }
  company.updated_date = nowIso();
  save();
  return res.json({ received: true, applied: true, plan: company.plan || 'free' });
}

export { FREE_UPLOAD_LIMIT };
