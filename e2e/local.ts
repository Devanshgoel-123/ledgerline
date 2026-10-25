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
  await expect(page.getByRole("heading", { name: "Welcome to Ledgerline" })).toBeVisible();
}
