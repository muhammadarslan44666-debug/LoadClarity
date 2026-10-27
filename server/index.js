import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import './db.js';
import { authRouter } from './auth.js';
import { entitiesRouter } from './entities.js';
import { aiRouter } from './ai.js';
import { documentsRouter } from './documents.js';
import { billingRouter, lemonWebhookHandler } from './billing.js';

const app = express();
app.disable('x-powered-by');
// Lemon Squeezy signatures require the unmodified request body. Mount before JSON parsing.
app.post('/api/billing/lemonsqueezy-webhook', express.raw({ type: 'application/json', limit: '1mb' }), lemonWebhookHandler);
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'LoadClarity' }));
app.use('/api/auth', authRouter);
app.use('/api/billing', billingRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/ai', aiRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built website when it exists (npm run build, then npm start).
const dist = path.resolve('dist');
if (fs.existsSync(path.join(dist, 'index.html'))) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Friendly JSON errors (no stack traces to the browser).
app.use((err, req, res, next) => {  
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad request.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'File is too large. The limit is 15 MB.' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

export default app;
