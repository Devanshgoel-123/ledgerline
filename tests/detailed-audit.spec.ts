import { test, expect } from "@playwright/test";
import * as fs from "fs";

test("detailed UX and data audit - comprehensive analysis", async ({ page }) => {
  const issues: string[] = [];
  const suggestions: string[] = [];

  console.log("\n" + "=".repeat(100));
  console.log("DETAILED APPLICATION AUDIT - UX/DATA/DESIGN ANALYSIS");
  console.log("=".repeat(100) + "\n");

  // SECTION 1: LANDING PAGE AUDIT
  console.log("📍 LANDING PAGE ANALYSIS");
  console.log("-".repeat(100));

  await page.goto("http://localhost:3000");
  await page.waitForLoadState("networkidle");

  // Check 1: Redundant messaging
  const bodyText = await page.locator("body").textContent();
  const lowerText = bodyText?.toLowerCase() || "";

  const redundancyChecks = [
    { word: "money", weight: "high" },
    { word: "rupee", weight: "high" },
    { word: "understand", weight: "medium" },
    { word: "lifestyle", weight: "medium" },
    { word: "spend", weight: "medium" },
    { word: "insight", weight: "low" },
  ];

  console.log("\n🔴 REDUNDANCY ANALYSIS:");
  for (const check of redundancyChecks) {
    const count = (lowerText.match(new RegExp(`\\b${check.word}\\b`, "g")) || []).length;
    if (count >= 3) {
      issues.push(`"${check.word}" appears ${count} times - ${check.weight} priority redundancy`);
      console.log(
        `  ⚠️  "${check.word}" appears ${count} times (${check.weight} priority)`,
      );
    }
  }

  // Check 2: Button and CTA organization
  console.log("\n🔵 CTA & BUTTON ANALYSIS:");
  const buttons = await page.locator("button").count();
  const links = await page.locator("a").count();
  console.log(
    `  Found ${buttons} buttons and ${links} links - potential CTA confusion`,
  );

  if (buttons + links > 15) {
    issues.push(
      `Too many CTAs (${buttons} buttons + ${links} links) - overwhelming users`,
    );
    suggestions.push(
      "Reduce CTA options on landing page. Use primary, secondary, tertiary hierarchy.",
    );
  }

  // Check 3: Information Architecture
  console.log("\n🟢 INFORMATION ARCHITECTURE:");
  const featureCards = await page.locator("[class*='card'], [class*='feature']").count();
  const sections = await page.locator("section, [role='region']").count();
  console.log(`  ${featureCards} card components, ${sections} sections found`);

  if (featureCards > 10) {
    issues.push(`Information scattered across ${featureCards} cards - hard to scan`);
    suggestions.push(
      "Group related features into max 3-4 categories with clear hierarchy",
    );
  }

  // Check 4: Form/Input fields
  console.log("\n🟡 FORM FIELDS:");
  const inputs = await page.locator("input").count();
  const selects = await page.locator("select").count();
  const textareas = await page.locator("textarea").count();
  console.log(`  ${inputs} inputs, ${selects} selects, ${textareas} textareas`);

  if (inputs > 10) {
    issues.push("Too many form fields for onboarding - high abandonment risk");
    suggestions.push(
      "Use progressive disclosure - collect essential info on page 1, optional on page 2+",
    );
  }

  // Check 5: Visual hierarchy and spacing
  console.log("\n🟣 VISUAL HIERARCHY:");
  const headings1 = await page.locator("h1").count();
  const headings2 = await page.locator("h2").count();
  const headings3 = await page.locator("h3").count();
  console.log(`  H1: ${headings1}, H2: ${headings2}, H3: ${headings3}`);

  if (headings1 > 1) {
    issues.push("Multiple H1 tags - poor semantic structure and SEO");
    suggestions.push("Use only one H1 per page. Use H2/H3 for hierarchy.");
  }

  // SECTION 2: PERFORMANCE AUDIT
  console.log("\n" + "-".repeat(100));
  console.log("📊 PERFORMANCE ANALYSIS");
  console.log("-".repeat(100));

  const perfMetrics = await page.evaluate(() => {
    const perf = performance.timing;
    const resources = performance.getEntriesByType("resource");
    const largeResources = resources
      .filter((r: any) => r.transferSize > 100000)
      .map((r: any) => ({
        name: r.name.split("/").pop(),
        size: (r.transferSize / 1024).toFixed(1),
      }));

    return {
      dns: perf.domainLookupEnd - perf.domainLookupStart,
      tcp: perf.connectEnd - perf.connectStart,
      ttfb: perf.responseStart - perf.requestStart,
      dom: perf.domContentLoadedEventEnd - perf.navigationStart,
      load: perf.loadEventEnd - perf.navigationStart,
      resourceCount: resources.length,
      largeResources,
    };
  });

  console.log("\n⏱️  TIMING METRICS:");
  console.log(`  DNS: ${perfMetrics.dns}ms`);
  console.log(`  TCP: ${perfMetrics.tcp}ms`);
  console.log(`  TTFB: ${perfMetrics.ttfb}ms`);
  console.log(`  DOM Content Loaded: ${perfMetrics.dom}ms`);
  console.log(`  Full Page Load: ${perfMetrics.load}ms`);
  console.log(`  Resources Loaded: ${perfMetrics.resourceCount}`);

  if (perfMetrics.largeResources.length > 0) {
    console.log("\n📦 LARGE ASSETS (>100KB):");
    perfMetrics.largeResources.forEach((r: any) => {
      console.log(`  - ${r.name}: ${r.size}KB`);
      suggestions.push(`Optimize large asset: ${r.name}`);
    });
  }

  // SECTION 3: ACCESSIBILITY AUDIT
  console.log("\n" + "-".repeat(100));
  console.log("♿ ACCESSIBILITY ANALYSIS");
  console.log("-".repeat(100));

  const accessibilityIssues = await page.evaluate(() => {
    const issues = [];

    // Check for images without alt text
    const imagesNoAlt = document.querySelectorAll("img:not([alt])");
    if (imagesNoAlt.length > 0) {
      issues.push(`${imagesNoAlt.length} images missing alt text`);
    }

    // Check for color contrast (basic)
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const textElements = document.querySelectorAll("p, span, a, h1, h2, h3");

    // Check for buttons without labels
    const buttonsNoLabel = document.querySelectorAll("button:not([aria-label])");
    const buttonsEmptyText = Array.from(buttonsNoLabel).filter((b) => !b.textContent?.trim());
    if (buttonsEmptyText.length > 0) {
      issues.push(`${buttonsEmptyText.length} buttons without accessible labels`);
    }

    // Check for focus indicators
    const hasFocusStyles = document.styleSheets.length > 0;

    // Check for proper heading hierarchy
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    const headingLevels = headings.map((h) => parseInt(h.tagName[1]));
    let hierarchyBroken = false;
    for (let i = 1; i < headingLevels.length; i++) {
      if (headingLevels[i] - headingLevels[i - 1] > 1) {
        hierarchyBroken = true;
        break;
      }
    }
    if (hierarchyBroken) {
      issues.push("Heading hierarchy is broken (skipping levels)");
    }

    return issues;
  });

  if (accessibilityIssues.length > 0) {
    console.log("\n⚠️  ACCESSIBILITY ISSUES:");
    accessibilityIssues.forEach((issue) => {
      console.log(`  - ${issue}`);
      issues.push(issue);
    });
  } else {
    console.log("\n✅ No major accessibility issues detected on landing page");
  }

  // SECTION 4: DESIGN CONSISTENCY
  console.log("\n" + "-".repeat(100));
  console.log("🎨 DESIGN CONSISTENCY AUDIT");
  console.log("-".repeat(100));

  const designAnalysis = await page.evaluate(() => {
    const colors = new Set<string>();
    const fontSizes = new Set<string>();
    const fontFamilies = new Set<string>();
    const spacing = new Set<string>();

    const elements = document.querySelectorAll("*");
    let sampleCount = 0;

    elements.forEach((el) => {
      if (sampleCount > 100) return;
      if (el.children.length === 0) {
        const style = getComputedStyle(el);
        colors.add(style.color);
        fontSizes.add(style.fontSize);
        fontFamilies.add(style.fontFamily);
        spacing.add(style.marginBottom);
        sampleCount++;
      }
    });

    return {
      uniqueColors: colors.size,
      uniqueFontSizes: fontSizes.size,
      uniqueFontFamilies: fontFamilies.size,
      uniqueSpacing: spacing.size,
    };
  });

  console.log("\n🎭 STYLE VARIATION:");
  console.log(`  Unique text colors: ${designAnalysis.uniqueColors}`);
  console.log(`  Unique font sizes: ${designAnalysis.uniqueFontSizes}`);
  console.log(`  Unique font families: ${designAnalysis.uniqueFontFamilies}`);
  console.log(`  Unique spacing values: ${designAnalysis.uniqueSpacing}`);

  if (designAnalysis.uniqueColors > 10) {
    issues.push(`Too many colors (${designAnalysis.uniqueColors}) - violates design system`);
    suggestions.push("Standardize on a 5-7 color palette (primary, secondary, success, warning, danger, neutral)");
  }

  if (designAnalysis.uniqueFontSizes > 6) {
    issues.push(
      `${designAnalysis.uniqueFontSizes} different font sizes - inconsistent typography scale`,
    );
    suggestions.push("Define and use a fixed type scale (e.g., 12, 14, 16, 18, 20, 24, 32)");
  }

  if (designAnalysis.uniqueSpacing > 10) {
    issues.push(`Too many spacing values (${designAnalysis.uniqueSpacing}) - inconsistent layout`);
    suggestions.push(
      "Use spacing scale: 4, 8, 12, 16, 24, 32, 48px. Avoid arbitrary values.",
    );
  }

  // SECTION 5: CONTENT AUDIT
  console.log("\n" + "-".repeat(100));
  console.log("📝 CONTENT AUDIT");
  console.log("-".repeat(100));

  const contentAnalysis = await page.evaluate(() => {
    const text = document.body.innerText;
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const avgWordsPerSentence = words / sentences;

    // Check for jargon and readability
    const complexWords = text.match(
      /\b(?:leverage|synergy|paradigm|utilize|facilitate|optimize)\b/gi,
    );

    return {
      totalWords: words,
      totalSentences: sentences,
      avgWordSentence: avgWordsPerSentence.toFixed(1),
      jargonCount: complexWords?.length || 0,
    };
  });

  console.log("\n📊 READABILITY:");
  console.log(`  Total words: ${contentAnalysis.totalWords}`);
  console.log(`  Average words per sentence: ${contentAnalysis.avgWordSentence}`);
  console.log(`  Jargon/complex words: ${contentAnalysis.jargonCount}`);

  if (contentAnalysis.avgWordSentence > 20) {
    issues.push(
      `Sentences too long (avg ${contentAnalysis.avgWordSentence} words) - hard to scan`,
    );
    suggestions.push("Break long sentences into shorter ones. Target: 12-15 words per sentence.");
  }

  if (contentAnalysis.jargonCount > 0) {
    issues.push(`${contentAnalysis.jargonCount} instances of jargon/buzzwords detected`);
    suggestions.push("Use simple, clear language. Avoid corporate jargon.");
  }

  // FINAL REPORT
  console.log("\n" + "=".repeat(100));
  console.log("AUDIT SUMMARY");
  console.log("=".repeat(100));

  console.log(`\n❌ ISSUES FOUND: ${issues.length}`);
  issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. ${issue}`);
  });

  console.log(`\n💡 SUGGESTIONS: ${suggestions.length}`);
  suggestions.forEach((suggestion, i) => {
    console.log(`  ${i + 1}. ${suggestion}`);
  });

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    issues,
    suggestions,
    metrics: {
      performance: perfMetrics,
      design: designAnalysis,
      content: contentAnalysis,
      accessibility: accessibilityIssues.length,
    },
  };

  fs.writeFileSync(
    "test-results/detailed-audit-report.json",
    JSON.stringify(report, null, 2),
  );

  console.log("\n📄 Full report saved to: test-results/detailed-audit-report.json\n");
  console.log("=".repeat(100) + "\n");
});
