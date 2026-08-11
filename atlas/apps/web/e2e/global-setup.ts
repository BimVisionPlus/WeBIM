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
  // Wait for React hydration before clicking — otherwise the form HTTP-
  // submits with query params and signIn() never fires.
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /Đăng nhập/i }).click();
  await page.waitForURL((url) => !url.toString().includes("/signin"), { timeout: 15_000 });
  // Wait for next-auth session cookie before persisting — page can redirect
  // before the Set-Cookie response is processed, leading to empty storage.
  await page.waitForFunction(
    () => document.cookie.includes("next-auth.session-token") ||
          (window as unknown as { sessionTokenPresent?: boolean }).sessionTokenPresent === true,
    { timeout: 5_000 },
  ).catch(async () => {
    // Fall back: hit a protected route and rely on server-set cookie roundtrip.
    await page.goto(`${baseURL}/paymentrail`);
  });
  // Give the cookie a beat to settle after redirect.
  for (let i = 0; i < 10; i++) {
    const state = await ctx.storageState();
    if (state.cookies.some((c) => c.name === "next-auth.session-token")) break;
    await page.waitForTimeout(500);
  }
  const state = await ctx.storageState();
  if (!state.cookies.some((c) => c.name === "next-auth.session-token")) {
    console.error("[globalSetup] cookies seen:", state.cookies.map((c) => c.name));
    console.error("[globalSetup] page URL after submit:", page.url());
    throw new Error("globalSetup: next-auth.session-token cookie not set — login likely failed");
  }
  await ctx.storageState({ path: STORAGE });
  await browser.close();
  process.env.E2E_STORAGE = STORAGE;
}

export default globalSetup;
export { STORAGE };
