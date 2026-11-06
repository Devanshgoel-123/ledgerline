import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run the app's pure code and its SQL on Node. The database tests use
// node:sqlite in place of expo-sqlite (same SQLite, same statements).
export default defineConfig({
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("../backend/src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    execArgv: ["--experimental-sqlite", "--no-warnings"],
  },
});
