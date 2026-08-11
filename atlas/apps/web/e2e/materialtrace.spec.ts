import { test, expect } from "@playwright/test";

const TS = Date.now();
const LOT = `LOT-E2E-${TS}`;

test("materialtrace: receive lot → test → accept", async ({ page }) => {
  await page.goto("/materialtrace");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("materialtrace-create-form");
  await form.locator('input[name="lotCode"]').fill(LOT);
  await form.locator('input[name="materialName"]').fill("E2E test thép D16");
  await form.locator('input[name="manufacturer"]').fill("Pomina");
  await form.locator('input[name="quantity"]').fill("10");
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`lot-${LOT}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByTestId("action-TEST").click();
  await expect(page.getByTestId(`state-${LOT}`)).toContainText("Đang thí nghiệm", { timeout: 10_000 });

  await page.getByTestId(`lot-${LOT}`).getByTestId("action-ACCEPT").click();
  await expect(page.getByTestId(`state-${LOT}`)).toContainText("Chấp thuận", { timeout: 10_000 });
});
