import { test, expect } from "@playwright/test";

const TS = Date.now();

test("hsetrain: issue cert + revoke", async ({ page }) => {
  await page.goto("/hsetrain");
  await page.getByTestId("open-create-form").click();
  const name = `E2E NLĐ ${TS}`;
  await page.getByTestId("hsetrain-create-form").locator('input[name="workerName"]').fill(name);
  await page.getByTestId("submit-create").click();

  const row = page.locator("tr").filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("Hiệu lực");

  page.once("dialog", (d) => d.accept("E2E test revoke"));
  await row.getByTestId("action-REVOKE").click();
  await expect(page.locator("tr").filter({ hasText: name }).first()).toContainText("Thu hồi", { timeout: 10_000 });
});
