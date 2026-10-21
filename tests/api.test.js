import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-test-'));
process.env.DATA_DIR = dir;
process.env.ANTHROPIC_API_KEY = '';

let server, base, appMod, aiMod;
const logs = [];
const realLog = console.log;

before(async () => {
  console.log = (...a) => { logs.push(a.join(' ')); };
  appMod = await import('../server/index.js');
  aiMod = await import('../server/ai.js');
  await new Promise((r) => { server = appMod.default.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { console.log = realLog; server.close(); });

async function call(method, url, body, token) {
  const res = await fetch(base + url, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const A = { email: 'a@example.com', password: 'password-A1' };
const B = { email: 'b@example.com', password: 'password-B1' };
let tokA, tokB, compA, compB;

test('register validates input and rejects duplicates', async () => {
  assert.equal((await call('POST', '/api/auth/register', { email: 'bad', password: 'password-A1' })).status, 400);
  assert.equal((await call('POST', '/api/auth/register', { email: A.email, password: 'short' })).status, 400);
  const r = await call('POST', '/api/auth/register', A);
  assert.equal(r.status, 201);
  assert.ok(r.data.token);
  assert.equal(r.data.user.email, A.email);
  assert.equal(r.data.user.password_hash, undefined);
  tokA = r.data.token;
  assert.equal((await call('POST', '/api/auth/register', A)).status, 409);
  tokB = (await call('POST', '/api/auth/register', B)).data.token;
});

test('passwords are stored hashed, not as plain text', async () => {
  const { state } = await import('../server/db.js');
  const dump = JSON.stringify(state);
  assert.ok(!dump.includes('password-A1'));
  assert.ok(dump.includes('scrypt$'));
});

test('login works, wrong password fails, me needs a token', async () => {
  assert.equal((await call('POST', '/api/auth/login', { email: A.email, password: 'nope-nope' })).status, 401);
  const ok = await call('POST', '/api/auth/login', A);
  assert.equal(ok.status, 200);
  assert.equal((await call('GET', '/api/auth/me')).status, 401);
  assert.equal((await call('GET', '/api/auth/me', undefined, 'garbage.token')).status, 401);
  const me = await call('GET', '/api/auth/me', undefined, tokA);
  assert.equal(me.data.email, A.email);
});

test('company setup and entity defaults', async () => {
  assert.equal((await call('POST', '/api/entities/Load', { load_number: 'X' }, tokA)).status, 400, 'needs a company first');
  const c = await call('POST', '/api/entities/Company', { name: 'Alpha Dispatch' }, tokA);
  assert.equal(c.status, 201);
  assert.equal(c.data.fuel_price, 3.85, 'schema default applied');
  assert.equal(c.data.min_margin_pct, 20);
  compA = c.data.id;
  assert.equal((await call('PATCH', '/api/auth/me', { company_id: compA }, tokA)).data.company_id, compA);
  compB = (await call('POST', '/api/entities/Company', { name: 'Beta Freight' }, tokB)).data.id;
  await call('PATCH', '/api/auth/me', { company_id: compB }, tokB);
  assert.equal((await call('PATCH', '/api/auth/me', { company_id: compA }, tokB)).status, 403, 'cannot join someone else\'s company');
  assert.equal((await call('POST', '/api/entities/Company', {}, tokA)).status, 400, 'name required');
});

test('loads: create, filter, sort, limit, get, update, delete', async () => {
  const mk = (n, rate) => call('POST', '/api/entities/Load', { load_number: n, rate: String(rate), loaded_miles: 500, status: 'draft' }, tokA);
  const l1 = await mk('L1', 1000); await new Promise((r) => setTimeout(r, 5));
  const l2 = await mk('L2', 2000); await new Promise((r) => setTimeout(r, 5));
  const l3 = await mk('L3', 3000);
  assert.equal(l1.status, 201);
  assert.equal(l1.data.rate, 1000, 'numbers are stored as numbers');
  assert.equal(l1.data.company_id, compA);

  const all = await call('GET', `/api/entities/Load?q=${encodeURIComponent(JSON.stringify({ company_id: compA }))}&sort=-created_date`, undefined, tokA);
  assert.deepEqual(all.data.map((x) => x.load_number), ['L3', 'L2', 'L1']);
  const lim = await call('GET', '/api/entities/Load?sort=rate&limit=2', undefined, tokA);
  assert.deepEqual(lim.data.map((x) => x.load_number), ['L1', 'L2']);
  const byNum = await call('GET', `/api/entities/Load?q=${encodeURIComponent(JSON.stringify({ load_number: 'L2' }))}`, undefined, tokA);
  assert.equal(byNum.data.length, 1);

  const up = await call('PATCH', `/api/entities/Load/${l1.data.id}`, { rate: 1500, company_id: 'hacker', created_by_id: 'x' }, tokA);
  assert.equal(up.data.rate, 1500);
  assert.equal(up.data.company_id, compA, 'company_id cannot be changed');
  assert.equal((await call('GET', `/api/entities/Load/${l1.data.id}`, undefined, tokA)).data.rate, 1500);

  assert.equal((await call('POST', '/api/entities/Load', { rate: 'abc' }, tokA)).status, 400, 'non-numeric rate rejected');
  assert.equal((await call('POST', '/api/entities/Load', { equipment_type: 'spaceship' }, tokA)).status, 400, 'bad enum rejected');

  assert.equal((await call('DELETE', `/api/entities/Load/${l3.data.id}`, undefined, tokA)).status, 200);
  assert.equal((await call('GET', `/api/entities/Load/${l3.data.id}`, undefined, tokA)).status, 404);
});

test('tenant isolation: company B never sees or touches company A data', async () => {
  const loadA = (await call('GET', '/api/entities/Load', undefined, tokA)).data[0];
  assert.deepEqual((await call('GET', '/api/entities/Load', undefined, tokB)).data, []);
  assert.deepEqual((await call('GET', `/api/entities/Load?q=${encodeURIComponent(JSON.stringify({ company_id: compA }))}`, undefined, tokB)).data, []);
  assert.equal((await call('GET', `/api/entities/Load/${loadA.id}`, undefined, tokB)).status, 404);
  assert.equal((await call('PATCH', `/api/entities/Load/${loadA.id}`, { rate: 1 }, tokB)).status, 404);
  assert.equal((await call('DELETE', `/api/entities/Load/${loadA.id}`, undefined, tokB)).status, 404);
  assert.equal((await call('GET', `/api/entities/Company/${compA}`, undefined, tokB)).status, 404);
  // B tries to create a record claiming A's company: server forces B's own company
  const sneaky = await call('POST', '/api/entities/Load', { load_number: 'SNEAK', company_id: compA }, tokB);
  assert.equal(sneaky.data.company_id, compB);
  assert.equal((await call('GET', '/api/entities/Load', undefined, tokA)).data.some((x) => x.load_number === 'SNEAK'), false);
  assert.equal((await call('GET', '/api/entities/Load')).status, 401, 'signed-out requests are refused');
  assert.equal((await call('GET', '/api/entities/Nope', undefined, tokA)).status, 404);
});

test('password reset flow (link is printed in the server window)', async () => {
  logs.length = 0;
  assert.equal((await call('POST', '/api/auth/reset-request', { email: 'nobody@example.com' })).data.ok, true);
  assert.equal(logs.some((l) => l.includes('nobody@example.com')), false);
  await call('POST', '/api/auth/reset-request', { email: A.email });
  const line = logs.find((l) => l.includes('reset-password?token='));
  assert.ok(line, 'reset link printed');
  const token = line.match(/token=([a-f0-9]+)/)[1];
  assert.equal((await call('POST', '/api/auth/reset', { resetToken: 'wrong', newPassword: 'new-password-1' })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset', { resetToken: token, newPassword: 'short' })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset', { resetToken: token, newPassword: 'new-password-1' })).status, 200);
  assert.equal((await call('POST', '/api/auth/reset', { resetToken: token, newPassword: 'another-pass-2' })).status, 400, 'link works once');
  assert.equal((await call('POST', '/api/auth/login', A)).status, 401, 'old password stops working');
  assert.equal((await call('POST', '/api/auth/login', { email: A.email, password: 'new-password-1' })).status, 200);
});

test('AI offer reading: off without a key, cleaned output when on', async () => {
  const off = await call('POST', '/api/ai/extract-offer', { text: 'Dallas to Atlanta $2450' }, tokA);
  assert.equal(off.status, 501);
  assert.match(off.data.error, /ANTHROPIC_API_KEY/);
  assert.equal((await call('POST', '/api/ai/extract-offer', { text: '' }, tokA)).status, 400);
  assert.equal((await call('POST', '/api/ai/extract-offer', { text: 'x' })).status, 401);
  const c = aiMod.cleanExtraction({ rate: '$2,450', loaded_miles: '781 mi', pickup_date: 'tomorrow', delivery_date: '2026-10-06', broker_name: '  Acme  ', weight_lb: null, evil: 'x' });
  assert.deepEqual(c, { rate: 2450, loaded_miles: 781, delivery_date: '2026-10-06', broker_name: 'Acme' });
});

test('login attempts are limited', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await call('POST', '/api/auth/login', { email: 'brute@example.com', password: 'wrong-wrong' });
  assert.equal(last.status, 429);
});
