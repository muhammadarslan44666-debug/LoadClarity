import crypto from 'node:crypto';

export function verifyLemonSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !signature || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(String(signature), 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}
