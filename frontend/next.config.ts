import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the production Docker image (copies a minimal Node server).
  output: "standalone",
  // The repo root has its own package-lock.json (Playwright). Without this, Next guesses the
  // repo root as the project root and cannot resolve the frontend's CSS imports in dev.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // The session lives in localStorage, so no other site may frame these pages.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
