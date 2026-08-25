const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(__dirname, '..', '..', 'data', 'app.db'));
db.pragma('journal_mode = WAL');
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  activation_id TEXT NOT NULL,
  service_code TEXT NOT NULL,
  service_name TEXT,
  country_id INTEGER,
  country_name TEXT,
  phone_number TEXT,
  cost_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  otp_code TEXT,
  otp_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

// Seed default markup setting if missing
const markupRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('markup_percent');
if (!markupRow) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    .run('markup_percent', String(process.env.DEFAULT_MARKUP_PERCENT || 50));
}

// Seed default USD -> NGN exchange rate if missing. Adjust anytime from /admin.
const rateRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('exchange_rate_ngn');
if (!rateRow) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    .run('exchange_rate_ngn', String(process.env.DEFAULT_EXCHANGE_RATE_NGN || 1500));
}

module.exports = db;