import { test, expect } from "@playwright/test";

const TS = Date.now();
const CODE = `NT-E2E-${TS}`;

test("workforce: add worker + check-in", async ({ page }) => {
  await page.goto("/workforce");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("workforce-create-form");
  await form.locator('input[name="workerCode"]').fill(CODE);
  await form.locator('input[name="fullName"]').fill(`E2E NLĐ ${TS}`);
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`worker-${CODE}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByTestId("action-CHECKIN").click();
  // Day counter should bump to 1 (newly created had 0)
  await expect(row).toContainText("1", { timeout: 10_000 });
});
