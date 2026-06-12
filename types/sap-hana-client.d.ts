/**
 * Minimal type declarations for @sap/hana-client (the package ships no types).
 * Only the surface used by this project is declared.
 */
declare module "@sap/hana-client" {
  export interface PreparedStatement {
    execBatch(
      rows: unknown[][],
      callback: (err: Error | null, rowsAffected?: number) => void
    ): void;
    exec(
      params: unknown[],
      callback: (err: Error | null, result: unknown) => void
    ): void;
    drop(callback?: (err: Error | null) => void): void;
  }

  export interface Connection {
    connect(
      params: Record<string, unknown>,
      callback: (err: Error | null) => void
    ): void;
    exec(
      sql: string,
      params: unknown[],
      callback: (err: Error | null, result: unknown) => void
    ): void;
    prepare(
      sql: string,
      callback: (err: Error | null, stmt: PreparedStatement) => void
    ): void;
    disconnect(callback?: (err: Error | null) => void): void;
    state(): "connected" | "disconnected" | "new";
  }

  export function createConnection(): Connection;

  const hanaClient: { createConnection(): Connection };
  export default hanaClient;
}
