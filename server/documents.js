// Private file storage for BOL, POD, RateCon and other load documents.
// Files are checked by their real content (not just the name) and only the owning company can read them.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { DATA_DIR } from './config.js';
import { requireAuth } from './auth.js';
import { save, newId, nowIso, table } from './db.js';

const ROOT = path.join(DATA_DIR, 'files');
fs.mkdirSync(ROOT, { recursive: true });

export const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = ['rate_confirmation', 'bol', 'pod', 'lumper_receipt', 'scale_ticket', 'detention_evidence', 'invoice', 'other'];
const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export function sniff(buf) {
  if (buf.length > 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}

const safeName = (n) => path.basename(String(n || 'file')).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 120) || 'file';
const fileFor = (key) => {
  const full = path.resolve(ROOT, key);
  return full.startsWith(ROOT + path.sep) ? full : null; // never leave the files folder
};
const mine = (req, rec) => rec && req.user.company_id && rec.company_id === req.user.company_id;

export const documentsRouter = express.Router();
documentsRouter.use(requireAuth);

documentsRouter.post('/upload', express.raw({ type: () => true, limit: MAX_BYTES }), (req, res) => {
  if (!req.user.company_id) return res.status(400).json({ error: 'Finish setting up your company first.' });
  const load = table('Load')[String(req.query.load_id || '')];
  if (!mine(req, load)) return res.status(404).json({ error: 'Load not found.' });
  const docType = String(req.query.doc_type || 'other');
  if (!TYPES.includes(docType)) return res.status(400).json({ error: 'Choose a valid document type.' });
  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'Choose a file to upload.' });
  const mime = sniff(body);
  if (!mime) return res.status(400).json({ error: 'Only PDF, JPG or PNG files can be uploaded.' });

  const id = newId();
  const key = `${req.user.company_id}/${id}.${EXT[mime]}`;
  const full = fileFor(key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
  const t = nowIso();
  const rec = {
    id, company_id: req.user.company_id, load_id: load.id, doc_type: docType, file_name: safeName(req.query.name),
    mime_type: mime, size: body.length, storage_key: key, signature_confirmed: false, approved: false,
    created_by_id: req.user.id, created_date: t, updated_date: t,
  };
  table('Document')[id] = rec;
  save();
  res.status(201).json(rec);
});

documentsRouter.get('/:id/file', (req, res) => {
  const rec = table('Document')[req.params.id];
  const full = rec && mine(req, rec) && fileFor(rec.storage_key);
  if (!full || !fs.existsSync(full)) return res.status(404).json({ error: 'File not found.' });
  res.setHeader('Content-Type', rec.mime_type);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(rec.file_name)}`);
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(full);
});

documentsRouter.delete('/:id', (req, res) => {
  const rec = table('Document')[req.params.id];
  if (!mine(req, rec)) return res.status(404).json({ error: 'Not found.' });
  const full = fileFor(rec.storage_key);
  try { if (full) fs.unlinkSync(full); } catch { /* already gone */ }
  delete table('Document')[rec.id];
  save();
  res.json({ ok: true });
});
