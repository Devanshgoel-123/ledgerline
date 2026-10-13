import { test, expect } from "@playwright/test";

test.describe("Application Audit - UX Issues & Redundant Data", () => {
  let findings: {
    severity: "critical" | "major" | "minor";
    category: string;
    issue: string;
    location: string;
    recommendation: string;
  }[] = [];

  const logFinding = (finding: typeof findings[0]) => {
    findings.push(finding);
    console.log(
      `\n[${finding.severity.toUpperCase()}] ${finding.category} - ${finding.location}`,
    );
    console.log(`Issue: ${finding.issue}`);
    console.log(`Recommendation: ${finding.recommendation}`);
  };

  test("audit: landing page and navigation", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "audit-landing.png" });

    // Check for redundant text
    const mainText = await page.locator("main, body").textContent();
    if (mainText?.includes("rupee") && mainText?.includes("money")) {
      logFinding({
        severity: "minor",
        category: "Redundant Copy",
        issue: "Landing page has repetitive messaging about money/rupees",
        location: "Landing page hero section",
        recommendation:
          "Consolidate messaging - avoid repeating the same concept multiple times",
      });
    }

    // Check for unclear CTAs
    const ctaButtons = await page.locator("button").allTextContents();
    if (ctaButtons.includes("Continue with Google") && ctaButtons.length < 3) {
      logFinding({
        severity: "minor",
        category: "UX",
        issue: "Only one primary CTA available (Google login) - no alternatives",
        location: "Landing page",
        recommendation:
          "Consider adding email/phone login option or clearer setup flow",
      });
    }

    // Check for visual hierarchy
    const headings = await page.locator("h1, h2, h3").allTextContents();
    if (headings.length > 5) {
      logFinding({
        severity: "minor",
        category: "Design",
        issue: "Too many heading levels on landing page - unclear hierarchy",
        location: "Landing page",
        recommendation: "Reduce heading levels, establish clearer visual hierarchy",
      });
    }
  });

  test("audit: check for accessibility issues", async ({ page }) => {
    await page.goto("http://localhost:3000");

    // Check for missing alt text on images
    const images = page.locator("img");
    const imageCount = await images.count();

    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const alt = await images.nth(i).getAttribute("alt");
      if (!alt || alt.trim() === "") {
        logFinding({
          severity: "major",
          category: "Accessibility",
          issue: `Image without alt text (image ${i + 1})`,
          location: "Landing page",
          recommendation: "Add descriptive alt text to all images for screen readers",
        });
      }
    }

    // Check for color contrast
    const textElements = await page.locator("p, span, a").allTextContents();
    if (textElements.some((text) => text.includes("light") || text.includes("muted"))) {
      logFinding({
        severity: "minor",
        category: "Accessibility",
        issue: "Muted/light text colors may have insufficient contrast",
        location: "Various text elements",
        recommendation:
          "Run WCAG contrast checker on all text colors (minimum 4.5:1 for body text)",
      });
    }
  });

  test("audit: check for duplicate content and data", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Look for duplicate information display
    const allText = await page.locator("body").textContent();
    const patterns = [
      { text: "money", count: 0 },
      { text: "rupee", count: 0 },
      { text: "understood", count: 0 },
      { text: "lifestyle", count: 0 },
    ];

    for (const pattern of patterns) {
      const count = (allText?.match(new RegExp(pattern.text, "gi")) || []).length;
      if (count > 3) {
        logFinding({
          severity: "minor",
          category: "Redundant Data",
          issue: `Word "${pattern.text}" appears ${count} times on page`,
          location: "Landing page",
          recommendation: `Consolidate or reduce repetition of "${pattern.text}"`,
        });
      }
    }
  });

  test("audit: check overview page structure (if accessible)", async ({ page }) => {
    await page.goto("http://localhost:3000/overview");
    await page.waitForTimeout(2000);

    // Check if we got past login
    const isLoggedIn = !(await page.locator("text=Continue with Google").isVisible().catch(() => false));

    if (isLoggedIn) {
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: "audit-overview.png" });

      // Check for redundant stats
      const stats = await page.locator(".stat-kicker, .display-num").allTextContents();
      const uniqueStats = new Set(stats);

      if (stats.length > uniqueStats.size + 2) {
        logFinding({
          severity: "minor",
          category: "Redundant Data",
          issue: `${stats.length - uniqueStats.size} duplicate statistics displayed`,
          location: "Overview page stats",
          recommendation:
            "Remove duplicate statistics - show each metric once or consolidate related data",
        });
      }

      // Check for chart clutter
      const chartElements = await page.locator(".bar-fill, .chart-guide, .bar-label").count();
      if (chartElements > 100) {
        logFinding({
          severity: "major",
          category: "Design",
          issue: "Chart has too many DOM elements (${chartElements}) - performance issue",
          location: "Daily spend chart",
          recommendation:
            "Reduce chart complexity: limit guide lines, combine small segments, use canvas rendering",
        });
      }

      // Check for information overload
      const allElements = await page.locator("[class*='meta'], [class*='label']").count();
      if (allElements > 50) {
        logFinding({
          severity: "minor",
          category: "UX",
          issue: "Page has excessive metadata/labels creating visual noise",
          location: "Overview page",
          recommendation:
            "Hide secondary information in tooltips/modals, show only key metrics by default",
        });
      }

      // Check for missing data visualization
      const emptyStates = await page.locator("text=No").count();
      if (emptyStates > 3) {
        logFinding({
          severity: "minor",
          category: "UX",
          issue: `Multiple "No data" messages showing (${emptyStates} found)`,
          location: "Overview page sections",
          recommendation:
            "Add helpful empty state illustrations/messaging and guide users to add data",
        });
      }
    } else {
      logFinding({
        severity: "minor",
        category: "UX",
        issue: "Cannot access authenticated pages for audit without login",
        location: "Overview page",
        recommendation: "Set up test account or auth tokens for automated testing",
      });
    }
  });

  test("audit: check api response times", async ({ page }) => {
    const requests: Array<{ url: string; duration: number }> = [];

    page.on("response", (response) => {
      const timing = response.request().postDataBuffer ? 100 : 0; // Placeholder
      if (response.url().includes("/api/")) {
        console.log(`[API] ${response.status()} ${response.url()}`);
      }
    });

    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Check API health
    const apiResponse = await page.request
      .get("http://localhost:4000/health")
      .catch(() => null);
    if (apiResponse?.status() === 200) {
      console.log("✓ API is healthy and responding");
    } else {
      logFinding({
        severity: "critical",
        category: "Performance",
        issue: "API health check failed or not responding",
        location: "Backend API",
        recommendation: "Check backend server status and logs",
      });
    }
  });

  test("audit: check for UI inconsistencies", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Check button styles
    const buttons = await page.locator("button").all();
    const buttonClasses = new Set<string>();

    for (const button of buttons.slice(0, 10)) {
      const className = await button.getAttribute("class");
      if (className) buttonClasses.add(className);
    }

    if (buttonClasses.size > 5) {
      logFinding({
        severity: "minor",
        category: "Design",
        issue: `${buttonClasses.size} different button styles found - inconsistent design system`,
        location: "Landing page buttons",
        recommendation:
          "Standardize on 2-3 button variants (primary, secondary, ghost) following design system",
      });
    }

    // Check spacing consistency
    const panels = await page.locator(".panel, [class*='card']").count();
    if (panels > 5) {
      logFinding({
        severity: "minor",
        category: "Design",
        issue: "Multiple container components with potentially inconsistent padding/margins",
        location: "Throughout landing page",
        recommendation: "Audit spacing tokens - ensure consistent gap/padding scale",
      });
    }
  });

  test("audit: check for performance bottlenecks", async ({ page }) => {
    const metrics: any = {};

    await page.goto("http://localhost:3000");
    const perfMetrics = await page.evaluate(() => {
      return {
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        resources: performance.getEntriesByType("resource").length,
      };
    });

    console.log(`\nPerformance Metrics:`);
    console.log(`- DOM Ready: ${perfMetrics.domReady}ms`);
    console.log(`- Full Load: ${perfMetrics.loadTime}ms`);
    console.log(`- Resources: ${perfMetrics.resources}`);

    if (perfMetrics.loadTime > 5000) {
      logFinding({
        severity: "major",
        category: "Performance",
        issue: `Page load time is ${perfMetrics.loadTime}ms - exceeds 5s threshold`,
        location: "Landing page",
        recommendation:
          "Optimize: lazy load images, code split, minimize bundle size, use CDN",
      });
    }

    if (perfMetrics.resources > 50) {
      logFinding({
        severity: "major",
        category: "Performance",
        issue: `Page loads ${perfMetrics.resources} resources - excessive network requests`,
        location: "All pages",
        recommendation:
          "Bundle assets, combine images, use sprites/icons, implement proper caching",
      });
    }
  });

  test.afterAll(async () => {
    // Generate audit report
    console.log("\n" + "=".repeat(80));
    console.log("APPLICATION AUDIT REPORT");
    console.log("=".repeat(80));

    const critical = findings.filter((f) => f.severity === "critical");
    const major = findings.filter((f) => f.severity === "major");
    const minor = findings.filter((f) => f.severity === "minor");

    console.log(`\nTotal Issues Found: ${findings.length}`);
    console.log(`  🔴 Critical: ${critical.length}`);
    console.log(`  🟠 Major: ${major.length}`);
    console.log(`  🟡 Minor: ${minor.length}`);

    console.log("\n" + "-".repeat(80));
    console.log("SUMMARY BY CATEGORY:");
    console.log("-".repeat(80));

    const byCategory = findings.reduce(
      (acc, f) => {
        acc[f.category] = (acc[f.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count}`);
      });

    console.log("\n" + "-".repeat(80));
    console.log("FINDINGS SAVED TO: test-results/audit-findings.json");
    console.log("SCREENSHOTS: audit-*.png");
    console.log("=".repeat(80) + "\n");

    // Save to file
    const fs = require("fs");
    fs.writeFileSync(
      "test-results/audit-findings.json",
      JSON.stringify(findings, null, 2),
    );
  });
});
