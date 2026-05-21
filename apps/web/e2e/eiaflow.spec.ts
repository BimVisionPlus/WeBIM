import { test, expect } from "@playwright/test";

const TS = Date.now();
const CODE = `DTM-E2E-${TS}`;

test("eiaflow: create → consult → submit authority → approve", async ({ page }) => {
  await page.goto("/eiaflow");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("eiaflow-create-form");
  await form.locator('input[name="code"]').fill(CODE);
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`row-${CODE}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByTestId("action-START_CONSULT").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Tham vấn cộng đồng", { timeout: 10_000 });

  await page.getByTestId(`row-${CODE}`).getByTestId("action-SUBMIT_AUTHORITY").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Cơ quan thẩm định", { timeout: 10_000 });

  page.once("dialog", (d) => d.accept(`QĐ E2E-${TS}/QĐ-STNMT`));
  await page.getByTestId(`row-${CODE}`).getByTestId("action-APPROVE").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Đã phê duyệt", { timeout: 10_000 });
});
