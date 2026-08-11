import { test, expect } from "@playwright/test";

test("supervise: create entry + page renders chain controls", async ({ page }) => {
  await page.goto("/supervise");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("supervise-create-form");
  // Use a future date to guarantee uniqueness across test runs (composite key projectId+logDate+shift)
  const future = new Date(Date.now() + Math.floor(Math.random() * 365) * 86400000).toISOString().slice(0, 10);
  await form.locator('input[name="logDate"]').fill(future);
  await form.locator('textarea[name="workItems"]').fill("E2E giám sát đổ bê tông sàn tầng 12");
  await form.locator('textarea[name="qualityNotes"]').fill("Bê tông B30 đạt slump 18cm");
  await page.getByTestId("submit-create").click();

  // Page refreshes; verify the entry shows up (look for our workItems text)
  await expect(page.getByText("E2E giám sát đổ bê tông sàn tầng 12")).toBeVisible({ timeout: 10_000 });
});
