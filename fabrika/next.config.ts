import type { NextConfig } from "next";

const API_ROUTES = [
  "/api/customers",
  "/api/dashboard",
  "/api/materials",
  "/api/orders",
  "/api/production",
  "/api/products",
  "/api/qc",
  "/api/reports",
];

const nextConfig: NextConfig = {
  // better-sqlite3 is a native (C++) module - keep it external to the bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Bundle the pre-seeded database with every API route so the app can
  // self-initialize on Vercel (it is copied to /tmp at runtime for writes).
  outputFileTracingIncludes: Object.fromEntries(
    API_ROUTES.map((r) => [r, ["./data/mebelis.seed.db"]])
  ),
  // The repo root has its own lockfile (the benchmark app); pin the root.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
