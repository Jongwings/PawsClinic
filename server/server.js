// server.js (rewritten)
// Node / ESM style. Expects to run from server/ folder.
// - Place .env in server/ with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, CLINIC_SMS_TO, TWILIO_FROM_NUMBER (or TWILIO_MESSAGING_SERVICE_SID)
// - Optional: ADMIN_SECRET, WHATSAPP_ENABLED, WHATSAPP_FROM, PORT

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import pkg from 'twilio'; // CommonJS-style package imported as default
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

dotenv.config();

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  TWILIO_MESSAGING_SERVICE_SID,
  CLINIC_SMS_TO,
  WHATSAPP_ENABLED,
  WHATSAPP_FROM,
  PORT = 3000
} = process.env;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Helmet: basic safe headers + allow Tailwind CDN for your frontend
app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(helmet.contentSecurityPolicy({
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "script-src": ["'self'", "https://cdn.tailwindcss.com"],
    "style-src": ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
    "img-src": ["'self'", "data:", "https:"],
    "connect-src": ["'self'"],
    "font-src": ["'self'", "https:", "data:"],
    "media-src": ["'self'", "https:"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'self'"]
  }
}));

app.use(express.json({ limit: '64kb' }));
app.use(cors({ origin: true, methods: ['POST','GET','OPTIONS'], allowedHeaders: ['Content-Type','X-Admin-Secret'] }));
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 12 }));

// Twilio client (CommonJS package may export differently across versions)
// Support both pkg.Twilio and pkg default callable export
// Twilio client construction (robust)
let twilioClient = null;

try {
  // If package exposes a Twilio class (pkg.Twilio) use new
  if (pkg && pkg.Twilio) {
    twilioClient = new pkg.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  // If pkg itself is a callable factory (older builds), try calling it
  else if (typeof pkg === 'function') {
    try {
      twilioClient = pkg(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    } catch (callErr) {
      // If calling fails, attempt new with pkg (some environments export class directly)
      twilioClient = new pkg(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }
  }
  // Some builds export default
  else if (pkg && pkg.default) {
    if (pkg.default.Twilio) {
      twilioClient = new pkg.default.Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    } else if (typeof pkg.default === 'function') {
      twilioClient = pkg.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }
  }
} catch (err) {
  console.warn('[WARN] Failed to construct Twilio client:', err && err.message);
  twilioClient = null;
}

if (!twilioClient) {
  console.warn('[WARN] Twilio client not available. Messages will not be sent until configured correctly.');
}


// ---------- SQLite setup ----------
const DB_PATH = path.join(__dirname, 'appointments.db');
let db = null;

async function initDb() {
  // open() returns Promise<Database>
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      pet_name TEXT NOT NULL,
      species TEXT NOT NULL,
      service TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      preferred_time TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Save appointment helper
async function saveAppointment(a = {}) {
  if (!db) throw new Error('DB not initialized');
  const stmt = `
    INSERT INTO appointments
      (owner_name, phone, email, pet_name, species, service, preferred_date, preferred_time, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const result = await db.run(stmt,
    a.ownerName || null,
    a.phone || null,
    a.email || null,
    a.petName || null,
    a.species || null,
    a.service || null,
    a.date || null,
    a.time || null,
    a.message || null
  );
  return result.lastID;
}

// small sanitizer
const sanitize = (s='') => String(s || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 240);

// ----------------- Routes -----------------

// health
app.get('/health', (_req, res) => res.json({ ok: true }));

// send-sms endpoint
app.post('/api/send-sms', async (req, res) => {
  try {
    const {
      ownerName,
      phone,
      petName,
      species = 'Unknown',
      service,
      date,
      time,
      message,
      email,
      agree
    } = req.body || {};

    // Basic validation: require ownerName, phone, petName, service (email optional)
    if (!ownerName || !phone || !petName || !service || agree !== true) {
      return res.status(400).json({ success: false, error: 'Invalid submission. Please fill required fields and agree.' });
    }

    // Build body text
    let text = 'New Appointment Request:\n';
    text += `Owner: ${sanitize(ownerName)} (${sanitize(phone)})\n`;
    if (email) text += `Email: ${sanitize(email)}\n`;
    text += `Pet: ${sanitize(petName)} (${sanitize(species)})\n`;
    text += `Service: ${sanitize(service)}\n`;
    if (date || time) text += `Preferred: ${sanitize(date || '')} ${sanitize(time || '')}\n`;
    if (message) text += `Notes: ${sanitize(message)}`;

    // Choose WhatsApp vs SMS
    const wantWhatsApp = String(WHATSAPP_ENABLED || 'false').toLowerCase() === 'true';
    let params = null;

    if (wantWhatsApp) {
      if (!WHATSAPP_FROM) return res.status(500).json({ success: false, error: 'WHATSAPP_FROM not configured' });
      params = { from: WHATSAPP_FROM, to: `whatsapp:${CLINIC_SMS_TO}`, body: text };
    } else {
      if (TWILIO_FROM_NUMBER) {
        params = { from: TWILIO_FROM_NUMBER, to: CLINIC_SMS_TO, body: text };
      } else if (TWILIO_MESSAGING_SERVICE_SID) {
        params = { messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID, to: CLINIC_SMS_TO, body: text };
      } else {
        return res.status(500).json({ success: false, error: 'No Twilio sender configured (TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID required)' });
      }
    }

    if (!twilioClient) {
      console.warn('[WARN] Twilio client not available; skipping send.');
    }

    // attempt to send message (if Twilio configured)
    let msg = { sid: null };
    try {
      if (twilioClient) {
        msg = await twilioClient.messages.create(params);
        console.log('[SMS] Sent, sid=', msg.sid);
      }
    } catch (twErr) {
      console.error('[SMS ERROR]', twErr && twErr.message);
      // continue to save appointment even if sending failed
      return res.status(500).json({ success: false, error: twErr.message || 'Failed to send message' });
    }

    // save to DB best-effort
    try {
      const id = await saveAppointment({ ownerName, phone, email, petName, species, service, date, time, message });
      console.log('[DB] Saved appointment id', id);
    } catch (dbErr) {
      console.error('[DB ERROR] Failed to save appointment:', dbErr && dbErr.message);
    }

    return res.json({ success: true, sid: msg.sid || null });
  } catch (err) {
    console.error('[API ERROR]', err && err.message);
    return res.status(500).json({ success: false, error: err && err.message });
  }
});

// Admin: list appointments (last 200) - accepts X-Admin-Secret header or ?secret=...; if ADMIN_SECRET not set, allow.
// Admin: list appointments (last 200) - ADMIN_SECRET required
app.get('/api/appointments', async (req, res) => {
  try {
    const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
    if (!ADMIN_SECRET) {
      // Fail fast: require ADMIN_SECRET to be configured for admin access
      return res.status(500).json({ success: false, error: 'ADMIN_SECRET not configured on server' });
    }

    // Accept ?secret=... or X-Admin-Secret header
    const supplied = (req.query.secret || req.get('X-Admin-Secret') || '').trim();
    if (supplied !== ADMIN_SECRET) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!db) return res.status(500).json({ success: false, error: 'DB not initialized' });
    const rows = await db.all('SELECT * FROM appointments ORDER BY created_at DESC LIMIT 200');
    res.json({ success: true, appointments: rows });
  } catch (e) {
    console.error('Failed to fetch appointments', e);
    res.status(500).json({ success: false, error: e.message || 'Failed to fetch' });
  }
});

// ======================================
// Admin: download the full SQLite database
// ======================================
import fs from "fs";

app.get('/api/download-db', async (req, res) => {
  try {
    const secret = req.headers['x-admin-secret'];
    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const filePath = path.join(__dirname, 'appointments.db');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Database file not found' });
    }

    const backupName = `appointments-backup-${new Date().toISOString().slice(0,10)}.db`;
    res.setHeader('Content-Disposition', `attachment; filename="${backupName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('[DB DOWNLOAD ERROR]', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


// Serve static website
// ===== Serve API only on Render / Production =====
// If you want the server to be API-only in production (Pages hosts the frontend),
// redirect root / to the Pages site (set PAGES_URL in env).
const PAGES_URL = process.env.PAGES_URL || 'https://www.jongwings.com/PawsClinic/';

// In development (local) we may still want to serve the static web folder.
// Use NODE_ENV=development to enable local static hosting.
if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.join(__dirname, '../web')));
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../web/index.html')));
} else {
  // Production / Render: redirect the root to the Pages site (no static files served)
  app.get('/', (req, res) => res.redirect(302, PAGES_URL));
}


// ---------------- Startup ----------------
(async function startServer() {
  try {
    await initDb();
    console.log('[DB] Initialized at', DB_PATH);
  } catch (err) {
    console.error('[DB] Failed to initialize:', err && err.message);
  }

  const actualPort = process.env.PORT || PORT || 3000;
  app.listen(actualPort, () => {
    console.log(`PawsClinic server listening on http://localhost:${actualPort}`);
  });
})();

