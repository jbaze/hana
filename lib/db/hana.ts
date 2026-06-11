import hanaClient from "@sap/hana-client";

/**
 * Thin promisified wrapper around @sap/hana-client.
 *
 * The native client is callback-based and a single Connection is not safe for
 * concurrent statements, so we keep a tiny lazy pool. Connections are created
 * on demand, reused across requests (module scope survives between serverless
 * invocations on a warm instance) and validated before reuse.
 */

export interface HanaConnection {
  exec<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  execBatch(sql: string, rows: unknown[][]): Promise<void>;
  close(): void;
}

type RawConnection = ReturnType<typeof hanaClient.createConnection>;

function connParams() {
  const host = process.env.HANA_HOST;
  const port = process.env.HANA_PORT ?? "443";
  const user = process.env.HANA_USER;
  const password = process.env.HANA_PASSWORD;
  if (!host || !user || !password) {
    throw new Error(
      "HANA connection is not configured (HANA_HOST / HANA_USER / HANA_PASSWORD)"
    );
  }
  return {
    serverNode: `${host}:${port}`,
    uid: user,
    pwd: password,
    encrypt: process.env.HANA_ENCRYPT ?? "true",
    sslValidateCertificate: process.env.HANA_SSL_VALIDATE_CERT ?? "false",
    // Fail fast instead of hanging when the trial instance is stopped.
    connectTimeout: 10_000,
    communicationTimeout: 120_000,
  };
}

function wrap(raw: RawConnection): HanaConnection {
  return {
    exec<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return new Promise((resolve, reject) => {
        raw.exec(sql, params, (err: Error | null, result: unknown) => {
          if (err) reject(err);
          // Non-SELECT statements resolve with an affected-row count.
          else resolve(Array.isArray(result) ? (result as T[]) : []);
        });
      });
    },
    execBatch(sql: string, rows: unknown[][]): Promise<void> {
      return new Promise((resolve, reject) => {
        raw.prepare(sql, (prepErr: Error | null, stmt) => {
          if (prepErr) return reject(prepErr);
          stmt.execBatch(rows, (execErr: Error | null) => {
            stmt.drop(() => undefined);
            if (execErr) reject(execErr);
            else resolve();
          });
        });
      });
    },
    close() {
      try {
        raw.disconnect();
      } catch {
        // ignore — connection may already be gone
      }
    },
  };
}

function connect(): Promise<RawConnection> {
  return new Promise((resolve, reject) => {
    const raw = hanaClient.createConnection();
    raw.connect(connParams(), (err: Error | null) => {
      if (err) reject(err);
      else resolve(raw);
    });
  });
}

const pool: RawConnection[] = [];

async function acquire(): Promise<RawConnection> {
  while (pool.length > 0) {
    const raw = pool.pop()!;
    if (raw.state() === "connected") return raw;
    try {
      raw.disconnect();
    } catch {
      // stale connection — discard
    }
  }
  return connect();
}

function release(raw: RawConnection) {
  if (pool.length < 4 && raw.state() === "connected") pool.push(raw);
  else
    try {
      raw.disconnect();
    } catch {
      // ignore
    }
}

/** Run `fn` with a pooled HANA connection. */
export async function withHana<T>(
  fn: (conn: HanaConnection) => Promise<T>
): Promise<T> {
  const raw = await acquire();
  try {
    return await fn(wrap(raw));
  } catch (err) {
    // On any error assume the connection may be poisoned and drop it.
    try {
      raw.disconnect();
    } catch {
      // ignore
    }
    throw err;
  } finally {
    if (raw.state() === "connected") release(raw);
  }
}

/** Convenience one-shot query. */
export async function hanaQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return withHana((conn) => conn.exec<T>(sql, params));
}

/** Open a dedicated (non-pooled) connection — used by the seed script. */
export async function hanaConnect(): Promise<HanaConnection> {
  return wrap(await connect());
}
