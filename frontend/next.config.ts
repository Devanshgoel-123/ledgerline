import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the production Docker image (copies a minimal Node server).
  output: "standalone",
  // The repo root has its own package-lock.json (Playwright). Without this, Next guesses the
  // repo root as the project root and cannot resolve the frontend's CSS imports in dev.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
};

export default nextConfig;
