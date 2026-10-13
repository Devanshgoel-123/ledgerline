import { test, expect } from "@playwright/test";

test.describe("Overview Page - Chart Design & Investments", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the overview page
    await page.goto("http://localhost:3000/overview");

    // If we see login page, handle it
    const loginButton = page.locator("text=Continue with Google").first();
    if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("Login page detected - test cannot proceed without auth");
      // In a real scenario, we would use stored auth token
      // For now, just proceed with the test as-is
    }

    // Wait for the page to fully load
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  });

  test("should display the overview header with spending summary", async ({ page }) => {
    // Check that the header exists
    const header = page.locator("h2:has-text('October 2026')");
    await expect(header).toBeVisible();

    // Check for spending hint in meta text
    const meta = page.locator(".meta").first();
    await expect(meta).toContainText(/spent.*invested.*received/i);
  });

  test("should display cleaned-up daily spend chart", async ({ page }) => {
    // Wait for the chart to appear
    const chart = page.locator(".bar-chart");
    await expect(chart).toBeVisible();

    // Verify chart has bars
    const bars = page.locator(".bar-fill");
    const barCount = await bars.count();
    expect(barCount).toBeGreaterThan(0);

    // Chart should have a gradient background (cleaned design)
    const chartStyle = await chart.evaluate((el) => {
      return window.getComputedStyle(el).backgroundImage;
    });
    expect(chartStyle).toContain("gradient");
  });

  test("should display investment badge when investments exist", async ({ page }) => {
    // Check for investment badge
    const investmentBadge = page.locator(".investment-badge");

    // If badge exists, it should display properly
    if (await investmentBadge.count() > 0) {
      await expect(investmentBadge).toBeVisible();

      // Should have amount and label
      const label = investmentBadge.locator(".investment-label");
      const amount = investmentBadge.locator(".investment-amount");

      await expect(label).toContainText(/invested/i);
      const amountText = await amount.textContent();
      // Should show currency amount
      expect(amountText).toMatch(/₹/);
    }
  });

  test("should position investment badge at top-right", async ({ page }) => {
    const badge = page.locator(".daily-chart-investments");
    if (await badge.count() > 0) {
      const position = await badge.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return {
          top: rect.top,
          right: window.innerWidth - rect.right,
          bottom: rect.bottom,
          left: rect.left,
        };
      });

      // Badge should be positioned to the right
      expect(position.right).toBeLessThan(50); // Close to right edge
      // Badge should be positioned near top
      expect(position.top).toBeLessThan(150);
    }
  });

  test("should have clean guide lines without clutter", async ({ page }) => {
    const guides = page.locator(".chart-guide");
    const guideCount = await guides.count();

    // Should have at most 2 guides (avg and limit)
    expect(guideCount).toBeLessThanOrEqual(2);

    // Guide lines should be subtle (not too visible)
    if (guideCount > 0) {
      const guideStyle = await guides.first().evaluate((el) => {
        return window.getComputedStyle(el).borderTopColor;
      });
      // Should be a semi-transparent color
      expect(guideStyle).toMatch(/rgba?/);
    }
  });

  test("should have properly styled bars with transition", async ({ page }) => {
    const bar = page.locator(".bar-fill").first();
    if (await bar.count() > 0) {
      const barStyle = await bar.evaluate((el) => {
        return window.getComputedStyle(el);
      });

      // Bars should have smooth transitions
      expect(barStyle.transition).toContain("opacity");

      // Bars should have border-radius (modern look)
      const borderRadius = barStyle.borderRadius;
      expect(borderRadius).not.toBe("0px");
    }
  });

  test("should show different chart for Invested tab", async ({ page }) => {
    // Look for the Invested tab
    const investedTab = page.locator('button[role="tab"]:has-text("Invested")');

    if (await investedTab.count() > 0) {
      await investedTab.click();
      await page.waitForTimeout(500);

      // Should show invested amount
      const investedHeader = page.locator(".stat-kicker").filter({ hasText: /invested/i });
      await expect(investedHeader).toBeVisible();

      // Should have investment timeline if there are investments
      const timeline = page.locator(".payee-timeline");
      if (await timeline.count() > 0) {
        await expect(timeline).toBeVisible();
      }
    }
  });

  test("should switch back to Spending tab", async ({ page }) => {
    // Click Spending tab
    const spendingTab = page.locator('button[role="tab"]:has-text("Spending")');
    await spendingTab.click();
    await page.waitForTimeout(500);

    // Should show the daily spend chart again
    const chart = page.locator(".bar-chart");
    await expect(chart).toBeVisible();
  });

  test("should handle empty chart gracefully", async ({ page }) => {
    // The chart should render even with minimal data
    const chart = page.locator(".bar-chart");
    await expect(chart).toBeVisible();

    // Should have proper minimum height
    const height = await chart.evaluate((el) => {
      return window.getComputedStyle(el).height;
    });
    const heightValue = parseInt(height);
    expect(heightValue).toBeGreaterThan(200);
  });
});
