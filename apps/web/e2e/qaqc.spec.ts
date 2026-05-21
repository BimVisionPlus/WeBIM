import { test, expect } from "@playwright/test";

const TS = Date.now();

test("qaqc: create check → mark PASS", async ({ page }) => {
  await page.goto("/qaqc");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("qaqc-create-form");
  const loc = `E2E Cọc P${TS % 1000}`;
  await form.locator('input[name="location"]').fill(loc);
  await page.getByTestId("submit-create").click();

  // Find our new pending check row by its location text
  const row = page.locator("tr").filter({ hasText: loc }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByTestId("action-PASS").click();
  await expect(row).toContainText("Đạt", { timeout: 10_000 });
});

test("qaqc: create check → mark FAIL → auto-NCR created", async ({ page, request }) => {
  await page.goto("/qaqc");
  await page.getByTestId("open-create-form").click();
  const loc = `E2E Cột C${TS % 1000}`;
  await page.getByTestId("qaqc-create-form").locator('input[name="location"]').fill(loc);
  await page.getByTestId("submit-create").click();

  const row = page.locator("tr").filter({ hasText: loc }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  page.once("dialog", (d) => d.accept("Cường độ R28 không đạt"));
  await row.getByTestId("action-FAIL").click();
  await expect(row).toContainText("Không đạt", { timeout: 10_000 });
});
