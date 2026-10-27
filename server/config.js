// Loads .env (no extra dependency) and exposes settings.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(process.cwd());
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    const v = m[2].replace(/^["']|["']$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

export const DATA_DIR = path.resolve(root, process.env.DATA_DIR || 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Session secret: from .env, otherwise generated once and saved in the data folder.
function loadSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) return process.env.SESSION_SECRET;
  const f = path.join(DATA_DIR, 'session-secret.txt');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  secret: loadSecret(),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
  isProd: process.env.NODE_ENV === 'production',
};
