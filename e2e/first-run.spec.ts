import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * The paths a new user takes on day one, against a throwaway in-memory API.
 * Each step is something that broke or was missing before launch hardening.
 */

const LOCKED_PDF = readFileSync(path.join(__dirname, "..", "backend", "tests", "fixtures", "locked.pdf"));

async function signUp(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Ledgerline" })).toBeVisible();
}

test("sign up with email, explore samples, remove them", async ({ page }) => {
  await signUp(page, `samples-${Date.now()}@example.com`);

  await page.getByRole("button", { name: /Explore with sample data/ }).click();
  await expect(page).toHaveURL(/\/overview/);
  const banner = page.getByText("You are looking at sample data.");
  await expect(banner).toBeVisible();

  // A refresh on a deep link keeps the session and the samples.
  await page.goto("/transactions");
  await expect(banner).toBeVisible();

  await page.getByRole("button", { name: "Remove sample data" }).click();
  await expect(banner).toBeHidden();
});

test("a wrong statement password explains itself and keeps you signed in", async ({ page }) => {
  await signUp(page, `pdf-${Date.now()}@example.com`);
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
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveCount(0);
});

test("download every transaction as a CSV", async ({ page }) => {
  await signUp(page, `export-${Date.now()}@example.com`);
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

test("a dropped connection gives a plain message", async ({ page, context }) => {
  await signUp(page, `offline-${Date.now()}@example.com`);
  await page.getByRole("button", { name: /Explore with sample data/ }).click();
  await expect(page.getByText("You are looking at sample data.")).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Remove sample data" }).click();
  await expect(page.getByText(/Check your internet connection/)).toBeVisible();
  await context.setOffline(false);
});
