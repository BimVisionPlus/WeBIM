// E2E PaymentRail — create a hồ sơ thanh toán, walk it through workflow.
import { test, expect } from "@playwright/test";

const TS = Date.now();
const CODE = `E2E-PR-${TS}`;

test("paymentrail: create → NT sign → TVGS sign → CDT approve", async ({ page }) => {
  await page.goto("/paymentrail");

  // Open create form
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("paymentrail-create-form");
  await expect(form).toBeVisible();

  // Fill (project select stays at default first option)
  await form.locator('input[name="code"]').fill(CODE);
  await form.locator('input[name="workDoneVnd"]').fill("5000000000");
  await form.locator('input[name="cumulativeWorkVnd"]').fill("50000000000");
  await form.locator('input[name="contractRef"]').fill(`HĐ E2E ${TS}`);
  await page.getByTestId("submit-create").click();

  // Row must appear with state "Nháp"
  const row = page.getByTestId(`row-${CODE}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("Nháp");

  // NT_SIGN
  await row.getByTestId("action-NT_SIGN").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("NT đã ký", { timeout: 10_000 });

  // TVGS_SIGN
  await page.getByTestId(`row-${CODE}`).getByTestId("action-TVGS_SIGN").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("TVGS đã ký", { timeout: 10_000 });

  // CDT_APPROVE
  await page.getByTestId(`row-${CODE}`).getByTestId("action-CDT_APPROVE").click();
  await expect(page.getByTestId(`state-${CODE}`)).toContainText("CĐT duyệt", { timeout: 10_000 });

  // Final screenshot for proof
  await page.screenshot({ path: `e2e-screenshots/paymentrail-workflow.png`, fullPage: true });
});

test("paymentrail: reject path with note", async ({ page }) => {
  const REJ_CODE = `E2E-REJ-${TS}`;
  await page.goto("/paymentrail");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("paymentrail-create-form");
  await form.locator('input[name="code"]').fill(REJ_CODE);
  await form.locator('input[name="workDoneVnd"]').fill("1000000000");
  await form.locator('input[name="cumulativeWorkVnd"]').fill("10000000000");
  await page.getByTestId("submit-create").click();

  await expect(page.getByTestId(`row-${REJ_CODE}`)).toBeVisible({ timeout: 10_000 });

  // Auto-handle the prompt dialog
  page.once("dialog", (d) => d.accept("Hồ sơ thiếu BBNT KL"));
  await page.getByTestId(`row-${REJ_CODE}`).getByTestId("action-REJECT").click();
  await expect(page.getByTestId(`state-${REJ_CODE}`)).toContainText("Từ chối", { timeout: 10_000 });
});
