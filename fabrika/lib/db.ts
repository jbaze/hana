import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * SQLite database access. The whole database is a single local file
 * (data/mebelis.db) - no server, no configuration, ideal for a defensible
 * prototype. The schema is created automatically on first access.
 */

const DB_PATH = join(process.cwd(), "data", "mebelis.db");

let db: Database.Database | null = null;

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  customer_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  city           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
  material_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL,          -- m2, m, kg, par.
  unit_price  REAL NOT NULL,          -- denars per unit
  stock       REAL NOT NULL DEFAULT 0,
  min_stock   REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  product_id INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,    -- M01, S01, P01...
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  price      REAL NOT NULL,           -- selling price, denars
  stock      INTEGER NOT NULL DEFAULT 0  -- finished goods on hand
);

-- Bill of materials: materials needed to produce ONE unit of a product.
CREATE TABLE IF NOT EXISTS product_materials (
  product_id  INTEGER NOT NULL REFERENCES products (product_id),
  material_id INTEGER NOT NULL REFERENCES materials (material_id),
  quantity    REAL NOT NULL,
  PRIMARY KEY (product_id, material_id)
);

-- Customer order lifecycle: NEW -> IN_PRODUCTION -> QC -> READY -> DELIVERED
CREATE TABLE IF NOT EXISTS orders (
  order_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers (customer_id),
  product_id  INTEGER NOT NULL REFERENCES products (product_id),
  quantity    INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'NEW',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Production order lifecycle: OPEN -> WAITING_QC -> COMPLETED
CREATE TABLE IF NOT EXISTS production_orders (
  po_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER NOT NULL REFERENCES orders (order_id),
  product_id   INTEGER NOT NULL REFERENCES products (product_id),
  quantity     INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'OPEN',
  started_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS quality_checks (
  qc_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id      INTEGER NOT NULL REFERENCES production_orders (po_id),
  checked_qty INTEGER NOT NULL,
  good_qty   INTEGER NOT NULL,
  defect_qty INTEGER NOT NULL,
  note       TEXT,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log of every stock change (materials and finished products).
CREATE TABLE IF NOT EXISTS stock_movements (
  movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type   TEXT NOT NULL,          -- 'material' | 'product'
  item_id     INTEGER NOT NULL,
  change      REAL NOT NULL,          -- positive = in, negative = out
  reason      TEXT NOT NULL,          -- purchase | production_use | production_in | delivery | seed | adjustment
  ref         TEXT,                   -- e.g. 'order:15' / 'po:7'
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders (status);
CREATE INDEX IF NOT EXISTS idx_po_order        ON production_orders (order_id);
CREATE INDEX IF NOT EXISTS idx_qc_po           ON quality_checks (po_id);
CREATE INDEX IF NOT EXISTS idx_movements_item  ON stock_movements (item_type, item_id);
`;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

/** Used by the seed script to start from a clean database. */
export function resetDb(): Database.Database {
  const d = getDb();
  d.exec(`
    DROP TABLE IF EXISTS stock_movements;
    DROP TABLE IF EXISTS quality_checks;
    DROP TABLE IF EXISTS production_orders;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS product_materials;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS materials;
    DROP TABLE IF EXISTS customers;
  `);
  d.exec(SCHEMA);
  return d;
}
