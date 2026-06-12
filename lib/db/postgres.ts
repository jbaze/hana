import postgres from "postgres";

/**
 * Singleton postgres.js client. `prepare: false` keeps it compatible with
 * transaction-mode poolers (Supabase pgbouncer, Neon pooled endpoints).
 */

declare global {
  // eslint-disable-next-line no-var
  var __pgClient: ReturnType<typeof postgres> | undefined;
}

export function getPg(): ReturnType<typeof postgres> {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("PostgreSQL connection is not configured (POSTGRES_URL)");
  }
  if (!globalThis.__pgClient) {
    globalThis.__pgClient = postgres(url, {
      max: 5,
      idle_timeout: 30,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return globalThis.__pgClient;
}

/** Run a raw SQL string (the benchmark queries are full SQL text). */
export async function pgQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sqlText: string
): Promise<T[]> {
  const sql = getPg();
  const rows = await sql.unsafe(sqlText);
  return rows as unknown as T[];
}
