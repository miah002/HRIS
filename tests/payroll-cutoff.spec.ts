/**
 * Payroll cutoff close-gating e2e.
 * Requires: npm run dev (localhost:3000) on a seeded DB (npm run db:seed).
 * The test runs, releases, and closes the active cutoff — a one-way mutation
 * that advances to the next period. It is repeatable (each run advances once).
 */
import { test, expect, type Page } from "@playwright/test";

const OWNER_EMAIL = "owner@demo.ph";
const OWNER_PASS  = "demo1234";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("input[name='email']", OWNER_EMAIL);
  await page.fill("input[name='password']", OWNER_PASS);
  await page.click("button[type='submit']");
  await page.waitForURL(/\/dashboard/);
}

test("close cutoff is blocked until all payslips released, then advances", async ({ page }) => {
  await login(page);
  await page.goto("/payroll");

  const subtitle = page.locator("p", { hasText: /Current cutoff/ });
  const before = (await subtitle.innerText()).trim();

  // Run payroll → creates DRAFT payslips for the active cutoff.
  await page.getByRole("button", { name: /Run payroll|Re-run payroll/ }).click();
  await page.waitForURL(/toast=Payroll\+computed/);

  // Close is blocked while DRAFT payslips exist.
  const closeBtn = page.getByRole("button", { name: "Close cutoff" });
  await expect(closeBtn).toBeDisabled();

  // Release every payslip.
  await page.getByRole("button", { name: /Release all/ }).click();
  await page.waitForURL(/toast=All\+payslips\+released/);

  // Close is now allowed and advances to the next cutoff.
  await expect(closeBtn).toBeEnabled();
  await closeBtn.click();
  await page.waitForURL(/toast=Cutoff/);

  const after = (await subtitle.innerText()).trim();
  expect(after).not.toEqual(before);
});
