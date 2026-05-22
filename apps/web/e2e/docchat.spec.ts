import { test, expect } from "@playwright/test";

const TS = Date.now();

test("docchat: index a corpus doc + ask a question", async ({ page }) => {
  await page.goto("/docchat");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("docchat-create-form");
  const title = `E2E TCVN doc ${TS}`;
  await form.locator('input[name="title"]').fill(title);
  await form.locator('textarea[name="body"]').fill("Đây là tài liệu E2E test. Theo TCVN, bê tông B30 có cường độ ≥ 30 MPa ở 28 ngày tuổi. ".repeat(8));
  await page.getByTestId("submit-create").click();

  // The new doc appears in corpus list
  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

  // Ask a question (posts to /api/docchat which logs a DocChatQuery)
  await page.locator('textarea[name="question"]').fill(`E2E câu hỏi ${TS}: bê tông B30 cường độ bao nhiêu?`);
  await page.getByRole("button", { name: /^Hỏi$/ }).click();

  // After the form post + redirect, the query shows in recent queries
  await expect(page.getByText(`E2E câu hỏi ${TS}`)).toBeVisible({ timeout: 10_000 });
});
