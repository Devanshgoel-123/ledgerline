import { expect, type Page } from "@playwright/test";
import { API_URL } from "../playwright.config";

/** Headers the web app sends; the local API refuses calls without them. */
export const CLIENT_HEADERS = { "X-Ledgerline-Client": "web" };

/**
 * There is one local profile and no sign-in, so each journey starts by erasing it
 * (what Settings → Erase everything does) and opening the welcome screen.
 */
export async function startFresh(page: Page): Promise<void> {
  const res = await page.request.delete(`${API_URL}/api/me`, { headers: CLIENT_HEADERS });
  expect(res.ok()).toBe(true);
  await page.goto("/");
  // The dev frontend builds a page on its first visit; on a slow CI runner that
  // can take longer than the usual 15 seconds.
  await expect(page.getByRole("heading", { name: "Welcome to Ledgerline" })).toBeVisible({ timeout: 45_000 });
}
