require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const root = __dirname;
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const dataPath = path.join(root, 'data.json');
const siteConfigPath = path.join(root, 'site-config.json');
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be set and contain at least 32 characters.');
}
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  throw new Error('ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters are required.');
}
if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
}

function readData() {
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  } catch (error) {
    return { products: [], messages: [] };
  }
}

function writeData(data) {
  const temporaryPath = `${dataPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2));
  fs.renameSync(temporaryPath, dataPath);
}

function readSiteConfig() {
  return JSON.parse(fs.readFileSync(siteConfigPath, 'utf8'));
}

async function supabaseRequest(table, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase ${response.status}: ${details}`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

function mapProduct(row) {
  return { ...row, createdAt: row.created_at, updatedAt: row.updated_at };
}

function mapMessage(row) {
  return { ...row, createdAt: row.created_at };
}

const adminPasswordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppi tentativi. Riprova tra qualche minuto.' }
});

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({
  name: 'fariello.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000
  }
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated === true) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Autenticazione richiesta.' });
  return res.redirect('/login');
}

function cleanProduct(body) {
  const name = String(body.name || '').trim().slice(0, 120);
  const category = String(body.category || '').trim();
  const description = String(body.description || '').trim().slice(0, 500);
  const image = String(body.image || '').trim().slice(0, 1000);
  const validCategories = ['Letti', 'Divani', 'Poltrone', 'Materassi'];
  if (!name || !validCategories.includes(category) || !description || !/^https?:\/\//i.test(image)) return null;
  return { name, category, description, image };
}

app.get('/api/products', async (req, res, next) => {
  try {
    const products = await supabaseRequest('products?select=*&order=created_at.desc');
    res.json(products.map(mapProduct));
  } catch (error) {
    next(error);
  }
});

app.get('/api/site-config', (req, res) => {
  res.json(readSiteConfig());
});

app.post('/api/contact', async (req, res, next) => {
  const name = String(req.body.name || '').trim().slice(0, 100);
  const email = String(req.body.email || '').trim().slice(0, 160);
  const message = String(req.body.message || '').trim().slice(0, 2000);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message || req.body.privacyConsent !== true) return res.status(400).json({ error: 'Accetta l\'informativa privacy per inviare la richiesta.' });
  try {
    await supabaseRequest('messages', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ name, email, message, read: false })
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const valid = email === process.env.ADMIN_EMAIL.toLowerCase() && bcrypt.compareSync(password, adminPasswordHash);
  if (!valid) return res.status(401).json({ error: 'Credenziali non valide.' });
  req.session.regenerate(error => {
    if (error) return res.status(500).json({ error: 'Impossibile avviare la sessione.' });
    req.session.authenticated = true;
    req.session.adminEmail = email;
    res.json({ ok: true });
  });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ email: req.session.adminEmail }));

app.get('/api/admin/messages', requireAuth, async (req, res, next) => {
  try {
    const messages = await supabaseRequest('messages?select=*&order=created_at.desc');
    res.json(messages.map(mapMessage));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/messages/:id/read', requireAuth, async (req, res, next) => {
  try {
    const updated = await supabaseRequest(`messages?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ read: true })
    });
    if (!updated.length) return res.status(404).json({ error: 'Messaggio non trovato.' });
    res.json(mapMessage(updated[0]));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/products', requireAuth, async (req, res, next) => {
  const product = cleanProduct(req.body);
  if (!product) return res.status(400).json({ error: 'Dati prodotto non validi.' });
  try {
    const [saved] = await supabaseRequest('products', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(product)
    });
    res.status(201).json(mapProduct(saved));
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/products/:id', requireAuth, async (req, res, next) => {
  const product = cleanProduct(req.body);
  if (!product) return res.status(400).json({ error: 'Dati prodotto non validi.' });
  try {
    const updated = await supabaseRequest(`products?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ ...product, updated_at: new Date().toISOString() })
    });
    if (!updated.length) return res.status(404).json({ error: 'Prodotto non trovato.' });
    res.json(mapProduct(updated[0]));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/admin/products/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await supabaseRequest(`products?id=eq.${encodeURIComponent(req.params.id)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=representation' }
    });
    if (!deleted.length) return res.status(404).json({ error: 'Prodotto non trovato.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/login', (req, res) => res.sendFile(path.join(root, 'admin.html')));
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(root, 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/privacy.html', (req, res) => res.sendFile(path.join(root, 'privacy.html')));
app.get('/cookie.html', (req, res) => res.sendFile(path.join(root, 'cookie.html')));
app.get('/navigation.js', (req, res) => res.sendFile(path.join(root, 'navigation.js')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(root, 'favicon.ico')));

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error: 'JSON non valido.' });
  next(error);
});

app.listen(port, () => console.log(`Tappezzeria Fariello: http://localhost:${port}`));
