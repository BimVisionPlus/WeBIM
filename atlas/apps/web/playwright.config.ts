import { defineConfig, devices } from "@playwright/test";
import path from "path";

const STORAGE = path.resolve(__dirname, "e2e/.auth.json");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The test suite shares one Postgres + one dev server. Heavy parallel
  // load causes transient flakes in monitor/paymentrail/portal/qaqc as
  // workers step on each other's seed state. Cap local workers + one retry
  // (CI keeps its two retries). Each spec passes 100% in isolation.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? undefined : 2,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3170",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: STORAGE,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.CI
    ? {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
