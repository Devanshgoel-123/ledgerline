import { test, expect } from "@playwright/test";

test("debug: check page structure", async ({ page }) => {
  await page.goto("http://localhost:3000/overview");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  // Take a screenshot
  await page.screenshot({ path: "overview-screenshot.png" });

  // Log all h2 headers
  const h2s = await page.locator("h2").allTextContents();
  console.log("H2 headers:", h2s);

  // Log all buttons with role=tab
  const tabs = await page.locator('button[role="tab"]').allTextContents();
  console.log("Tabs:", tabs);

  // Check for bar-chart
  const hasChart = await page.locator(".bar-chart").count();
  console.log("Bar charts found:", hasChart);

  // Check for investment badge
  const hasBadge = await page.locator(".investment-badge").count();
  console.log("Investment badges found:", hasBadge);

  // Log some content
  const content = await page.content();
  if (content.includes("Spending")) {
    console.log("✓ Page contains 'Spending'");
  }
});
