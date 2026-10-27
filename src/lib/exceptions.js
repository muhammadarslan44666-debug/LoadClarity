import { api } from '@/api/client';
import { computeIssues } from './risk';
import { computeEconomics, computeDeliveryTiming } from './calculations';

// Sync persisted LoadException records for a load to match currently-detected issues.
// Auto-resolves exceptions whose underlying problem is gone; reopens resolved ones if the problem returns.
export async function syncExceptions(load, settings = {}, carrier = {}) {
  if (!load?.id) return [];
  const calc = computeEconomics(load, settings, carrier);
  const timing = computeDeliveryTiming(load, settings);
  const current = computeIssues(load, calc, settings, timing);
  const currentKeys = new Set(current.map((i) => i.key));

  let existing = [];
  try {
    existing = await api.entities.LoadException.filter({ load_id: load.id });
  } catch (e) {
    console.error('syncExceptions fetch failed', e);
    return current;
  }

  const byKey = new Map(existing.map((e) => [e.key, e]));

  for (const iss of current) {
    const ex = byKey.get(iss.key);
    if (!ex) {
      await api.entities.LoadException.create({
        company_id: load.company_id, load_id: load.id, load_number: load.load_number,
        key: iss.key, severity: iss.severity, category: iss.category, title: iss.title,
        evidence: iss.evidence, action: iss.action, broker_question: iss.broker_question,
        status: 'open', source: 'system',
      });
    } else if (ex.status === 'resolved') {
      await api.entities.LoadException.update(ex.id, {
        status: 'open', evidence: iss.evidence, action: iss.action, broker_question: iss.broker_question,
      });
    } else {
      await api.entities.LoadException.update(ex.id, {
        evidence: iss.evidence, action: iss.action, broker_question: iss.broker_question,
      });
    }
  }

  for (const ex of existing) {
    if (!currentKeys.has(ex.key) && (ex.status === 'open' || ex.status === 'acknowledged' || ex.status === 'reopened')) {
      await api.entities.LoadException.update(ex.id, { status: 'resolved' });
    }
  }

  return current;
}