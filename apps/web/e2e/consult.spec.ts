import { test, expect } from "@playwright/test";

const TS = Date.now();

test("consult: add timesheet entry", async ({ page }) => {
  await page.goto("/consult");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("consult-create-form");
  const name = `E2E KS ${TS}`;
  const desc = `E2E task ${TS}`;
  await form.locator('input[name="workerName"]').fill(name);
  await form.locator('input[name="description"]').fill(desc);
  await page.getByTestId("submit-create").click();

  await expect(page.getByText(desc)).toBeVisible({ timeout: 10_000 });
});
