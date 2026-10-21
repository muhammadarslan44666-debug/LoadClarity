// Checks the website's API client against the real server, using the same calls the pages make.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-client-'));
const store = new Map();
globalThis.window = {
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  location: { href: '/' },
};

let server, api, ApiError;
const realFetch = globalThis.fetch;

before(async () => {
  const app = (await import('../server/index.js')).default;
  await new Promise((r) => { server = app.listen(0, r); });
  const base = `http://127.0.0.1:${server.address().port}`;
  globalThis.fetch = (url, opts) => realFetch(base + url, opts);
  ({ api, ApiError } = await import('../src/api/client.js'));
});
after(() => { globalThis.fetch = realFetch; server.close(); });

test('full onboarding and dispatcher flow through the client', async () => {
  assert.equal(await api.auth.isAuthenticated(), false);
  await assert.rejects(() => api.auth.login('x@example.com', 'whatever1'), (e) => e instanceof ApiError && e.status === 401);

  const user = await api.auth.register('dispatcher@example.com', 'strong-pass-1');
  assert.equal(await api.auth.isAuthenticated(), true);

  const company = await api.entities.Company.create({ name: 'Demo Logistics LLC' });
  await api.auth.updateMe({ company_id: company.id });
  const me = await api.auth.me();
  assert.equal(me.company_id, company.id);
  assert.equal((await api.entities.Company.get(company.id)).name, 'Demo Logistics LLC');
  assert.equal((await api.entities.Company.filter({ created_by_id: user.id }))[0].id, company.id);

  const carrier = await api.entities.Carrier.create({ company_id: company.id, name: 'Alpha Trucking', dispatch_fee_percent: 8 });
  const broker = await api.entities.Broker.create({ company_id: company.id, name: 'Demo Freight' });
  const truck = await api.entities.Truck.create({ company_id: company.id, unit_number: '101' });
  const driver = await api.entities.Driver.create({ company_id: company.id, name: 'John Carter' });
  assert.ok(carrier.id && broker.id && truck.id && driver.id);

  const load = await api.entities.Load.create({
    company_id: company.id, carrier_id: carrier.id, load_number: '45833', rate: 2450, loaded_miles: 781, status: 'draft',
    pickup_city: 'Dallas', pickup_state: 'TX', delivery_city: 'Atlanta', delivery_state: 'GA',
  });
  await api.entities.TimelineEvent.create({ company_id: company.id, load_id: load.id, type: 'created', source: 'dispatcher' });
  await api.entities.Load.update(load.id, { status: 'booked', driver_id: driver.id });
  const loads = await api.entities.Load.filter({ company_id: company.id, carrier_id: carrier.id }, '-created_date', 50);
  assert.equal(loads.length, 1);
  assert.equal(loads[0].status, 'booked');
  const events = await api.entities.TimelineEvent.filter({ load_id: load.id }, '-created_date', 100);
  assert.equal(events.length, 1);

  await api.entities.Payment.create({ company_id: company.id, load_id: load.id, invoice_date: '2026-10-01', invoice_amount: 2450 });
  assert.equal((await api.entities.Payment.filter({ load_id: load.id })).length, 1);
  await api.entities.Truck.delete(truck.id);
  assert.equal((await api.entities.Truck.filter({ company_id: company.id })).length, 0);
  await api.entities.Company.update(company.id, { plan: 'pro', fuel_price: 4.1 });
  assert.equal((await api.entities.Company.get(company.id)).plan, 'pro');

  api.auth.logout(null);
  assert.equal(await api.auth.isAuthenticated(), false);
  await assert.rejects(() => api.entities.Load.filter({}), (e) => e.status === 401);
});

test('a stopped server gives a clear message', async () => {
  const keep = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('ECONNREFUSED'));
  await assert.rejects(() => api.auth.me(), /Cannot reach the server/);
  globalThis.fetch = keep;
});
