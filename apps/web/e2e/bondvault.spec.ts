import { test, expect } from "@playwright/test";

const TS = Date.now();
const BOND_NO = `E2E-BL-${TS}`;

test("bondvault: create bond → sync bank → release", async ({ page }) => {
  await page.goto("/bondvault");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("bondvault-create-form");
  await form.locator('input[name="bondNumber"]').fill(BOND_NO);
  await form.locator('input[name="beneficiary"]').fill("E2E CĐT Test");
  await form.locator('input[name="amountVnd"]').fill("5000000000");
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`row-${BOND_NO}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(`status-${BOND_NO}`)).toContainText("Đang hiệu lực");

  // Sync bank — non-destructive action; auto-fills no prompt
  await row.getByTestId("action-SYNC_BANK").click();
  await expect(page.getByTestId(`status-${BOND_NO}`)).toContainText("Đang hiệu lực", { timeout: 5_000 });

  // Release
  page.once("dialog", (d) => d.accept("Hoàn thành nghiệm thu"));
  await page.getByTestId(`row-${BOND_NO}`).getByTestId("action-RELEASE").click();
  await expect(page.getByTestId(`status-${BOND_NO}`)).toContainText("Đã giải phóng", { timeout: 10_000 });
});
