import { test, expect } from "@playwright/test";

const TS = Date.now();
const DOC = `E2E-${TS}`;

test("stakeholders: log incoming doc + mark responded", async ({ page }) => {
  await page.goto("/stakeholders");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("stakeholders-create-form");
  await form.locator('input[name="docNo"]').fill(DOC);
  await form.locator('input[name="subject"]').fill(`E2E test subject ${TS}`);
  await page.getByTestId("submit-create").click();

  const row = page.getByTestId(`doc-${DOC}`);
  await expect(row).toBeVisible({ timeout: 10_000 });

  page.once("dialog", (d) => d.accept("E2E đã trả lời"));
  await row.getByTestId("action-RESPOND").click();
  await expect(page.getByTestId(`doc-${DOC}`)).toContainText("✓", { timeout: 10_000 });
});
