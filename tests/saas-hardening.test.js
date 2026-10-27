import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyLemonSignature } from '../server/lemonSignature.js';

test('Lemon Squeezy webhook signature verifies exact raw request bytes', () => {
  const secret = 'test-webhook-secret';
  const body = Buffer.from(JSON.stringify({ meta: { event_name: 'subscription_created' }, data: { id: '123' } }));
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyLemonSignature(body, signature, secret), true);
  assert.equal(verifyLemonSignature(Buffer.from(`${body.toString()} `), signature, secret), false);
  assert.equal(verifyLemonSignature(body, 'bad-signature', secret), false);
  assert.equal(verifyLemonSignature(body, signature, ''), false);
});
