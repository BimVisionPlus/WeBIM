import { test, expect } from "@playwright/test";

const TS = Date.now();
const CODE = `BPTC-E2E-${TS}`;

test("methods: create + NT submit → TVGS review → TVGS approve → CDT approve", async ({ page }) => {
  await page.goto("/methods");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("methods-create-form");
  await form.locator('input[name="code"]').fill(CODE);
  await form.locator('input[name="title"]').fill(`E2E BPTC ${TS}`);
  await form.locator('input[name="scope"]').fill("Phạm vi E2E test");
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`bptc-${CODE}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByTestId("action-NT_SUBMIT").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("NT trình", { timeout: 10_000 });

  await page.getByTestId(`bptc-${CODE}`).getByTestId("action-TVGS_REVIEW").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("TVGS rà soát", { timeout: 10_000 });

  await page.getByTestId(`bptc-${CODE}`).getByTestId("action-TVGS_APPROVE").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("CĐT rà soát", { timeout: 10_000 });

  await page.getByTestId(`bptc-${CODE}`).getByTestId("action-CDT_APPROVE").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Đã duyệt", { timeout: 10_000 });
});
