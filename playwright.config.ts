import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys against a throwaway stack: an in-memory API and a dev frontend on
 * their own ports. Values set here override backend/.env, so tests never reach real data,
 * a real database, a mailbox, or Telegram.
 */
const API_PORT = 4100;
const WEB_PORT = 3100;
const WEB_URL = `http://localhost:${WEB_PORT}`;
export const API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: [
    {
      // Not "npm run dev": tsx watch runs the server as a child that outlives Playwright's stop.
      command: "npx tsx src/index.ts",
      cwd: "backend",
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        PORT: String(API_PORT),
        // Point E2E_DATABASE_URL at a disposable Postgres to test persistence for real.
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? "memory",
        TEST_DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
        APP_SECRET: "e2e-only-app-secret-0123456789",
        ENCRYPTION_KEY: "0".repeat(64),
        CORS_ORIGINS: WEB_URL,
        TELEGRAM_BOT_TOKEN: "",
        TELEGRAM_BOT_USERNAME: "",
        TELEGRAM_WEBHOOK_SECRET: "",
        DISABLE_MAIL_JOBS: "1",
      },
    },
    {
      command: `npx next dev --port ${WEB_PORT}`,
      cwd: "frontend",
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { NEXT_PUBLIC_API_URL: API_URL, NEXT_PUBLIC_LEDGERLINE_MODE: "app" },
    },
  ],
});
