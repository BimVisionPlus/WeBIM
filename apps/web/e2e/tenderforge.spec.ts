import { test, expect } from "@playwright/test";

const TS = Date.now();
const CODE = `HSDT-E2E-${TS}`;

test("tenderforge: create HSDT → review → ready → submit → awarded", async ({ page }) => {
  await page.goto("/tenderforge");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("tenderforge-create-form");
  await form.locator('input[name="code"]').fill(CODE);
  await form.locator('input[name="title"]').fill(`E2E HSDT ${TS}`);
  await form.locator('input[name="estimatedValueVnd"]').fill("10000000000");
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`row-${CODE}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByTestId("action-REVIEW").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Đang rà soát", { timeout: 10_000 });

  await page.getByTestId(`row-${CODE}`).getByTestId("action-READY").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Sẵn sàng nộp", { timeout: 10_000 });

  page.once("dialog", (d) => d.accept(`EGP-E2E-${TS}`));
  await page.getByTestId(`row-${CODE}`).getByTestId("action-SUBMIT").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Đã nộp", { timeout: 10_000 });

  await page.getByTestId(`row-${CODE}`).getByTestId("action-AWARDED").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Trúng thầu", { timeout: 10_000 });
});
