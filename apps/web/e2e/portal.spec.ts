import { test, expect } from "@playwright/test";

const TS = Date.now();

test("portal: create approval request + CĐT approve", async ({ page }) => {
  await page.goto("/portal");
  await page.getByTestId("open-create-form").click();
  const title = `E2E approval ${TS}`;
  await page.getByTestId("portal-create-form").locator('input[name="title"]').fill(title);
  await page.getByTestId("portal-create-form").locator('textarea[name="summary"]').fill("E2E test summary");
  await page.getByTestId("submit-create").click();

  const row = page.locator("tr").filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(row).toContainText("Chờ duyệt");

  await row.getByTestId("action-APPROVE").click();
  await expect(page.locator("tr").filter({ hasText: title }).first()).toContainText("Đã duyệt", { timeout: 10_000 });
});
