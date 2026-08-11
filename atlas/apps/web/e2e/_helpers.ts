// Shared E2E helpers. Auth is established by globalSetup → storageState.json,
// so tests get a pre-authenticated browser context for free.
import { Page, expect } from "@playwright/test";

export const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? "anh.nguyen@cofico.vn";
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "demo1234!";

/**
 * Visit a module's org-level page and screenshot the result. Assumes the test
 * is running with the demo session cookie (from globalSetup storageState).
 */
export async function visitModule(page: Page, slug: string, expectedTitle: RegExp | string) {
  await page.goto(`/${slug}`);
  await expect(page.locator("header")).toContainText(expectedTitle, { timeout: 10_000 });
  await page.screenshot({ path: `e2e-screenshots/${slug}.png`, fullPage: true });
}
