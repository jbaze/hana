import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native (C++) module - keep it external to the bundle.
  serverExternalPackages: ["better-sqlite3"],
  // The repo root has its own lockfile (the benchmark app); pin the root.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
