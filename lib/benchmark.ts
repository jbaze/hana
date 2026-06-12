import { withHana } from "@/lib/db/hana";
import { getPg } from "@/lib/db/postgres";
import { BenchQuery } from "@/lib/queries";
import { BenchmarkResult, DbOutcome, DbTiming } from "@/lib/types";

/**
 * Benchmark engine. Honesty rules:
 *  - every number comes from a real execution performed right now;
 *  - timing wraps ONLY the driver call (no JSON serialization, no rendering);
 *  - one warm-up run per database is executed and discarded;
 *  - engine-reported timings are captured where the engine exposes them and
 *    reported as null otherwise — never estimated or fabricated.
 */

export const DEFAULT_RUNS = Number(process.env.BENCHMARK_RUNS ?? 5);
export const MAX_RUNS = 20;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function stats(timingsMs: number[], rowCount: number, engineMs: number | null): DbTiming {
  return {
    ok: true,
    timingsMs: timingsMs.map(round2),
    medianMs: round2(median(timingsMs)),
    meanMs: round2(timingsMs.reduce((a, b) => a + b, 0) / timingsMs.length),
    minMs: round2(Math.min(...timingsMs)),
    maxMs: round2(Math.max(...timingsMs)),
    rowCount,
    engineMs: engineMs === null ? null : round2(engineMs),
  };
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* ------------------------------- PostgreSQL ------------------------------ */

async function benchPostgres(query: BenchQuery, runs: number): Promise<DbOutcome> {
  try {
    const sql = getPg();

    // Warm-up run, discarded (connection setup, cold caches, plan cache).
    await sql.unsafe(query.sqlPostgres);

    const timings: number[] = [];
    let rowCount = 0;
    for (let i = 0; i < runs; i++) {
      const start = process.hrtime.bigint();
      const rows = await sql.unsafe(query.sqlPostgres);
      const end = process.hrtime.bigint();
      timings.push(Number(end - start) / 1e6);
      rowCount = rows.length;
    }

    // Engine-reported timing: EXPLAIN (ANALYZE) executes the query inside the
    // engine and reports its own "Execution Time" (excludes network and driver).
    let engineMs: number | null = null;
    try {
      const engineTimes: number[] = [];
      for (let i = 0; i < runs; i++) {
        const rows = await sql.unsafe(
          `EXPLAIN (ANALYZE, FORMAT JSON) ${query.sqlPostgres}`
        );
        const plan = (rows[0] as Record<string, unknown>)["QUERY PLAN"];
        const parsed = typeof plan === "string" ? JSON.parse(plan) : plan;
        const execTime = (parsed as { "Execution Time": number }[])[0]?.["Execution Time"];
        if (typeof execTime === "number") engineTimes.push(execTime);
      }
      if (engineTimes.length > 0) engineMs = median(engineTimes);
    } catch {
      engineMs = null; // EXPLAIN unavailable — report nothing rather than guess
    }

    return stats(timings, rowCount, engineMs);
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

/* --------------------------------- SAP HANA ------------------------------ */

interface PlanCacheCounters {
  totalTimeMicro: number;
  count: number;
}

/**
 * Read cumulative execution counters for a tagged statement from
 * M_SQL_PLAN_CACHE. Sampled before and after the measured runs, the delta
 * yields the engine-side average execution time for exactly those runs.
 * Returns null when the monitoring view is not readable (missing privilege).
 */
async function hanaPlanCacheCounters(
  exec: (sql: string) => Promise<Record<string, unknown>[]>,
  tag: string
): Promise<PlanCacheCounters | null> {
  try {
    const rows = await exec(
      `SELECT COALESCE(SUM(TOTAL_EXECUTION_TIME), 0) AS TOTAL_TIME,
              COALESCE(SUM(EXECUTION_COUNT), 0) AS CNT
       FROM M_SQL_PLAN_CACHE
       WHERE STATEMENT_STRING LIKE '%bench:${tag}%'
         AND STATEMENT_STRING NOT LIKE '%M_SQL_PLAN_CACHE%'`
    );
    if (rows.length === 0) return null;
    return {
      totalTimeMicro: Number(rows[0]["TOTAL_TIME"]),
      count: Number(rows[0]["CNT"]),
    };
  } catch {
    return null;
  }
}

async function benchHana(query: BenchQuery, runs: number): Promise<DbOutcome> {
  try {
    return await withHana(async (conn) => {
      const exec = (sql: string) => conn.exec(sql);

      // Warm-up run, discarded.
      await exec(query.sqlHana);

      const before = await hanaPlanCacheCounters(exec, query.id);

      const timings: number[] = [];
      let rowCount = 0;
      for (let i = 0; i < runs; i++) {
        const start = process.hrtime.bigint();
        const rows = await exec(query.sqlHana);
        const end = process.hrtime.bigint();
        timings.push(Number(end - start) / 1e6);
        rowCount = rows.length;
      }

      let engineMs: number | null = null;
      if (before !== null) {
        const after = await hanaPlanCacheCounters(exec, query.id);
        if (after !== null) {
          const dTime = after.totalTimeMicro - before.totalTimeMicro;
          const dCount = after.count - before.count;
          if (dCount > 0 && dTime >= 0) engineMs = dTime / dCount / 1000;
        }
      }

      return stats(timings, rowCount, engineMs);
    });
  } catch (err) {
    return { ok: false, error: errMessage(err) };
  }
}

/* --------------------------------- Runner -------------------------------- */

export async function runBenchmark(
  query: BenchQuery,
  runs: number
): Promise<BenchmarkResult> {
  const clamped = Math.max(1, Math.min(MAX_RUNS, Math.floor(runs)));
  // Sequential on purpose: running both databases concurrently from one
  // process would let them contend for app-server CPU and skew the timings.
  const hana = await benchHana(query, clamped);
  const postgres = await benchPostgres(query, clamped);
  return { queryId: query.id, runs: clamped, hana, postgres };
}
