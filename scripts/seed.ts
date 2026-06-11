/**
 * Seed script — run LOCALLY, never as a serverless route:
 *
 *   npm run seed                 # both databases, scale from SEED_SCALE
 *   npm run seed -- --only=postgres
 *   npm run seed -- --only=hana
 *
 * Idempotent: drops and recreates the schema before loading. Generates
 * coherent fake data once (seeded faker, so both databases receive byte-equal
 * datasets) and bulk-loads it: multi-row INSERTs for PostgreSQL, prepared
 * statement + execBatch (array binding) for HANA.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { faker } from "@faker-js/faker";
import postgres from "postgres";
import { hanaConnect, HanaConnection } from "../lib/db/hana";

/* --------------------------------- Config -------------------------------- */

const SCALES = {
  demo: {
    authors: 2_000,
    books: 30_000,
    customers: 50_000,
    orders: 300_000,
    reviews: 150_000,
  },
  large: {
    authors: 10_000,
    books: 150_000,
    customers: 250_000,
    orders: 1_500_000,
    reviews: 750_000,
  },
} as const;

type ScaleName = keyof typeof SCALES;

const scaleName = (process.env.SEED_SCALE ?? "demo") as ScaleName;
if (!(scaleName in SCALES)) {
  console.error(`Unknown SEED_SCALE "${scaleName}" — use "demo" or "large".`);
  process.exit(1);
}
const scale = SCALES[scaleName];

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const target = onlyArg ? onlyArg.split("=")[1] : "both";
if (!["both", "hana", "postgres"].includes(target)) {
  console.error(`Invalid --only value "${target}" — use hana or postgres.`);
  process.exit(1);
}
const doHana = target === "both" || target === "hana";
const doPg = target === "both" || target === "postgres";

const PG_CHUNK = 4_000;
const HANA_CHUNK = 10_000;

// Deterministic data: both databases get the identical dataset on every run.
faker.seed(42);

/* ------------------------------ Data generation --------------------------- */

const GENRES = [
  "Роман",
  "Фантастика",
  "Криминалистика",
  "Историја",
  "Биографија",
  "Поезија",
  "Драма",
  "Детска литература",
  "Научна фантастика",
  "Психологија",
  "Бизнис",
  "Патописи",
] as const;

const CITIES = [
  "Скопје",
  "Битола",
  "Куманово",
  "Прилеп",
  "Тетово",
  "Велес",
  "Охрид",
  "Гостивар",
  "Штип",
  "Струмица",
  "Кавадарци",
  "Кочани",
] as const;

const NATIONALITIES = [
  "Macedonian",
  "British",
  "American",
  "French",
  "German",
  "Italian",
  "Spanish",
  "Russian",
  "Japanese",
  "Serbian",
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[faker.number.int({ min: 0, max: arr.length - 1 })];
}

function tsString(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function randomDate(fromYear: number, toYear: number): Date {
  return faker.date.between({
    from: `${fromYear}-01-01T00:00:00.000Z`,
    to: `${toYear}-12-31T23:59:59.000Z`,
  });
}

interface Dataset {
  authors: unknown[][];
  books: unknown[][];
  customers: unknown[][];
  orders: unknown[][];
  orderItems: unknown[][];
  reviews: unknown[][];
}

function generate(): Dataset {
  console.log(`Generating "${scaleName}" dataset with faker (seed 42)…`);

  const authors: unknown[][] = [];
  for (let i = 1; i <= scale.authors; i++) {
    authors.push([
      i,
      faker.person.fullName(),
      pick(NATIONALITIES),
      faker.number.int({ min: 1920, max: 1995 }),
    ]);
  }

  const books: unknown[][] = [];
  const bookPrices: number[] = [0]; // index 0 unused; book ids start at 1
  for (let i = 1; i <= scale.books; i++) {
    const price =
      Math.round(faker.number.float({ min: 199, max: 2999 }) * 100) / 100;
    bookPrices.push(price);
    books.push([
      i,
      faker.book.title(),
      faker.number.int({ min: 1, max: scale.authors }),
      pick(GENRES),
      price,
      faker.number.int({ min: 0, max: 200 }),
      faker.number.int({ min: 1950, max: 2025 }),
    ]);
  }

  const customers: unknown[][] = [];
  for (let i = 1; i <= scale.customers; i++) {
    const first = faker.person.firstName();
    const last = faker.person.lastName();
    customers.push([
      i,
      `${first} ${last}`,
      // Index suffix guarantees uniqueness at 50k+ rows.
      `${first}.${last}.${i}@example.com`.toLowerCase(),
      pick(CITIES),
      tsString(randomDate(2021, 2025)),
    ]);
  }

  const orders: unknown[][] = [];
  for (let i = 1; i <= scale.orders; i++) {
    orders.push([
      i,
      faker.number.int({ min: 1, max: scale.customers }),
      tsString(randomDate(2022, 2025)),
    ]);
  }

  // 1–4 items per order (average 2.5) → ~750k rows at demo scale,
  // sized so the whole dataset fits a 0.5 GB Postgres free tier.
  const orderItems: unknown[][] = [];
  let itemId = 1;
  for (let orderId = 1; orderId <= scale.orders; orderId++) {
    const n = faker.number.int({ min: 1, max: 4 });
    for (let j = 0; j < n; j++) {
      const bookId = faker.number.int({ min: 1, max: scale.books });
      // Occasional 10% discount keeps unit_price coherent with the catalog.
      const discounted = faker.number.int({ min: 1, max: 10 }) === 1;
      const unitPrice =
        Math.round(bookPrices[bookId] * (discounted ? 0.9 : 1) * 100) / 100;
      orderItems.push([
        itemId++,
        orderId,
        bookId,
        faker.number.int({ min: 1, max: 3 }),
        unitPrice,
      ]);
    }
  }

  // Only ~60% of customers ever review — the rest make the anti-join query
  // ("loyal customers without a single review") return meaningful results.
  const reviewingCustomers = Math.floor(scale.customers * 0.6);
  const reviews: unknown[][] = [];
  for (let i = 1; i <= scale.reviews; i++) {
    // Ratings skewed toward 4–5, like real storefronts.
    const r = faker.number.int({ min: 1, max: 10 });
    const rating = r <= 1 ? 1 : r <= 2 ? 2 : r <= 4 ? 3 : r <= 7 ? 4 : 5;
    reviews.push([
      i,
      faker.number.int({ min: 1, max: scale.books }),
      faker.number.int({ min: 1, max: reviewingCustomers }),
      rating,
      tsString(randomDate(2022, 2025)),
      faker.number.int({ min: 1, max: 4 }) === 1
        ? null
        : faker.lorem.sentence({ min: 4, max: 14 }).slice(0, 1000),
    ]);
  }

  return { authors, books, customers, orders, orderItems, reviews };
}

/* ------------------------------- Table specs ------------------------------ */

interface TableSpec {
  name: string;
  columns: string[];
}

const TABLES: TableSpec[] = [
  { name: "authors", columns: ["author_id", "name", "nationality", "birth_year"] },
  {
    name: "books",
    columns: ["book_id", "title", "author_id", "genre", "price", "stock", "published_year"],
  },
  { name: "customers", columns: ["customer_id", "name", "email", "city", "registered_at"] },
  { name: "orders", columns: ["order_id", "customer_id", "ordered_at"] },
  {
    name: "order_items",
    columns: ["order_item_id", "order_id", "book_id", "quantity", "unit_price"],
  },
  {
    name: "reviews",
    columns: ["review_id", "book_id", "customer_id", "rating", "created_at", "comment"],
  },
];

function readDdl(file: string): string[] {
  const text = readFileSync(join(__dirname, "..", "sql", file), "utf8");
  return text
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.split("\n").every((l) => l.trim().startsWith("--")));
}

function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/* -------------------------------- PostgreSQL ------------------------------ */

async function seedPostgres(data: Dataset) {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set");
  if (/neon\.tech|supabase\./.test(url)) {
    console.log(
      "⚠ PostgreSQL host looks like a free tier (Neon/Supabase, ~0.5 GB). " +
        'The "demo" preset is sized to fit; "large" will NOT fit.'
    );
  }

  const sql = postgres(url, { max: 4, prepare: false, onnotice: () => undefined });
  console.log("\n[PostgreSQL] Recreating schema…");
  for (const t of [...TABLES].reverse()) {
    await sql.unsafe(`DROP TABLE IF EXISTS ${t.name} CASCADE`);
  }
  for (const stmt of readDdl("postgres-schema.sql")) {
    await sql.unsafe(stmt);
  }

  const datasets: [TableSpec, unknown[][]][] = [
    [TABLES[0], data.authors],
    [TABLES[1], data.books],
    [TABLES[2], data.customers],
    [TABLES[3], data.orders],
    [TABLES[4], data.orderItems],
    [TABLES[5], data.reviews],
  ];

  for (const [spec, rows] of datasets) {
    const started = Date.now();
    for (const chunk of chunks(rows, PG_CHUNK)) {
      const objects = chunk.map((row) =>
        Object.fromEntries(spec.columns.map((c, i) => [c, row[i]]))
      );
      await sql`INSERT INTO ${sql(spec.name)} ${sql(objects)}`;
    }
    console.log(
      `[PostgreSQL] ${spec.name}: ${rows.length.toLocaleString()} rows in ${((Date.now() - started) / 1000).toFixed(1)}s`
    );
  }

  await sql.unsafe("ANALYZE");

  console.log("\n[PostgreSQL] Final state:");
  for (const t of TABLES) {
    const [{ cnt }] = await sql.unsafe(`SELECT COUNT(*)::int AS cnt FROM ${t.name}`);
    const [{ size }] = await sql.unsafe(
      `SELECT pg_size_pretty(pg_total_relation_size('${t.name}')) AS size`
    );
    console.log(`  ${t.name.padEnd(12)} ${String(cnt).padStart(9)} rows  ~${size}`);
  }
  const [{ total }] = await sql.unsafe(
    `SELECT pg_size_pretty(SUM(pg_total_relation_size(quote_ident(tablename)))::bigint) AS total
     FROM pg_tables WHERE schemaname = 'public'`
  );
  console.log(`  TOTAL ≈ ${total}`);
  await sql.end();
}

/* --------------------------------- SAP HANA ------------------------------- */

async function seedHana(data: Dataset) {
  const conn: HanaConnection = await hanaConnect();
  console.log("\n[HANA] Recreating schema…");
  for (const t of [...TABLES].reverse()) {
    try {
      await conn.exec(`DROP TABLE ${t.name} CASCADE`);
    } catch {
      // table did not exist — fine
    }
  }
  for (const stmt of readDdl("hana-schema.sql")) {
    await conn.exec(stmt);
  }

  const datasets: [TableSpec, unknown[][]][] = [
    [TABLES[0], data.authors],
    [TABLES[1], data.books],
    [TABLES[2], data.customers],
    [TABLES[3], data.orders],
    [TABLES[4], data.orderItems],
    [TABLES[5], data.reviews],
  ];

  for (const [spec, rows] of datasets) {
    const started = Date.now();
    const placeholders = spec.columns.map(() => "?").join(", ");
    const insertSql = `INSERT INTO ${spec.name} (${spec.columns.join(", ")}) VALUES (${placeholders})`;
    for (const chunk of chunks(rows, HANA_CHUNK)) {
      await conn.execBatch(insertSql, chunk);
    }
    console.log(
      `[HANA] ${spec.name}: ${rows.length.toLocaleString()} rows in ${((Date.now() - started) / 1000).toFixed(1)}s`
    );
  }

  console.log("\n[HANA] Final state:");
  for (const t of TABLES) {
    const [row] = await conn.exec<{ CNT: number }>(
      `SELECT COUNT(*) AS CNT FROM ${t.name}`
    );
    let sizeInfo = "";
    try {
      const sizeRows = await conn.exec<{ SIZE_MB: number }>(
        `SELECT ROUND(TABLE_SIZE / 1024 / 1024, 1) AS SIZE_MB
         FROM M_TABLES
         WHERE SCHEMA_NAME = CURRENT_SCHEMA AND TABLE_NAME = UPPER('${t.name}')`
      );
      if (sizeRows.length > 0) sizeInfo = `  ~${sizeRows[0].SIZE_MB} MB`;
    } catch {
      sizeInfo = "  (size unavailable — no M_TABLES privilege)";
    }
    console.log(`  ${t.name.padEnd(12)} ${String(row.CNT).padStart(9)} rows${sizeInfo}`);
  }
  conn.close();
}

/* ---------------------------------- Main ---------------------------------- */

async function main() {
  const started = Date.now();
  const data = generate();
  const totalRows =
    data.authors.length +
    data.books.length +
    data.customers.length +
    data.orders.length +
    data.orderItems.length +
    data.reviews.length;
  console.log(
    `Generated ${totalRows.toLocaleString()} rows total ` +
      `(order_items: ${data.orderItems.length.toLocaleString()}).`
  );

  if (doPg) await seedPostgres(data);
  else console.log("\nSkipping PostgreSQL (--only=hana).");

  if (doHana) await seedHana(data);
  else console.log("\nSkipping HANA (--only=postgres).");

  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(0)}s.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
