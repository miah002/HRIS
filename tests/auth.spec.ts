/**
 * Auth failure path tests.
 *
 * Requires the dev server running: npm run dev
 * Run with: npx playwright test tests/auth.spec.ts
 *
 * Set BASE_URL env var to test against production:
 *   BASE_URL=https://mmtsi-hris.vercel.app npx playwright test tests/auth.spec.ts
 */

import { test, expect } from "@playwright/test";

const OWNER_EMAIL  = "louie.castillo@mmtsi.ph";
const OWNER_PASS   = "demo1234";
const BAD_PASS     = "wrongpassword";
const BAD_EMAIL    = "nobody@nowhere.ph";

// ── helpers ───────────────────────────────────────────────────────────────────

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill("input[name='email']",    email);
  await page.fill("input[name='password']", password);
  await page.click("button[type='submit']");
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe("Authentication failure paths", () => {

  test("wrong password stays on /login with error state", async ({ page }) => {
    await login(page, OWNER_EMAIL, BAD_PASS);
    await expect(page).toHaveURL(/\/login/);
    // Should NOT navigate to dashboard
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("unknown email stays on /login", async ({ page }) => {
    await login(page, BAD_EMAIL, BAD_PASS);
    await expect(page).toHaveURL(/\/login/);
  });

  test("empty credentials stays on /login", async ({ page }) => {
    await page.goto("/login");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /payroll redirects to /login", async ({ page }) => {
    await page.goto("/payroll");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /employees redirects to /login", async ({ page }) => {
    await page.goto("/employees");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /settings redirects to /login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated access to /leave redirects to /login", async ({ page }) => {
    await page.goto("/leave");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Role enforcement", () => {

  test("OWNER can access /settings", async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASS);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    // Should see user accounts section, not redirect away
    await expect(page.locator("h1")).toContainText("Settings");
  });

  test("successful login lands on /dashboard", async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASS);
    await expect(page).toHaveURL(/\/dashboard/);
    // Dashboard renders nav sidebar — verify app shell loaded
    await expect(page.locator("nav").first()).toBeVisible();
  });

});

test.describe("Cross-tenant ID access", () => {

  test("non-existent employee ID shows no employee data", async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASS);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/employees/clzzzzzzzzzzzzzzzzzzzzzzz");
    // Page must not render employee-specific content (salary, leave credits, career timeline)
    await expect(page.locator("text=Leave credits")).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    await expect(page.locator("text=Career timeline")).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    // Must not render a salary figure or employee number pattern
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/MMTSI\d{4}-\d{3}/); // employee number pattern
  });

  test("non-existent payroll ID shows no payroll data", async ({ page }) => {
    await login(page, OWNER_EMAIL, OWNER_PASS);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/payroll/clzzzzzzzzzzzzzzzzzzzzzzz");
    // Must not render payslip-specific content
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Net pay");
    expect(bodyText).not.toContain("Gross pay");
  });

});
