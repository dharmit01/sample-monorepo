import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Single .env at the monorepo root
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

const nextConfig: NextConfig = {
  output: "standalone", // self-contained server for the Docker image
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@repo/backend", "@repo/constants", "@repo/database", "@repo/validators"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
