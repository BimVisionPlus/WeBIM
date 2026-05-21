import { test, expect } from "@playwright/test";

const TS = Date.now();
const SAMPLE = `LAB-E2E-${TS}`;

test("labreports: create sample + mark FAIL → auto-NCR", async ({ page }) => {
  await page.goto("/labreports");
  await page.getByTestId("open-create-form").click();
  await page.getByTestId("labreports-create-form").locator('input[name="sampleCode"]').fill(SAMPLE);
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`sample-${SAMPLE}`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  page.once("dialog", (d) => d.accept("R28 chỉ đạt 24 MPa < Mác 30"));
  await row.getByTestId("action-FAIL").click();
  await expect(page.getByTestId(`state-${SAMPLE}`)).toContainText("Không đạt", { timeout: 10_000 });
  await expect(page.getByTestId(`state-${SAMPLE}`)).toContainText("NCR auto-tạo", { timeout: 5_000 });
});
