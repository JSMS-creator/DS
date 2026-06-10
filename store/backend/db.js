// Uses better-sqlite3 with Railway-compatible path
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const __dirname = dirname(fileURLToPath(import.meta.url));

const dbPath = process.env.DB_PATH || join(__dirname, 'orders.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_payment_intent TEXT UNIQUE NOT NULL,
    cj_order_id TEXT,
    status TEXT DEFAULT 'pending',
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_address TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    variant TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_nok REAL NOT NULL,
    shipping_nok REAL NOT NULL DEFAULT 0,
    vat_nok REAL NOT NULL,
    total_nok REAL NOT NULL,
    tracking_number TEXT,
    tracking_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cj_product_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    variants TEXT,
    images TEXT,
    buy_price_usd REAL,
    sell_price_nok REAL,
    shipping_price_nok REAL DEFAULT 0,
    stock INTEGER DEFAULT 999,
    active INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed default settings if they don't exist yet
const defaultSettings = {
  storeName: process.env.STORE_NAME || 'Nettbutikk',
  primaryColor: '#111111',
  buttonColor: '#111111',
  tagline: 'Fri frakt · Rask levering · Trygt kjøp',
  deliveryDays: '7-14',
  returnDays: '30',
  soldCount: '2 847',
  rating: '4.8',
  supportEmail: process.env.SUPPORT_EMAIL || '',
  reviews: JSON.stringify([
    { name: 'Kari N.', stars: 5, text: 'Veldig fornøyd! Rask levering og god kvalitet.' },
    { name: 'Ole M.', stars: 5, text: 'Akkurat som beskrevet. Anbefales!' },
    { name: 'Ingrid L.', stars: 4, text: 'Bra produkt, kom litt sent men alt ok.' }
  ]),
  faq: JSON.stringify([
    { q: 'Hvor lang tid tar leveringen?', a: 'Vanligvis 7–14 virkedager til Norge.' },
    { q: 'Kan jeg returnere varen?', a: 'Ja, vi tilbyr 30 dagers returrett.' },
    { q: 'Er betalingen sikker?', a: 'Ja, vi bruker Stripe for sikker kortbetaling.' },
    { q: 'Sender dere til hele Norge?', a: 'Ja, vi sender til alle adresser i Norge.' }
  ]),
  benefits: JSON.stringify([
    'Gratis frakt på alle ordre',
    '30 dagers returrett — ingen spørsmål',
    'Sikker betaling med Stripe'
  ])
};

const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaultSettings)) {
  insertSetting.run(key, String(value));
}

export default db;
