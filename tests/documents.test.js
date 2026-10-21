import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-docs-'));
process.env.DATA_DIR = dir;
let server, base;
before(async () => {
  const app = (await import('../server/index.js')).default;
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const json = async (method, url, body, token) => {
  const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  return { status: res.status, data: t ? JSON.parse(t) : null };
};
const upload = async (token, query, body, type = 'application/octet-stream') => {
  const res = await fetch(`${base}/api/documents/upload?${new URLSearchParams(query)}`, { method: 'POST', headers: { 'content-type': type, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body });
  const t = await res.text();
  return { status: res.status, data: t ? JSON.parse(t) : null };
};
async function setup(email, company) {
  const token = (await json('POST', '/api/auth/register', { email, password: 'password-123' })).data.token;
  const c = (await json('POST', '/api/entities/Company', { name: company }, token)).data;
  await json('PATCH', '/api/auth/me', { company_id: c.id }, token);
  const load = (await json('POST', '/api/entities/Load', { load_number: 'L-1', rate: 1000 }, token)).data;
  return { token, load };
}
const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('hello pdf body')]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('png data')]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jpeg data')]);

let A, B, docA;
test('uploads PDF, PNG and JPG and stores them privately', async () => {
  A = await setup('a@docs.test', 'Alpha');
  B = await setup('b@docs.test', 'Beta');
  const r = await upload(A.token, { load_id: A.load.id, doc_type: 'bol', name: '../../evil bol.pdf' }, PDF, 'application/pdf');
  assert.equal(r.status, 201);
  docA = r.data;
  assert.equal(docA.mime_type, 'application/pdf');
  assert.equal(docA.file_name, 'evil bol.pdf', 'folder tricks are stripped from the name');
  assert.equal(docA.size, PDF.length);
  assert.ok(fs.existsSync(path.join(dir, 'files', docA.storage_key)));
  assert.equal((await upload(A.token, { load_id: A.load.id, doc_type: 'pod', name: 'p.png' }, PNG, 'image/png')).data.mime_type, 'image/png');
  assert.equal((await upload(A.token, { load_id: A.load.id, doc_type: 'other', name: 'p.jpg' }, JPG, 'image/jpeg')).data.mime_type, 'image/jpeg');
});

test('rejects bad uploads', async () => {
  const q = { load_id: A.load.id, doc_type: 'bol', name: 'x.pdf' };
  const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100)]);
  assert.equal((await upload(A.token, q, exe, 'application/pdf')).status, 400, 'a program renamed to .pdf is refused');
  assert.equal((await upload(A.token, q, Buffer.from('just text'), 'text/plain')).status, 400);
  assert.equal((await upload(A.token, q, Buffer.alloc(0))).status, 400, 'empty');
  assert.equal((await upload(A.token, { ...q, doc_type: 'virus' }, PDF)).status, 400, 'bad type');
  assert.equal((await upload(A.token, { ...q, load_id: 'nope' }, PDF)).status, 404);
  assert.equal((await upload(null, q, PDF)).status, 401);
  const big = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(16 * 1024 * 1024)]);
  assert.equal((await upload(A.token, q, big)).status, 413, 'over 15 MB');
});

test('only the owning company can load or change files', async () => {
  const q = { load_id: A.load.id, doc_type: 'bol', name: 'x.pdf' };
  assert.equal((await upload(B.token, q, PDF)).status, 404, 'cannot attach to another company\'s load');
  const ok = await fetch(`${base}/api/documents/${docA.id}/file`, { headers: { authorization: `Bearer ${A.token}` } });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'application/pdf');
  assert.match(ok.headers.get('content-security-policy'), /sandbox/);
  assert.deepEqual(Buffer.from(await ok.arrayBuffer()), PDF, 'same bytes come back');
  assert.equal((await fetch(`${base}/api/documents/${docA.id}/file`, { headers: { authorization: `Bearer ${B.token}` } })).status, 404);
  assert.equal((await fetch(`${base}/api/documents/${docA.id}/file`)).status, 401);
  assert.equal((await json('GET', `/api/entities/Document/${docA.id}`, undefined, B.token)).status, 404);
  assert.equal((await json('DELETE', `/api/documents/${docA.id}`, undefined, B.token)).status, 404);
  assert.deepEqual((await json('GET', '/api/entities/Document', undefined, B.token)).data, []);
});

test('review fields can be saved but file details cannot be forged', async () => {
  const up = await json('PATCH', `/api/entities/Document/${docA.id}`, { entered_load_number: 'L-1', entered_weight: '40000', signature_confirmed: true, approved: true, storage_key: '../../etc/passwd', file_name: 'x', load_id: 'other', size: 1 }, A.token);
  assert.equal(up.status, 200);
  assert.equal(up.data.entered_weight, 40000);
  assert.equal(up.data.approved, true);
  assert.equal(up.data.storage_key, docA.storage_key);
  assert.equal(up.data.file_name, docA.file_name);
  assert.equal(up.data.load_id, A.load.id);
  assert.equal((await json('POST', '/api/entities/Document', { load_id: A.load.id, storage_key: 'x' }, A.token)).status, 405);
  assert.equal((await json('DELETE', `/api/entities/Document/${docA.id}`, undefined, A.token)).status, 405);
});

test('removing a document deletes the file too', async () => {
  const full = path.join(dir, 'files', docA.storage_key);
  assert.ok(fs.existsSync(full));
  assert.equal((await json('DELETE', `/api/documents/${docA.id}`, undefined, A.token)).status, 200);
  assert.ok(!fs.existsSync(full));
  assert.equal((await fetch(`${base}/api/documents/${docA.id}/file`, { headers: { authorization: `Bearer ${A.token}` } })).status, 404);
});
