import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDocument, computeBillingReadiness } from '../src/lib/billing.js';

const load = { load_number: 'L-1', broker_reference: 'REF9', broker_name: 'Acme', rate: 2000, weight_lb: 40000 };

test('verifyDocument: pass, mismatch, and review cases', () => {
  const good = verifyDocument(load, { doc_type: 'bol', entered_load_number: ' l-1 ', entered_weight: 40000 });
  assert.equal(good.result, 'pass');
  assert.equal(verifyDocument(load, { doc_type: 'bol', entered_load_number: 'REF9', entered_weight: 40000 }).result, 'pass', 'broker reference also counts');
  const badLoad = verifyDocument(load, { doc_type: 'bol', entered_load_number: 'ZZZ', entered_weight: 40000 });
  assert.equal(badLoad.result, 'mismatch');
  assert.match(badLoad.reasons[0], /Load number conflict/);
  const badWt = verifyDocument(load, { doc_type: 'bol', entered_load_number: 'L-1', entered_weight: 43000 });
  assert.equal(badWt.result, 'mismatch');
  assert.match(badWt.reasons[0], /43,000 lb.*40,000 lb/);
  assert.equal(verifyDocument(load, { doc_type: 'bol' }).result, 'needs_review', 'nothing entered yet');
  assert.equal(verifyDocument({ ...load, weight_lb: null }, { doc_type: 'bol', entered_load_number: 'L-1', entered_weight: 40000 }).result, 'needs_review', 'weight cannot be compared');
  const pod = verifyDocument(load, { doc_type: 'pod', entered_load_number: 'L-1', entered_weight: 40000, signature_confirmed: false });
  assert.equal(pod.result, 'needs_review');
  assert.ok(pod.reasons.some((r) => /Signature/.test(r)));
  assert.equal(verifyDocument(load, { doc_type: 'pod', entered_load_number: 'L-1', entered_weight: 40000, signature_confirmed: true }).result, 'pass');
});

test('computeBillingReadiness lists exactly what is missing', () => {
  const empty = computeBillingReadiness(load, []);
  assert.equal(empty.ready, false);
  assert.deepEqual(empty.missing.slice(0, 3), ['Rate Confirmation is not attached', 'BOL is not attached', 'POD is not attached']);
  const docs = [{ doc_type: 'rate_confirmation' }, { doc_type: 'bol' }, { doc_type: 'pod', approved: false }];
  assert.deepEqual(computeBillingReadiness(load, docs).missing, ['POD has not been verified and approved']);
  const ready = computeBillingReadiness(load, [{ doc_type: 'rate_confirmation' }, { doc_type: 'bol' }, { doc_type: 'pod', approved: true }]);
  assert.deepEqual(ready, { ready: true, missing: [] });
  const crit = computeBillingReadiness(load, [{ doc_type: 'rate_confirmation' }, { doc_type: 'bol' }, { doc_type: 'pod', approved: true }], [{ severity: 'Critical', title: 'Rate missing' }, { severity: 'Info', title: 'x' }]);
  assert.deepEqual(crit.missing, ['Open critical issue: Rate missing']);
  const incomplete = computeBillingReadiness({ rate: 0 }, [{ doc_type: 'rate_confirmation' }, { doc_type: 'bol' }, { doc_type: 'pod', approved: true }]);
  assert.deepEqual(incomplete.missing, ['Load number is missing', 'Broker is missing', 'Broker reference number is missing', 'Rate is missing']);
});
