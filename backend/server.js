
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { nanoid } from 'nanoid';
import Database from 'better-sqlite3';
import path from 'path';
import geoip from 'geoip-lite';
import { fileURLToPath } from 'url';
import { loggingMiddleware, requestIdMiddleware } from './middleware/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const HOSTNAME = process.env.HOSTNAME || 'localhost';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

// --- MANDATORY: use your custom logging middleware (not console/inbuilt) ---
app.use(requestIdMiddleware());
app.use(loggingMiddleware());

app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: false }));
app.use(express.json({ limit: '200kb' }));

// ---- DB setup (SQLite) ----
const dbFile = path.join(__dirname, 'data.sqlite');
const db = new Database(dbFile);

// Create tables if not exist
db.exec(`
CREATE TABLE IF NOT EXISTS urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id INTEGER NOT NULL,
  ts TEXT NOT NULL,
  referrer TEXT,
  ip TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE
);
`);

const insertUrl = db.prepare(`INSERT INTO urls (code, long_url, created_at, expires_at) VALUES (?, ?, ?, ?)`);
const getByCode = db.prepare(`SELECT * FROM urls WHERE code = ?`);
const incClicks = db.prepare(`UPDATE urls SET clicks = clicks + 1 WHERE id = ?`);
const insertClick = db.prepare(`INSERT INTO clicks (url_id, ts, referrer, ip, country, region, city) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const listAll = db.prepare(`SELECT * FROM urls ORDER BY created_at DESC`);
const getClicks = db.prepare(`SELECT ts, referrer, country, region, city FROM clicks WHERE url_id = ? ORDER BY ts DESC`);

function isValidUrl(maybe) {
  try {
    const u = new URL(maybe);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const SHORTCODE_RE = /^[a-zA-Z0-9_-]{3,32}$/;

function genCode() {
  return nanoid(7).replace(/-/g, '_');
}

function minutesFromNowISO(mins) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

// ---------- API ----------

// Health
app.get('/health', (req, res) => {
  req.log.info('healthcheck', { path: req.path });
  res.json({ ok: true, now: new Date().toISOString() });
});

// Create Short URL
app.post('/shorturls', (req, res) => {
  const { url, validity, shortcode } = req.body || {};
  req.log.info('create_shorturl_request', { body: req.body });

  if (!url || !isValidUrl(url)) {
    req.log.warn('invalid_url', { url });
    return res.status(400).json({ error: 'Invalid or missing "url". Must be a valid http/https URL.' });
  }

  let mins = 30;
  if (validity !== undefined) {
    if (!Number.isInteger(validity) || validity <= 0 || validity > 60*24*60) {
      req.log.warn('invalid_validity', { validity });
      return res.status(400).json({ error: '"validity" must be a positive integer representing minutes.' });
    }
    mins = validity;
  }

  let code = shortcode;
  if (code !== undefined) {
    if (!SHORTCODE_RE.test(code)) {
      req.log.warn('invalid_shortcode', { shortcode: code });
      return res.status(400).json({ error: '"shortcode" must be alphanumeric (plus _ or -), length 3-32.' });
    }
  } else {
    code = genCode();
  }

  // ensure uniqueness; if conflict and user provided custom code, return 409; else regenerate
  let attempt = 0;
  const createdAt = new Date().toISOString();
  const expiresAt = minutesFromNowISO(mins);

  while (attempt < 5) {
    try {
      insertUrl.run(code, url, createdAt, expiresAt);
      const shortLink = `http://${HOSTNAME}:${PORT}/${code}`;
      req.log.info('shorturl_created', { code, shortLink, expiresAt });
      return res.status(201).json({ shortLink, expiry: expiresAt });
    } catch (e) {
      if (e && String(e).includes('UNIQUE') ) {
        if (shortcode) {
          req.log.error('shortcode_conflict', { code });
          return res.status(409).json({ error: 'Shortcode already in use. Please choose another.' });
        } else {
          code = genCode();
          attempt += 1;
        }
      } else {
        req.log.error('db_insert_error', { error: String(e) });
        return res.status(500).json({ error: 'Internal error creating shortcode.' });
      }
    }
  }

  req.log.error('exhausted_shortcode_generation');
  return res.status(500).json({ error: 'Failed to generate unique shortcode.' });
});

// Retrieve Short URL Statistics
app.get('/shorturls/:code', (req, res) => {
  const code = req.params.code;
  req.log.info('get_stats', { code });

  const urlRow = getByCode.get(code);
  if (!urlRow) {
    req.log.warn('code_not_found', { code });
    return res.status(404).json({ error: 'Shortcode not found.' });
  }

  const clicks = getClicks.all(urlRow.id);

  return res.json({
    shortcode: urlRow.code,
    url: urlRow.long_url,
    createdAt: urlRow.created_at,
    expiry: urlRow.expires_at,
    totalClicks: urlRow.clicks,
    clicks: clicks.map(c => ({
      timestamp: c.ts,
      referrer: c.referrer || null,
      geo: {
        country: c.country || null,
        region: c.region || null,
        city: c.city || null
      }
    }))
  });
});

// List all short URLs (for Statistics Page)
app.get('/shorturls', (req, res) => {
  req.log.info('list_all');
  const rows = listAll.all();
  res.json(rows.map(r => ({
    shortcode: r.code,
    url: r.long_url,
    createdAt: r.created_at,
    expiry: r.expires_at,
    totalClicks: r.clicks,
    shortLink: `http://${HOSTNAME}:${PORT}/${r.code}`
  })));
});

// Redirection
app.get('/:code', (req, res) => {
  const code = req.params.code;
  const row = getByCode.get(code);
  if (!row) {
    req.log.warn('redirect_code_not_found', { code });
    return res.status(404).json({ error: 'Shortcode not found.' });
  }

  const now = new Date();
  const exp = new Date(row.expires_at);
  if (now > exp) {
    req.log.warn('link_expired', { code });
    return res.status(410).json({ error: 'Short link expired.' });
  }

  // Record click analytics
  const referrer = req.get('referer') || req.get('referrer') || null;
  // trust x-forwarded-for when behind proxy else use req.ip
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null;
  let country=null, region=null, city=null;
  try {
    const lookup = ip ? geoip.lookup(ip) : null;
    if (lookup) {
      country = lookup.country || null;
      region = Array.isArray(lookup.region) ? lookup.region[0] : lookup.region || null;
      city = lookup.city || null;
    }
  } catch {}

  const ts = new Date().toISOString();
  insertClick.run(row.id, ts, referrer, ip, country, region, city);
  incClicks.run(row.id);

  req.log.info('redirect', { code, to: row.long_url, referrer, country, region, city });

  res.redirect(row.long_url);
});

// Fallback 404 for unknown API routes
app.use((req, res) => {
  req.log.warn('not_found', { path: req.path });
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  // DO NOT use console logging per assignment; using custom logger to log startup
  const startupMessage = `listening on http://${HOSTNAME}:${PORT}`;
  // quick, one-time file write for visibility via logger
});
