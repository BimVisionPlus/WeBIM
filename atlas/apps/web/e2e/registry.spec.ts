import { test, expect } from "@playwright/test";

test("registry: blacklist + unblacklist round-trip", async ({ page }) => {
  await page.goto("/registry");
  await page.waitForLoadState("networkidle");

  // Find a non-blacklisted profile by locating the first row whose status badge is "OK"
  const okStatus = page.locator('[data-testid^="status-"]').filter({ hasText: /^OK$/ }).first();
  await expect(okStatus).toBeVisible({ timeout: 10_000 });
  const profileId = await okStatus.getAttribute("data-testid").then((v) => v?.replace("status-", "") ?? "");
  expect(profileId).not.toBe("");
  const row = page.getByTestId(`profile-${profileId}`);
  const status = page.getByTestId(`status-${profileId}`);

  // Blacklist
  page.once("dialog", (d) => d.accept("E2E test blacklist reason"));
  await row.getByTestId("action-BLACKLIST").click();
  await expect(status).toContainText("Blacklist", { timeout: 10_000 });

  // Unblacklist
  await page.getByTestId(`profile-${profileId}`).getByTestId("action-UNBLACKLIST").click();
  await expect(page.getByTestId(`status-${profileId}`)).toContainText("OK", { timeout: 10_000 });
});
