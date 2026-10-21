import crypto from 'node:crypto';
import express from 'express';
import { config } from './config.js';
import { state, save, newId, nowIso, table } from './db.js';

const TOKEN_DAYS = 30;
const b64 = (b) => Buffer.from(b).toString('base64url');

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export function signToken(userId) {
  const payload = b64(JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_DAYS * 864e5 }));
  const sig = crypto.createHmac('sha256', config.secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function readToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const good = crypto.createHmac('sha256', config.secret).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export const publicUser = (u) => ({
  id: u.id, email: u.email, full_name: u.full_name || '', role: u.role || 'user',
  company_id: u.company_id || null, created_date: u.created_date,
});

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const p = h.startsWith('Bearer ') ? readToken(h.slice(7)) : null;
  const user = p && state.users.find((u) => u.id === p.sub);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  req.user = user;
  next();
}

// Simple in-memory limiter: 10 attempts / 10 minutes per IP + email.
const attempts = new Map();
function limited(key) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.reset < now) { attempts.set(key, { n: 1, reset: now + 600000 }); return false; }
  a.n += 1;
  return a.n > 10;
}

const emailOk = (e) => typeof e === 'string' && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const clean = (s, max = 120) => String(s ?? '').trim().slice(0, max);

export const authRouter = express.Router();

authRouter.post('/register', (req, res) => {
  const email = clean(req.body?.email, 200).toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!emailOk(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (password.length > 200) return res.status(400).json({ error: 'Password is too long.' });
  if (state.users.some((u) => u.email === email)) return res.status(409).json({ error: 'An account with this email already exists.' });
  const user = {
    id: newId(), email, full_name: clean(req.body?.full_name), password_hash: hashPassword(password),
    role: state.users.length === 0 ? 'admin' : 'user', company_id: null, created_date: nowIso(),
  };
  state.users.push(user);
  save();
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.post('/login', (req, res) => {
  const email = clean(req.body?.email, 200).toLowerCase();
  const password = String(req.body?.password ?? '');
  if (limited(`${req.ip}|${email}`)) return res.status(429).json({ error: 'Too many attempts. Wait a few minutes and try again.' });
  const user = state.users.find((u) => u.email === email);
  if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password.' });
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

authRouter.patch('/me', requireAuth, (req, res) => {
  const u = req.user;
  if (req.body && 'full_name' in req.body) u.full_name = clean(req.body.full_name);
  if (req.body && 'company_id' in req.body) {
    const c = table('Company')[req.body.company_id];
    // A user can only attach themselves to a company they created.
    if (!c || c.created_by_id !== u.id) return res.status(403).json({ error: 'You cannot use that company.' });
    u.company_id = c.id;
  }
  save();
  res.json(publicUser(u));
});

authRouter.post('/reset-request', (req, res) => {
  const email = clean(req.body?.email, 200).toLowerCase();
  const user = state.users.find((u) => u.email === email);
  if (user && !limited(`reset|${req.ip}|${email}`)) {
    const token = crypto.randomBytes(24).toString('hex');
    state.resets = state.resets.filter((r) => r.expires > Date.now());
    state.resets.push({ token_hash: crypto.createHash('sha256').update(token).digest('hex'), user_id: user.id, expires: Date.now() + 3600000 });
    save();
    // No email service is connected, so the link is printed here (server window).
    console.log(`\n[Password reset] For ${email}, open:\n${config.appUrl}/reset-password?token=${token}\n(Valid for 1 hour)\n`);
  }
  // Same answer whether or not the account exists.
  res.json({ ok: true });
});

authRouter.post('/reset', (req, res) => {
  const token = String(req.body?.resetToken ?? '');
  const pw = String(req.body?.newPassword ?? '');
  if (pw.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const h = crypto.createHash('sha256').update(token).digest('hex');
  const r = state.resets.find((x) => x.token_hash === h && x.expires > Date.now());
  const user = r && state.users.find((u) => u.id === r.user_id);
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  user.password_hash = hashPassword(pw);
  state.resets = state.resets.filter((x) => x !== r);
  save();
  res.json({ ok: true });
});
