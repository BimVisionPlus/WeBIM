import { test, expect } from "@playwright/test";

const TS = Date.now();
const CODE = `SET-E2E-${TS % 100000}`;

test("monitor: create point + record measurement → alert level computed", async ({ page }) => {
  await page.goto("/monitor");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("monitor-create-form");
  await form.locator('input[name="pointCode"]').fill(CODE);
  // thresholdWarn=8, thresholdAlert=15 are the form defaults
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`point-${CODE}`);
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Record a measurement above the ALERT threshold (15) → expect "Nguy hiểm"
  page.once("dialog", (d) => d.accept("18.5"));
  await row.getByTestId("action-MEASURE").click();
  await expect(page.getByTestId(`level-${CODE}`)).toContainText("Nguy hiểm", { timeout: 10_000 });
});
