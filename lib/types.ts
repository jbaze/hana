/** Shared types between the API routes and the client components. */

export interface DbTiming {
  ok: true;
  /** Wall-clock time around the driver call, per measured run, in ms. */
  timingsMs: number[];
  medianMs: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  rowCount: number;
  /**
   * Engine-reported execution time in ms where available
   * (PostgreSQL: median of EXPLAIN ANALYZE "Execution Time";
   * HANA: average from M_SQL_PLAN_CACHE over the measured runs),
   * or null when the engine does not expose it / privileges are missing.
   */
  engineMs: number | null;
}

export interface DbFailure {
  ok: false;
  error: string;
}

export type DbOutcome = DbTiming | DbFailure;

export interface BenchmarkResult {
  queryId: string;
  runs: number;
  hana: DbOutcome;
  postgres: DbOutcome;
}

export interface DashboardData {
  kpis: {
    totalBooks: number;
    totalOrders: number;
    totalRevenue: number;
    totalCustomers: number;
  };
  topGenres: { genre: string; sold: number }[];
  revenueTrend: { month: string; revenue: number }[];
  recentOrders: {
    orderId: number;
    customer: string;
    city: string | null;
    orderedAt: string;
    items: number;
    amount: number;
  }[];
}

export interface BookRow {
  bookId: number;
  title: string;
  author: string;
  genre: string;
  price: number;
  stock: number;
  publishedYear: number | null;
  avgRating: number | null;
}

export interface BooksResponse {
  books: BookRow[];
  total: number;
  page: number;
  pageSize: number;
  genres: string[];
}
