import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { MAIL_OUTBOX } from "../playwright.config";
import { hdfcStatement, iciciStatement, textPdf } from "../backend/tests/helpers/statementPdf";

/**
 * Launch acceptance journeys. Expected money figures are worked out here from the
 * statement rows, independently of the app's own calculation code.
 * Run against a disposable Postgres with E2E_DATABASE_URL to prove persistence.
 */

const PASSWORD = "a-long-password";

const SEPTEMBER = [
  { date: "2026-09-01", narration: "UPI-SWIGGY-swiggy@icici-ICIC0000001", amount: 500, type: "debit" as const },
  { date: "2026-09-02", narration: "NEFT CR-ACME PAYROLL", amount: 50000, type: "credit" as const },
  { date: "2026-09-03", narration: "UPI-SHOP-shop@okaxis-UTIB0000001", amount: 250, type: "debit" as const },
  { date: "2026-09-04", narration: "UPI-CHAI-chai@ybl-YESB0000001", amount: 120, type: "debit" as const },
];
const EXPECTED_SPENT = SEPTEMBER.filter((row) => row.type === "debit").reduce((sum, row) => sum + row.amount, 0);
const EXPECTED_FOOD = 500; // Swiggy is a shared food app
const statementPdf = () => hdfcStatement(10_000, SEPTEMBER);

const inr = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

async function signUp(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Ledgerline" })).toBeVisible();
}

async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function uploadStatement(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "hdfc-september.pdf",
    mimeType: "application/pdf",
    buffer: statementPdf(),
  });
  await page.getByRole("button", { name: "Import statement" }).click();
}

test("import a statement: totals match, repeats are refused, data survives a new session", async ({
  page,
  browser,
}) => {
  const email = `import-${Date.now()}@example.com`;
  await signUp(page, email);
  await page.getByRole("button", { name: /Import your transactions/ }).click();
  await uploadStatement(page);

  const report = page.getByRole("status", { name: "Statement import result" });
  await expect(report).toContainText("Statement imported");
  await expect(report).toContainText(/New payments added\s*4/);
  await report.getByRole("button", { name: "View September 2026" }).click();
  await expect(page).toHaveURL(/\/overview/);
  await expect(page.getByLabel("Month")).toHaveValue("2026-09");
  await expect(page.getByText(`${inr(EXPECTED_SPENT)} spent`)).toBeVisible();

  await page.goto("/lifestyle");
  await expect(page.getByRole("button", { name: new RegExp(`^Food: ${inr(EXPECTED_FOOD)}`) })).toBeVisible();

  await page.goto("/transactions");
  for (const row of SEPTEMBER) {
    await expect(page.getByText(inr(row.amount), { exact: false }).first()).toBeVisible();
  }

  // The same file again adds nothing and says so.
  await page.goto("/import");
  await uploadStatement(page);
  await expect(page.getByRole("status", { name: "Statement import result" })).toContainText("Already imported");
  await page.goto("/overview");
  await expect(page.getByText(`${inr(EXPECTED_SPENT)} spent`)).toBeVisible();

  // A brand-new browser session sees the same data.
  const fresh = await browser.newContext();
  const second = await fresh.newPage();
  await signIn(second, email);
  await expect(second).toHaveURL(/\/overview/);
  await second.getByLabel("Month").fill("2026-09");
  await expect(second.getByText(`${inr(EXPECTED_SPENT)} spent`)).toBeVisible();
  await fresh.close();
});

test("files that are not statements are refused clearly and add nothing", async ({ page }) => {
  await signUp(page, `badfile-${Date.now()}@example.com`);
  await page.getByRole("button", { name: /Import your transactions/ }).click();
  const fileInput = page.locator('input[type="file"]');
  const importButton = page.getByRole("button", { name: "Import statement" });

  await fileInput.setInputFiles({ name: "photo.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a pdf at all") });
  await importButton.click();
  await expect(page.locator(".form-error")).toContainText(/not a valid PDF/i);

  await fileInput.setInputFiles({
    name: "letter.pdf",
    mimeType: "application/pdf",
    buffer: textPdf(["Dear customer,", "Thank you for banking with us."]),
  });
  await importButton.click();
  await expect(page.locator(".form-error")).toContainText("Ledgerline can read HDFC and ICICI bank statement PDFs");

  await expect(page).toHaveURL(/\/import/);
  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/import/); // still no data, so the app keeps you on Import
});

test("an ICICI statement imports with the right totals", async ({ page }) => {
  const rows = [
    { date: "2026-09-12", particulars: ["UPI/ASHA RAO/XX0001@axl/Sent using/CANARA", "BAN/6000/PTM0001", "0000000001ASHA RAO"], amount: 75, type: "debit" as const },
    { date: "2026-09-13", particulars: ["UPI/RBP WINE A/XX0003@ybl/Sent using/YES", "BANK", "L/600000/PTM0003", "000000003RBP WINE"], amount: 2605, type: "debit" as const },
    { date: "2026-09-14", particulars: ["UPI/KIRAN DAS/XX0002@oksbi/UPI/State", "Bank/6000/SBI0002"], amount: 400, type: "credit" as const },
    { date: "2026-09-23", particulars: ["SMSChgsApr26-Jun26+GST"], amount: 56.64, type: "debit" as const },
  ];
  const spent = rows.filter((row) => row.type === "debit").reduce((sum, row) => sum + row.amount, 0);

  await signUp(page, `icici-${Date.now()}@example.com`);
  await page.getByRole("button", { name: /Import your transactions/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "icici-september.pdf",
    mimeType: "application/pdf",
    buffer: iciciStatement(7072.75, rows),
  });
  await page.getByRole("button", { name: "Import statement" }).click();
  const report = page.getByRole("status", { name: "Statement import result" });
  await expect(report).toContainText(/New payments added\s*4/);
  await report.getByRole("button", { name: "View September 2026" }).click();
  // The summary line shows whole rupees.
  await expect(page.getByText(`${inr(Math.round(spent))} spent`)).toBeVisible();
  await expect(page.getByText(`${inr(400)} in`).first()).toBeVisible();
});

test("a typed-in expense moves the total by exactly its amount", async ({ page }) => {
  await signUp(page, `manual-${Date.now()}@example.com`);
  await page.getByRole("button", { name: /Import your transactions/ }).click();
  await uploadStatement(page);
  await page.getByRole("button", { name: "View September 2026" }).click();
  await expect(page.getByText(`${inr(EXPECTED_SPENT)} spent`)).toBeVisible();

  await page.goto("/transactions");
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("What").fill("Lunch (office) ₹");
  await page.getByLabel("Amount").fill("75");
  await page.getByLabel("Date").fill("2026-09-05");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Lunch (office) ₹").first()).toBeVisible();

  await page.goto("/overview");
  await page.getByLabel("Month").fill("2026-09");
  await expect(page.getByText(`${inr(EXPECTED_SPENT + 75)} spent`)).toBeVisible();
});

test("delete the account, then the same email can start again", async ({ page }) => {
  const email = `leaver-${Date.now()}@example.com`;
  await signUp(page, email);
  await page.getByRole("button", { name: /Explore with sample data/ }).click();
  await expect(page.getByText("You are looking at sample data.")).toBeVisible();

  await page.goto("/settings");
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete account…" }).click();
  await page.getByRole("button", { name: "Confirm delete account" }).click();
  await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();

  await signIn(page, email);
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();

  await signUp(page, email);
});

test("forgot password: the emailed link sets a new password", async ({ page, browser }) => {
  const email = `forgot-${Date.now()}@example.com`;
  await signUp(page, email);

  const fresh = await browser.newContext();
  const login = await fresh.newPage();
  await login.goto("/");
  await login.getByRole("button", { name: "Forgot password?" }).click();
  await login.getByLabel("Email").fill(email);
  await login.getByRole("button", { name: "Send reset link" }).click();
  await expect(login.getByRole("status")).toContainText("a reset link is on its way");

  await expect.poll(() => existsSync(MAIL_OUTBOX) && readFileSync(MAIL_OUTBOX, "utf8").includes(email)).toBe(true);
  const mail = readFileSync(MAIL_OUTBOX, "utf8").trim().split("\n").map((line) => JSON.parse(line) as { to: string; text: string })
    .filter((item) => item.to === email).at(-1)!;
  const link = mail.text.match(/https?:\/\/\S+reset-password\?code=\S+/)![0];

  await login.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await login.getByLabel("New password").fill("brand-new-password");
  await login.getByLabel("Type it again").fill("brand-new-password");
  await login.getByRole("button", { name: "Save new password" }).click();
  await expect(login.getByRole("heading", { name: "Welcome to Ledgerline" })).toBeVisible();

  // The old password no longer works; the new one does.
  const other = await browser.newContext();
  const check = await other.newPage();
  await signIn(check, email);
  await expect(check.getByText("Incorrect email or password.")).toBeVisible();
  await check.getByLabel("Password", { exact: true }).fill("brand-new-password");
  await check.getByRole("button", { name: "Sign in" }).click();
  await expect(check.getByRole("heading", { name: "Welcome to Ledgerline" })).toBeVisible();
  await fresh.close();
  await other.close();
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
]) {
  test(`every main page fits a ${viewport.name} screen`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-login.png`), fullPage: true });
    await signUp(page, `${viewport.name}-${Date.now()}@example.com`);
    await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-welcome.png`), fullPage: true });
    await page.getByRole("button", { name: /Explore with sample data/ }).click();
    await expect(page.getByText("You are looking at sample data.")).toBeVisible();

    for (const path of ["/overview", "/lifestyle", "/apps", "/people", "/transactions", "/import", "/settings"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      await page.screenshot({
        path: testInfo.outputPath(`${viewport.name}${path.replace("/", "-")}.png`),
        fullPage: true,
      });
      expect(overflow, `${path} scrolls sideways on a ${viewport.name}`).toBeLessThanOrEqual(1);
      if (path === "/apps") {
        // Long sections used to stay invisible on phones until scrolled far enough.
        await expect(page.locator("article").first()).toBeInViewport();
      }
    }
  });
}
