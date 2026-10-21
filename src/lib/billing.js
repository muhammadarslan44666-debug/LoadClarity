// Document checks and billing readiness. Plain code, no AI: results are explained, never guessed.
export const DOC_TYPES = {
  rate_confirmation: 'Rate Confirmation',
  bol: 'BOL',
  pod: 'POD',
  lumper_receipt: 'Lumper receipt',
  scale_ticket: 'Scale ticket',
  detention_evidence: 'Detention evidence',
  invoice: 'Invoice',
  other: 'Other',
};

const norm = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();
const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== '';

// Compares what the user typed from a BOL/POD with the load. It does not read the file itself.
export function verifyDocument(load, doc) {
  const reasons = [];
  let mismatch = false;

  if (!hasValue(doc.entered_load_number)) {
    reasons.push('Load number on the document has not been entered.');
  } else if (![load.load_number, load.broker_reference].some((x) => hasValue(x) && norm(x) === norm(doc.entered_load_number))) {
    mismatch = true;
    reasons.push(`Load number conflict: document says ${doc.entered_load_number}, load is ${load.load_number || 'not set'}.`);
  }

  if (hasValue(doc.entered_weight) && hasValue(load.weight_lb)) {
    if (Number(doc.entered_weight) !== Number(load.weight_lb)) {
      mismatch = true;
      reasons.push(`Weight conflict: document says ${Number(doc.entered_weight).toLocaleString('en-US')} lb, load says ${Number(load.weight_lb).toLocaleString('en-US')} lb.`);
    }
  } else {
    reasons.push('Weight was not compared (missing on the document or the load).');
  }

  if (doc.doc_type === 'pod' && !doc.signature_confirmed) reasons.push('Signature has not been confirmed.');

  return { result: mismatch ? 'mismatch' : reasons.length ? 'needs_review' : 'pass', reasons };
}

export function computeBillingReadiness(load, docs = [], issues = []) {
  const missing = [];
  for (const t of ['rate_confirmation', 'bol', 'pod']) {
    if (!docs.some((d) => d.doc_type === t)) missing.push(`${DOC_TYPES[t]} is not attached`);
  }
  const pods = docs.filter((d) => d.doc_type === 'pod');
  if (pods.length && !pods.some((d) => d.approved)) missing.push('POD has not been verified and approved');
  if (!hasValue(load.load_number)) missing.push('Load number is missing');
  if (!hasValue(load.broker_name) && !hasValue(load.broker_id)) missing.push('Broker is missing');
  if (!hasValue(load.broker_reference)) missing.push('Broker reference number is missing');
  if (!(Number(load.rate) > 0)) missing.push('Rate is missing');
  for (const i of issues.filter((x) => x.severity === 'Critical')) missing.push(`Open critical issue: ${i.title}`);
  return { ready: missing.length === 0, missing };
}
