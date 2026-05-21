import { test, expect } from "@playwright/test";

const TS = Date.now();
const CODE = `E2E-VM-${TS}`;

test("volumemeter: create → NT submit → TVGS verify → CDT approve", async ({ page }) => {
  await page.goto("/volumemeter");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("volumemeter-create-form");
  await form.locator('input[name="code"]').fill(CODE);
  await form.locator('input[name="title"]').fill("E2E bóc khối lượng cọc");
  await form.locator('input[name="scope"]').fill("Khối A trục 1-8, 245 cọc D800");
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`row-${CODE}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Nháp");

  await row.getByTestId("action-NT_SUBMIT").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("NT đã nộp", { timeout: 10_000 });

  await page.getByTestId(`row-${CODE}`).getByTestId("action-TVGS_VERIFY").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("TVGS xác nhận", { timeout: 10_000 });

  await page.getByTestId(`row-${CODE}`).getByTestId("action-CDT_APPROVE").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("CĐT duyệt", { timeout: 10_000 });
});
