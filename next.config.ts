import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sap/hana-client is a native (C++) module. It must stay external to the
  // server bundle and its binaries must be traced into the serverless output,
  // otherwise Vercel deployments fail at runtime.
  serverExternalPackages: ["@sap/hana-client"],
  outputFileTracingIncludes: {
    "/api/benchmark": ["./node_modules/@sap/hana-client/**/*"],
    "/api/dashboard": ["./node_modules/@sap/hana-client/**/*"],
    "/api/books": ["./node_modules/@sap/hana-client/**/*"],
  },
};

export default nextConfig;
