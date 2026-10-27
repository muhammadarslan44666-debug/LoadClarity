// Tiny file-based database (JSON). No native modules, so it installs on any PC.
// Good for local use and early testing. For many users, move to a real database (see README).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './config.js';

const FILE = path.join(DATA_DIR, 'db.json');
export const state = { users: [], resets: [], entities: {} };

if (fs.existsSync(FILE)) {
  try {
    Object.assign(state, JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch (e) {
    const bad = path.join(DATA_DIR, `db.corrupt-${Date.now()}.json`);
    fs.copyFileSync(FILE, bad);
    console.error(`Database file was unreadable. A copy was saved to ${bad}. Starting empty.`);
  }
}

function flush() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, FILE);
}

let timer = null;
export function save() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, 50);
}
export function flushNow() {
  if (timer) { clearTimeout(timer); timer = null; }
  flush();
}
process.on('exit', () => { try { flushNow(); } catch { /* ignore */ } });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { flushNow(); } catch { /* ignore */ } process.exit(0); });

export const newId = () => crypto.randomBytes(12).toString('hex');
export const nowIso = () => new Date().toISOString();
export const table = (name) => (state.entities[name] ||= {});
