// Generic, tenant-isolated data API. Each record belongs to one company; users only ever see their own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { requireAuth } from './auth.js';
import { save, newId, nowIso, table } from './db.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schemas');
const schemas = {};
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith('.json')) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    schemas[s.name] = s;
  }
}

const PROTECTED = ['id', 'company_id', 'created_by_id', 'created_date', 'updated_date'];
const COMPANY_SERVER_ONLY = new Set(['plan', 'ratecon_upload_count', 'subscription_id', 'subscription_customer_id', 'subscription_variant_id', 'subscription_status', 'subscription_renews_at', 'subscription_ends_at', 'subscription_updated_at', 'early_bird_claimed']);
const isPlain = (v) => v === null || ['string', 'number', 'boolean'].includes(typeof v);

function normalize(schema, data, { creating }) {
  const out = {};
  const props = schema.properties || {};
  for (const [k, v] of Object.entries(data || {})) {
    if (PROTECTED.includes(k)) continue;
    if (schema.name === 'Company' && COMPANY_SERVER_ONLY.has(k)) continue;
    const t = props[k]?.type;
    if (!props[k]) { // Preserve small scalar extension fields used by existing UI modules.
      if (isPlain(v) && String(v ?? '').length <= 5000) out[k] = v;
      continue;
    }
    if (v === null || v === undefined) { out[k] = null; continue; }
    if (t === 'number') {
      if (v === '') { out[k] = null; continue; }
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error(`${k} must be a number.`);
      out[k] = n;
    } else if (t === 'string') {
      const s = typeof v === 'string' ? v : String(v);
      if (s.length > 5000) throw new Error(`${k} is too long.`);
      if (props[k].enum && s !== '' && !props[k].enum.includes(s)) throw new Error(`${k} has an invalid value.`);
      out[k] = s;
    } else if (t === 'boolean') {
      out[k] = Boolean(v);
    } else {
      const j = JSON.stringify(v);
      if (j && j.length > 20000) throw new Error(`${k} is too large.`);
      out[k] = v; // objects/arrays
    }
  }
  if (creating) {
    for (const [k, p] of Object.entries(props)) if (out[k] === undefined && p.default !== undefined) out[k] = p.default;
    for (const k of schema.required || []) {
      if (k === 'company_id') continue; // set by the server
      if (out[k] === undefined || out[k] === null || out[k] === '') throw new Error(`${k} is required.`);
    }
  }
  return out;
}

const visible = (name, user, rec) =>
  name === 'Company' ? rec.created_by_id === user.id || rec.id === user.company_id : !!user.company_id && rec.company_id === user.company_id;

function cmp(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  return a < b ? -1 : 1;
}

export const entitiesRouter = express.Router();
entitiesRouter.use(requireAuth);

entitiesRouter.param('name', (req, res, next, name) => {
  if (!schemas[name]) return res.status(404).json({ error: 'Unknown data type.' });
  req.schema = schemas[name];
  next();
});

entitiesRouter.get('/:name', (req, res) => {
  const { name } = req.params;
  let q = {};
  if (req.query.q) {
    try { q = JSON.parse(String(req.query.q)); } catch { return res.status(400).json({ error: 'Bad filter.' }); }
    if (!q || typeof q !== 'object' || Array.isArray(q) || !Object.values(q).every(isPlain)) return res.status(400).json({ error: 'Bad filter.' });
  }
  let rows = Object.values(table(name)).filter((r) => visible(name, req.user, r) && Object.entries(q).every(([k, v]) => r[k] === v));
  const sort = String(req.query.sort || '');
  if (sort) {
    const desc = sort.startsWith('-');
    const f = desc ? sort.slice(1) : sort;
    rows.sort((a, b) => (desc ? -1 : 1) * cmp(a[f], b[f]));
  }
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5000, 1), 5000);
  res.json(rows.slice(0, limit));
});

entitiesRouter.get('/:name/:id', (req, res) => {
  const rec = table(req.params.name)[req.params.id];
  if (!rec || !visible(req.params.name, req.user, rec)) return res.status(404).json({ error: 'Not found.' });
  res.json(rec);
});

entitiesRouter.post('/:name', (req, res) => {
  const { name } = req.params;
  if (name === 'Document') return res.status(405).json({ error: 'Use the upload feature to add documents.' });
  if (name !== 'Company' && !req.user.company_id) return res.status(400).json({ error: 'Finish setting up your company first.' });
  const limitError = enforceCreatePlanLimit(name, req.user);
  if (limitError) return res.status(402).json({ error: limitError, code: 'PLAN_LIMIT_REACHED' });
  let data;
  try { data = normalize(req.schema, req.body, { creating: true }); } catch (e) { return res.status(400).json({ error: e.message }); }
  const assignmentError = validateLoadAssignments(name, data, req.user.company_id);
  if (assignmentError) return res.status(400).json({ error: assignmentError });
  const t = nowIso();
  const rec = { ...data, id: newId(), created_by_id: req.user.id, created_date: t, updated_date: t };
  if (name === 'Company') { rec.plan = 'free'; rec.ratecon_upload_count = 0; rec.early_bird_claimed = false; }
  if (name !== 'Company') rec.company_id = req.user.company_id;
  table(name)[rec.id] = rec;
  save();
  res.status(201).json(rec);
});

const PLAN_LIMITS = {
  free: { Carrier: 1, Truck: 1 },
  solo: { Carrier: 1, Truck: 3 },
  pro: { Carrier: 5, Truck: 15 },
  team: { Carrier: 5, Truck: 25 },
};

function enforceCreatePlanLimit(name, user) {
  if (!['Carrier', 'Truck'].includes(name)) return null;
  const company = user.company_id ? table('Company')[user.company_id] : null;
  const plan = company?.plan || 'free';
  const max = PLAN_LIMITS[plan]?.[name];
  if (max === undefined) return null;
  const count = Object.values(table(name)).filter((r) => r.company_id === user.company_id).length;
  return count >= max ? `${plan} plan allows up to ${max} ${name.toLowerCase()} record(s). Upgrade your plan to add more.` : null;
}

function validateLoadAssignments(name, data, companyId) {
  if (name !== 'Load') return null;
  for (const [field, entityName, label] of [['driver_id', 'Driver', 'Driver'], ['truck_id', 'Truck', 'Truck']]) {
    if (!(field in data) || !data[field]) continue;
    const item = table(entityName)[String(data[field])];
    if (!item || item.company_id !== companyId) return `${label} must belong to this workspace.`;
    if (field === 'driver_id' && item.status === 'off') return 'An off-duty driver cannot be assigned to a new load.';
  }
  return null;
}

function update(req, res) {
  const { name, id } = req.params;
  const rec = table(name)[id];
  if (!rec || !visible(name, req.user, rec)) return res.status(404).json({ error: 'Not found.' });
  let body = req.body;
  if (name === 'Document') { // file details can only be set by the upload route
    body = { ...body };
    for (const k of ['storage_key', 'file_name', 'mime_type', 'size', 'load_id']) delete body[k];
  }
  let data;
  try { data = normalize(req.schema, body, { creating: false }); } catch (e) { return res.status(400).json({ error: e.message }); }
  const assignmentError = validateLoadAssignments(name, data, req.user.company_id);
  if (assignmentError) return res.status(400).json({ error: assignmentError });
  for (const k of req.schema.required || []) {
    if (k in data && (data[k] === null || data[k] === '')) return res.status(400).json({ error: `${k} is required.` });
  }
  Object.assign(rec, data, { updated_date: nowIso() });
  save();
  res.json(rec);
}
entitiesRouter.patch('/:name/:id', update);
entitiesRouter.put('/:name/:id', update);

entitiesRouter.delete('/:name/:id', (req, res) => {
  const { name, id } = req.params;
  if (name === 'Document') return res.status(405).json({ error: 'Use the remove button to delete documents.' });
  const rec = table(name)[id];
  if (!rec || !visible(name, req.user, rec)) return res.status(404).json({ error: 'Not found.' });
  delete table(name)[id];
  save();
  res.json({ ok: true });
});
