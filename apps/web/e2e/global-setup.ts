// Global setup — sign in once, persist cookies to storageState.json.
// All tests reuse the session, eliminating per-test login race conditions
// (rate-limit / LOCKED_OUT) under high parallelism.
import { chromium, FullConfig } from "@playwright/test";
import path from "path";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./_helpers";

const STORAGE = path.resolve(__dirname, ".auth.json");

async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3170";
  await page.goto(`${baseURL}/signin`);
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /Đăng nhập/i }).click();
  await page.waitForURL((url) => !url.toString().includes("/signin"), { timeout: 15_000 });
  await ctx.storageState({ path: STORAGE });
  await browser.close();
  process.env.E2E_STORAGE = STORAGE;
}

export default globalSetup;
export { STORAGE };
