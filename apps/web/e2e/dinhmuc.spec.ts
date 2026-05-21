import { test, expect } from "@playwright/test";

const TS = Date.now();
const CODE = `ZX.${String(TS).slice(-5)}`;

test("dinhmuc: create custom norm + update price via API", async ({ page, request }) => {
  await page.goto("/dinhmuc");
  await page.getByTestId("open-create-form").click();
  const form = page.getByTestId("dinhmuc-create-form");
  await form.locator('input[name="code"]').fill(CODE);
  await form.locator('input[name="title"]').fill(`E2E custom norm ${TS}`);
  await page.getByTestId("submit-create").click();

  // Verify via API: norm exists with correct code + source = CUSTOM
  const lookup = await request.get(`/api/dinhmuc?code=${CODE}`);
  expect(lookup.ok()).toBe(true);
  const body = await lookup.json();
  expect(body.code).toBe(CODE);
  expect(body.source).toBe("CUSTOM");

  // Upsert price for the new norm (Q2-2026 HCM 1.5M)
  const price = await request.post(`/api/dinhmuc/${body.id}/price`, {
    data: { province: "HCM", period: "2026-Q2", unitPriceVnd: "1500000", source: "Test" },
  });
  expect(price.ok()).toBe(true);

  // Verify price came through
  const recheck = await request.get(`/api/dinhmuc?code=${CODE}&province=HCM`);
  const j2 = await recheck.json();
  expect(j2.prices?.[0]?.unitPriceVnd).toBe("1500000");
});
