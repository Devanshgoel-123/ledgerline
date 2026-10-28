import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { API_URL } from "../playwright.config";
import { CLIENT_HEADERS, startFresh } from "./local";

/**
 * The paths a new user takes on day one, against a throwaway in-memory API.
 * Each step is something that broke or was missing before launch hardening.
 */

const LOCKED_PDF = readFileSync(path.join(__dirname, "..", "backend", "tests", "fixtures", "locked.pdf"));

test("open it, explore samples, remove them", async ({ page }) => {
  await startFresh(page);

  await page.getByRole("button", { name: /Explore with sample data/ }).click();
  await expect(page).toHaveURL(/\/overview/);
  const banner = page.getByText("You are looking at sample data.");
  await expect(banner).toBeVisible();

  // A refresh on a deep link keeps the samples.
  await page.goto("/transactions");
  await expect(banner).toBeVisible();

  await page.getByRole("button", { name: "Remove sample data" }).click();
  await expect(banner).toBeHidden();
});

test("a wrong statement password explains itself and stays on Import", async ({ page }) => {
  await startFresh(page);
  await page.getByRole("button", { name: /Import your transactions/ }).click();
  await expect(page).toHaveURL(/\/import/);

  await page.locator('input[type="file"]').setInputFiles({
    name: "statement.pdf",
    mimeType: "application/pdf",
    buffer: LOCKED_PDF,
  });
  await page.getByPlaceholder("Statement password").fill("wrong-password");
  await page.getByRole("button", { name: "Import statement" }).click();

  await expect(page.getByText(/did not open the statement/)).toBeVisible();
  await expect(page).toHaveURL(/\/import/);
});

test("download every transaction as a CSV", async ({ page }) => {
  await startFresh(page);
  await page.getByRole("button", { name: /Explore with sample data/ }).click();
  await expect(page.getByText("You are looking at sample data.")).toBeVisible();

  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download all transactions (CSV)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ledgerline-transactions-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = readFileSync(await download.path(), "utf8").replace(/^﻿/, "");
  expect(text.split("\r\n")[0]).toMatch(/^Date,Time,Type,Amount/);
  expect(text).toContain(",yes");
});

test("when the API stops answering, the message says how to start it", async ({ page, context }) => {
  await startFresh(page);
  await page.getByRole("button", { name: /Explore with sample data/ }).click();
  await expect(page.getByText("You are looking at sample data.")).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Remove sample data" }).click();
  await expect(page.getByText(/Make sure Ledgerline is running/)).toBeVisible();
  await context.setOffline(false);
});

test("the API refuses calls that do not come from the local web app", async ({ request }) => {
  // Another website open in the same browser cannot send this header without passing CORS.
  expect((await request.get(`${API_URL}/api/imports/export`)).status()).toBe(403);
  expect((await request.get(`${API_URL}/api/imports/export`, { headers: CLIENT_HEADERS })).status()).toBe(200);
  const evil = await request.fetch(`${API_URL}/api/me`, {
    method: "OPTIONS",
    headers: {
      origin: "https://evil.example",
      "access-control-request-method": "DELETE",
      "access-control-request-headers": "x-ledgerline-client",
    },
  });
  expect(evil.headers()["access-control-allow-origin"]).toBeUndefined();
});
