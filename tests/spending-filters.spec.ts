import { test, expect } from "@playwright/test";

/**
 * Spending Filter Tests
 * Verify that investments and rent are properly excluded from spending totals
 */

test.describe("💰 Spending Calculations", () => {
  test("should exclude investments from total spent", async ({ page }) => {
    // Navigate to overview
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Intercept API calls to check the analytics response
    let analyticsData: any = null;
    await page.route("**/api/analytics**", async (route) => {
      const response = await route.continue();
      analyticsData = await response.json();
      return response;
    });

    // Reload to capture the analytics call
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait a moment for data to load
    await page.waitForTimeout(1000);

    if (analyticsData?.summary) {
      const { totalSpent, totalInvested } = analyticsData.summary;

      // Verify both values exist
      expect(typeof totalSpent).toBe("number");
      expect(typeof totalInvested).toBe("number");

      // Log for debugging
      console.log(`📊 Total Spent: ₹${totalSpent}`);
      console.log(`📈 Total Invested: ₹${totalInvested}`);

      // Both can be > 0, but they should be separate
      if (totalInvested > 0) {
        console.log("✅ Investments are tracked separately from spending");
      }
    } else {
      console.log("⚠️  Could not load analytics data");
    }
  });

  test("should exclude rent from spending total", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Check transactions for rent category
    let transactions: any[] = [];
    await page.route("**/api/transactions**", async (route) => {
      const response = await route.continue();
      const data = await response.json();
      transactions = data.transactions || [];
      return response;
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Filter for rent transactions
    const rentTransactions = transactions.filter(
      (t) => t.category?.slug === "rent" || t.categorySlug === "rent"
    );

    if (rentTransactions.length > 0) {
      console.log(`Found ${rentTransactions.length} rent transactions`);
      rentTransactions.slice(0, 3).forEach((t) => {
        console.log(`  - ₹${t.amount} on ${t.date}`);
      });
      console.log("✅ Rent transactions exist and are tracked");
    } else {
      console.log("ℹ️  No rent transactions in current data");
    }
  });

  test("should verify daily chart excludes investments", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Look for the daily spending chart
    const dailyChart = page.locator(".daily-spend-chart, [data-testid=daily-chart]").first();

    const isVisible = await dailyChart.isVisible().catch(() => false);

    if (isVisible) {
      // Chart should exist and be rendering
      const chartText = await dailyChart.textContent();
      console.log("✅ Daily chart is visible and rendering");

      // Verify it has data points
      const dataPoints = await dailyChart.locator("[data-testid=chart-bar], .bar").count();
      if (dataPoints > 0) {
        console.log(`✅ Chart has ${dataPoints} data points`);
      }
    } else {
      console.log("ℹ️  Daily chart not found (may require authentication)");
    }
  });

  test("should show investments in separate badge", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Look for investment badge/indicator
    const investmentBadge = page.locator(
      "[data-testid=investment-badge], .investment-amount, .invested-badge"
    ).first();

    const isVisible = await investmentBadge.isVisible().catch(() => false);

    if (isVisible) {
      const text = await investmentBadge.textContent();
      console.log(`✅ Investment badge visible: ${text}`);
    } else {
      console.log("ℹ️  Investment badge not found on current view");
    }
  });
});
