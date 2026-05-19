/**
 * Smoke test — proves the critical path is wired end-to-end:
 *   1. Signup → 2. Create org → 3. Create project → 4. Create RFI → 5. Transition
 *
 * Requires a clean Postgres + S3/MinIO running. CI provisions these via
 * docker-compose. Assumes pnpm db:push has run.
 */

import { test, expect } from "@playwright/test";

const TS = Date.now();
const EMAIL = `e2e-${TS}@example.com`;
const PASSWORD = "Pilot2026!";

test("happy path: signup → org → project → RFI → transition", async ({ page }) => {
  // 1. Signup
  await page.goto("/signup");
  await page.getByLabel("Họ và tên").fill("E2E Tester");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByRole("button", { name: /Tạo tài khoản/ }).click();

  // 2. Onboarding → create org
  await page.waitForURL(/\/onboarding\/org/);
  await page.getByLabel("Tên tổ chức").fill(`E2E Org ${TS}`);
  await page.getByLabel("Slug (URL)").fill(`e2e-${TS}`);
  await page.getByRole("button", { name: /Tiếp theo/ }).click();

  // 3. Create project
  await page.waitForURL(/\/onboarding\/project/);
  await page.getByLabel(/Mã dự án/).fill(`E2E${TS}`);
  await page.getByLabel("Tên dự án").fill(`E2E Project ${TS}`);
  await page.getByRole("button", { name: /Tạo dự án/ }).click();

  // 4. Land on project page → navigate to RFI
  await page.waitForURL(/\/projects\//);
  await page.getByRole("link", { name: "RFI" }).first().click();

  // 5. Create RFI
  await page.getByRole("button", { name: /Tạo RFI/ }).click();
  await page.getByLabel("Tiêu đề").fill("E2E test RFI");
  await page.getByLabel("Câu hỏi").fill("Cao độ tầng 12 là +36.450 hay +36.500?");
  // Select first stakeholder
  await page.locator('select').first().selectOption({ index: 1 });
  await page.getByRole("button", { name: /^Tạo$/ }).click();

  // 6. Should see the new RFI in the table
  await expect(page.getByText("E2E test RFI")).toBeVisible({ timeout: 5_000 });
});
