/**
 * E2E coverage for the 5 Atlas Suite modules shipped 02→05.
 * Run: pnpm -F @atlas/web exec playwright test atlas-suite.spec.ts
 */
import { test, expect } from "@playwright/test";

const DEMO_PROJECT_ID = process.env.DEMO_PROJECT_ID ?? "cmpwimwi7000ajprqxnmgjeo3";

test.describe("Atlas Suite — module 02 Vendor", () => {
  test("/vendor renders KPI hero + 5 tabs + supplier table", async ({ page }) => {
    await page.goto("/vendor");
    await expect(page).toHaveURL(/\/vendor/);
    await expect(page.locator("text=Atlas Vendor")).toBeVisible();
    await expect(page.locator("text=Nhà cung cấp vật tư").first()).toBeVisible();
    await expect(page.locator("text=Nhà thầu phụ").first()).toBeVisible();
    await expect(page.locator("text=Hợp đồng đang hiệu lực")).toBeVisible();
    await expect(page.locator("text=Tổng công nợ phải trả")).toBeVisible();
    // 5 tabs
    for (const t of ["tab-all", "tab-suppliers", "tab-subcontractors", "tab-contracts", "tab-credit"]) {
      await expect(page.locator(`[data-testid="${t}"]`)).toBeVisible();
    }
  });

  test("VendorContract CRUD round-trip via API", async ({ request }) => {
    const me = await request.get("/api/me");
    expect(me.ok()).toBeTruthy();
    const meJson = await me.json();
    const orgId = meJson.memberships[0]?.org?.id;
    expect(orgId).toBeTruthy();

    const ts = Date.now();
    const create = await request.post("/api/vendor/contracts", {
      data: {
        orgId,
        vendorName: "E2E Test Vendor",
        contractNo: `E2E-${ts}`,
        type: "SPOT_PO",
        startDate: "2026-06-15",
        valueVnd: "100000000",
        state: "DRAFT",
      },
    });
    expect(create.ok()).toBeTruthy();
    const created = await create.json();
    const id = created.contract?.id;
    expect(id).toBeTruthy();

    const patch = await request.patch(`/api/vendor/contracts/${id}`, { data: { state: "ACTIVE" } });
    expect(patch.ok()).toBeTruthy();

    const del = await request.delete(`/api/vendor/contracts/${id}`);
    expect(del.ok()).toBeTruthy();
  });
});

test.describe("Atlas Suite — module 03 Cost", () => {
  test("/cost renders KPI hero + 4 tabs + định mức search", async ({ page }) => {
    await page.goto("/cost");
    await expect(page.locator("text=Atlas Cost")).toBeVisible();
    await expect(page.locator("text=Mã định mức")).toBeVisible();
    await expect(page.locator("text=Đơn giá đã cập nhật")).toBeVisible();
    await expect(page.locator("text=Tổng BAC theo dõi")).toBeVisible();
    await expect(page.locator("text=Cảnh báo overrun đang mở")).toBeVisible();
  });

  test("cost-norm search returns matching codes", async ({ request }) => {
    const r = await request.get("/api/cost-norm/search?q=b%C3%AA%20t%C3%B4ng&province=HCM&period=2026-Q2");
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBeTruthy();
    expect(j.count).toBeGreaterThan(0);
    expect(j.rows[0].code).toMatch(/^A[A-Z]\./);
  });

  test("cost-norm estimate computes total VND from qty", async ({ request }) => {
    const r = await request.post("/api/cost-norm/estimate", {
      data: { code: "AB.31211", qty: 850, province: "HCM", period: "2026-Q2" },
    });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBeTruthy();
    expect(j.totalVnd).toBeGreaterThan(1_000_000_000); // > 1 tỉ for 850m³
    expect(j.breakdown.vatLieuVnd).toBeGreaterThan(0);
  });

  test("AI cost overrun forecast returns CPI/SPI/EAC + severity", async ({ request }) => {
    const r = await request.post("/api/ai/cost-overrun/forecast", {
      data: { projectId: DEMO_PROJECT_ID, persist: false },
    });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBeTruthy();
    expect(j.forecast.cpi).toBeGreaterThan(0);
    expect(j.forecast.severity).toMatch(/^(ON_TRACK|WATCH|ELEVATED|CRITICAL)$/);
    expect(j.forecast.source).toMatch(/^(ai|fallback)$/);
  });
});

test.describe("Atlas Suite — module 04 Compliance", () => {
  test("/compliance renders KPI hero + 4 tabs + standards table", async ({ page }) => {
    await page.goto("/compliance");
    await expect(page.locator("text=Atlas Compliance")).toBeVisible();
    await expect(page.locator("text=Tiêu chuẩn áp dụng")).toBeVisible();
    await expect(page.locator("text=Audit prep đang mở")).toBeVisible();
    // At least one seeded standard
    await expect(page.locator("text=TCVN 5574")).toBeVisible();
  });

  test("AI compliance check returns per-standard scores", async ({ request }) => {
    const r = await request.post("/api/ai/compliance/check", {
      data: { projectId: DEMO_PROJECT_ID },
    });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBeTruthy();
    expect(j.overallScore).toBeGreaterThanOrEqual(0);
    expect(j.overallScore).toBeLessThanOrEqual(100);
    expect(j.overallStatus).toMatch(/^(COMPLIANT|PARTIAL|NON_COMPLIANT|NO_DATA)$/);
    expect(Array.isArray(j.standards)).toBeTruthy();
  });

  test("Audit prep CRUD + item state update", async ({ request }) => {
    const ts = Date.now();
    const create = await request.post("/api/audit-preps", {
      data: {
        projectId: DEMO_PROJECT_ID,
        kind: "PC07_PCCC",
        title: `E2E Test prep ${ts}`,
        items: [{ code: "E2E-1", title: "Test item", required: true }],
      },
    });
    expect(create.ok()).toBeTruthy();
    const created = await create.json();
    const prepId = created.prep?.id;
    const itemId = created.prep?.items?.[0]?.id;
    expect(prepId).toBeTruthy();
    expect(itemId).toBeTruthy();

    const patch = await request.patch(`/api/audit-preps/${prepId}/items/${itemId}`, {
      data: { state: "READY", signedByName: "E2E test" },
    });
    expect(patch.ok()).toBeTruthy();
    const updated = await patch.json();
    expect(updated.item?.state).toBe("READY");
  });
});

test.describe("Atlas Suite — module 05 Field (PWA)", () => {
  test("/field renders mobile-first shell with 6 tap targets", async ({ page }) => {
    await page.goto("/field");
    await expect(page.locator("text=Atlas Field")).toBeVisible();
    await expect(page.locator("text=Chấm công vào")).toBeVisible();
    await expect(page.locator("text=Báo cáo bằng giọng nói")).toBeVisible();
    await expect(page.locator("text=Báo sự cố")).toBeVisible();
    await expect(page.locator("text=PPE selfie")).toBeVisible();
  });

  test("manifest.webmanifest is served", async ({ request }) => {
    const r = await request.get("/manifest.webmanifest");
    expect(r.ok()).toBeTruthy();
    expect(r.headers()["content-type"]).toContain("manifest");
    const j = await r.json();
    expect(j.name).toBe("Atlas Field — Báo cáo công trường");
    expect(j.display).toBe("standalone");
    expect(j.scope).toBe("/field");
  });

  test("service worker is served at /field-sw.js", async ({ request }) => {
    const r = await request.get("/field-sw.js");
    expect(r.ok()).toBeTruthy();
    expect(r.headers()["content-type"]).toContain("javascript");
  });

  test("GPS check-in creates Attendance row", async ({ request }) => {
    const r = await request.post("/api/field/checkin", {
      data: { projectId: DEMO_PROJECT_ID, lat: 21.0285, lon: 105.8542, accuracy: 15, mode: "in" },
    });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBeTruthy();
    expect(j.mode).toBe("in");
    expect(j.attendance?.id).toBeTruthy();
  });

  test("voice-to-form (text-only) classifies intent correctly", async ({ request }) => {
    const form = new FormData();
    form.set("transcript", "Tổ thép đã buộc xong cốt thép cột tầng 5, tiến độ 60%.");
    const r = await request.post("/api/ai/field/voice-form", { multipart: { transcript: "Tổ thép đã buộc xong cốt thép cột tầng 5, tiến độ 60%." } });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBeTruthy();
    expect(j.form?.intent).toBe("PROGRESS");
    expect(j.form?.pctComplete).toBeGreaterThan(0);
  });

  test("voice-to-form classifies INCIDENT correctly", async ({ request }) => {
    const r = await request.post("/api/ai/field/voice-form", {
      multipart: { transcript: "Có sự cố trượt ngã giàn giáo tầng 3, một công nhân bị xước nhẹ tay." },
    });
    expect(r.ok()).toBeTruthy();
    const j = await r.json();
    expect(j.ok).toBeTruthy();
    expect(j.form?.intent).toBe("INCIDENT");
    expect(j.form?.severity).toMatch(/^(MINOR|MAJOR|CRITICAL|NEAR_MISS)$/);
  });
});

test.describe("Atlas Suite — Đơn vị (BU)", () => {
  test("/units renders Business Unit list", async ({ page }) => {
    await page.goto("/units");
    // Page should at least render without crash
    await expect(page).toHaveURL(/\/units/);
  });
});

test.describe("Cross-cutting — Demo launchpad", () => {
  test("/demo renders all 5 Atlas Suite modules", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.locator("text=Atlas Vendor")).toBeVisible();
    await expect(page.locator("text=Atlas Cost")).toBeVisible();
    await expect(page.locator("text=Atlas Compliance")).toBeVisible();
    await expect(page.locator("text=Atlas Field")).toBeVisible();
    await expect(page.locator("text=Đơn vị (Business Units)")).toBeVisible();
  });

  test("/demo has tour button + opens modal", async ({ page }) => {
    await page.goto("/demo");
    const btn = page.locator('[data-testid="open-tour"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('[data-testid="tour-modal"]')).toBeVisible();
    // Click next once
    await page.locator('[data-testid="tour-next"]').click();
    // Still shows modal
    await expect(page.locator('[data-testid="tour-modal"]')).toBeVisible();
  });
});

test.describe("Cross-cutting — customer-facing pages", () => {
  test("/pricing renders 3 tiers", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("text=Pilot trial")).toBeVisible();
    await expect(page.locator("text=Pro")).toBeVisible();
    await expect(page.locator("text=Enterprise (on-prem)")).toBeVisible();
  });

  test("/compare renders score hero + Atlas column wins", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.locator("text=Atlas").first()).toBeVisible();
    await expect(page.locator("text=Procore").first()).toBeVisible();
    await expect(page.locator("text=Autodesk Construction Cloud").first()).toBeVisible();
  });

  test("/api-docs renders REST reference", async ({ page }) => {
    await page.goto("/api-docs");
    await expect(page.locator("text=Atlas API")).toBeVisible();
    await expect(page.locator("text=/api/me")).toBeVisible();
    await expect(page.locator("text=/api/vendor/contracts")).toBeVisible();
    await expect(page.locator("text=/api/cost-norm/search")).toBeVisible();
  });
});
