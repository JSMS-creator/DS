import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, 'orders.db'));

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
`);

export default db;
