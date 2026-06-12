/**
 * Data-parity verification: confirms both databases contain identical data.
 *
 *   npm run verify
 *
 * Compares row counts, numeric checksums, date ranges and the distinct
 * genre×month combinations between SAP HANA and PostgreSQL. Any MISMATCH
 * means the benchmark premise ("identical datasets") is broken — re-run
 * `npm run seed` to reload both databases from one generation pass.
 */

import "dotenv/config";
import postgres from "postgres";
import { hanaConnect } from "../lib/db/hana";

interface Check {
  label: string;
  /** SQL returning a single row with a single column named V. */
  hanaSql: string;
  pgSql: string;
}

const TABLES = ["authors", "books", "customers", "orders", "order_items", "reviews"];

const checks: Check[] = [
  ...TABLES.map((t) => ({
    label: `${t}: row count`,
    hanaSql: `SELECT COUNT(*) AS V FROM ${t}`,
    pgSql: `SELECT COUNT(*)::bigint AS v FROM ${t}`,
  })),
  {
    label: "orders: min(ordered_at)",
    hanaSql: `SELECT TO_VARCHAR(MIN(ordered_at), 'YYYY-MM-DD HH24:MI:SS') AS V FROM orders`,
    pgSql: `SELECT TO_CHAR(MIN(ordered_at), 'YYYY-MM-DD HH24:MI:SS') AS v FROM orders`,
  },
  {
    label: "orders: max(ordered_at)",
    hanaSql: `SELECT TO_VARCHAR(MAX(ordered_at), 'YYYY-MM-DD HH24:MI:SS') AS V FROM orders`,
    pgSql: `SELECT TO_CHAR(MAX(ordered_at), 'YYYY-MM-DD HH24:MI:SS') AS v FROM orders`,
  },
  {
    label: "orders: distinct months",
    hanaSql: `SELECT COUNT(DISTINCT TO_VARCHAR(ordered_at, 'YYYY-MM')) AS V FROM orders`,
    pgSql: `SELECT COUNT(DISTINCT TO_CHAR(ordered_at, 'YYYY-MM'))::bigint AS v FROM orders`,
  },
  {
    label: "orders: sum(customer_id) checksum",
    hanaSql: `SELECT SUM(customer_id) AS V FROM orders`,
    pgSql: `SELECT SUM(customer_id)::bigint AS v FROM orders`,
  },
  {
    label: "books: distinct genres",
    hanaSql: `SELECT COUNT(DISTINCT genre) AS V FROM books`,
    pgSql: `SELECT COUNT(DISTINCT genre)::bigint AS v FROM books`,
  },
  {
    label: "order_items: sum(quantity)",
    hanaSql: `SELECT SUM(quantity) AS V FROM order_items`,
    pgSql: `SELECT SUM(quantity)::bigint AS v FROM order_items`,
  },
  {
    label: "order_items: sum(quantity*unit_price)",
    hanaSql: `SELECT TO_VARCHAR(SUM(quantity * unit_price)) AS V FROM order_items`,
    pgSql: `SELECT SUM(quantity * unit_price)::text AS v FROM order_items`,
  },
  {
    label: "genre×month combinations (benchmark query group count)",
    hanaSql: `SELECT COUNT(*) AS V FROM (
      SELECT b.genre, TO_VARCHAR(o.ordered_at, 'YYYY-MM') AS month
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN books b ON b.book_id = oi.book_id
      GROUP BY b.genre, TO_VARCHAR(o.ordered_at, 'YYYY-MM')
    )`,
    pgSql: `SELECT COUNT(*)::bigint AS v FROM (
      SELECT b.genre, TO_CHAR(o.ordered_at, 'YYYY-MM') AS month
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN books b ON b.book_id = oi.book_id
      GROUP BY b.genre, TO_CHAR(o.ordered_at, 'YYYY-MM')
    ) sub`,
  },
];

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("POSTGRES_URL is not set");
  const pg = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  const hana = await hanaConnect();

  let mismatches = 0;
  console.log("Comparing SAP HANA ↔ PostgreSQL…\n");
  for (const check of checks) {
    const [hanaRow] = await hana.exec<Record<string, unknown>>(check.hanaSql);
    const [pgRow] = await pg.unsafe(check.pgSql);
    const hv = String(hanaRow["V"]);
    const pv = String((pgRow as Record<string, unknown>)["v"]);
    const ok = hv === pv;
    if (!ok) mismatches++;
    console.log(
      `${ok ? "  OK      " : "  MISMATCH"}  ${check.label.padEnd(52)} HANA=${hv}  PG=${pv}`
    );
  }

  // If the group counts differ, show exactly which genre×month combinations
  // exist in only one database.
  if (mismatches > 0) {
    console.log("\nDrilling into genre×month differences…");
    const groupSqlHana = `SELECT b.genre || '|' || TO_VARCHAR(o.ordered_at, 'YYYY-MM') AS K
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN books b ON b.book_id = oi.book_id
      GROUP BY b.genre, TO_VARCHAR(o.ordered_at, 'YYYY-MM')`;
    const groupSqlPg = `SELECT b.genre || '|' || TO_CHAR(o.ordered_at, 'YYYY-MM') AS k
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN books b ON b.book_id = oi.book_id
      GROUP BY b.genre, TO_CHAR(o.ordered_at, 'YYYY-MM')`;
    const hanaKeys = new Set(
      (await hana.exec<{ K: string }>(groupSqlHana)).map((r) => r.K)
    );
    const pgKeys = new Set(
      ((await pg.unsafe(groupSqlPg)) as unknown as { k: string }[]).map((r) => r.k)
    );
    const onlyHana = [...hanaKeys].filter((k) => !pgKeys.has(k)).sort();
    const onlyPg = [...pgKeys].filter((k) => !hanaKeys.has(k)).sort();
    if (onlyHana.length > 0) console.log("  Only in HANA:", onlyHana.join(", "));
    if (onlyPg.length > 0) console.log("  Only in PostgreSQL:", onlyPg.join(", "));
  }

  console.log(
    mismatches === 0
      ? "\n✓ Databases are identical — the benchmark premise holds."
      : `\n✗ ${mismatches} mismatch(es). Re-run \`npm run seed\` (one run loads BOTH databases from a single generation pass), then verify again.`
  );

  hana.close();
  await pg.end();
  process.exit(mismatches === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verify failed:", err);
  process.exit(1);
});
