/**
 * Demo capture — drives Playwright through every Atlas AEC module + records
 * a PNG per scene into `docs/demo-screens/`.
 *
 * Run:
 *   1. Bring infra up: `pnpm infra:up && pnpm db:push && pnpm db:seed`
 *   2. Start the app:   `pnpm dev` (waits for http://localhost:3000)
 *   3. Capture:         `pnpm tsx scripts/capture-demo.ts`
 *
 * Override the base URL with BASE_URL=http://localhost:3030 if you start the
 * server on a different port. Seed data is created by `pnpm db:seed`; this
 * script also pushes a handful of BIM elements + a BoQ via SQL so DrawBridge
 * and CostPulse have content to show.
 */

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://localhost:3030";
const OUT = path.resolve(__dirname, "..", "docs", "demo-screens");
const EMAIL = "anh.nguyen@cofico.vn";
const PASSWORD = "demo1234!";

fs.mkdirSync(OUT, { recursive: true });

type Scene = {
  id: string;
  title: string;
  url: (projectId: string) => string;
  /** Optional pre-screenshot action (click runners, etc.) */
  before?: (page: import("playwright").Page) => Promise<void>;
  /** ms to settle before screenshot */
  settleMs?: number;
};

const scenes: Scene[] = [
  { id: "01-signin", title: "Đăng nhập", url: () => "/signin" },
  { id: "02-home", title: "Trang chủ — dự án + nav 6 tab mới", url: () => "/" },
  { id: "03-winwork", title: "WinWork — bidding overview", url: () => "/winwork" },
  { id: "04-winwork-tenders", title: "WinWork — cơ hội đấu thầu (3 nguồn)", url: () => "/winwork/tenders" },
  { id: "05-winwork-bids", title: "WinWork — hồ sơ dự thầu", url: () => "/winwork/bids" },
  {
    id: "06-winwork-bid-detail",
    title: "WinWork — bid detail + 9-rule Luật ĐT 22/2023 engine",
    url: () => "/winwork/bids",
    before: async (page) => {
      // Pick the READY bid (the one with seeded bond + compliance) — fall back to first.
      const href = await page.evaluate(() => {
        const rows = [...document.querySelectorAll("tbody tr")];
        const readyRow = rows.find((tr) => /READY/.test(tr.textContent ?? ""));
        const inRow = readyRow?.querySelector('a[href^="/winwork/bids/"]');
        if (inRow) return inRow.getAttribute("href");
        const fallback = [...document.querySelectorAll("a")].find(
          (a) => /\/winwork\/bids\/[a-z0-9]/.test(a.getAttribute("href") ?? ""),
        );
        return fallback?.getAttribute("href") ?? null;
      });
      if (href) {
        await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(800);
        await page
          .getByRole("button", { name: /Chạy kiểm tra/i })
          .click()
          .catch(() => undefined);
        await page.waitForTimeout(2500);
      }
    },
  },
  { id: "07-winwork-bonds", title: "WinWork — bảo lãnh tracker", url: () => "/winwork/bonds" },
  { id: "08-codeguard", title: "CodeGuard — NĐ 15/2021 dossier + TCVN library", url: (p) => `/projects/${p}/codeguard` },
  {
    id: "09-drawbridge",
    title: "DrawBridge — BIM elements + clash detection",
    url: (p) => `/projects/${p}/drawbridge`,
    before: async (page) => {
      await page.waitForLoadState("domcontentloaded");
      await page.getByRole("button", { name: /Chạy clash/i }).click().catch(() => undefined);
      await page.waitForTimeout(2500);
    },
  },
  {
    id: "10-siteeye",
    title: "SiteEye — Weather alert + Incident reporter",
    url: (p) => `/projects/${p}/siteeye`,
    before: async (page) => {
      await page.waitForLoadState("domcontentloaded");
      await page.getByRole("button", { name: /Cập nhật/i }).click().catch(() => undefined);
      await page.waitForTimeout(3500);
    },
  },
  { id: "11-costpulse", title: "CostPulse — EVM + BoQ + price index", url: (p) => `/projects/${p}/costpulse` },
  { id: "12-portfolio", title: "ProjectPulse — 5-dim risk heatmap", url: () => "/portfolio" },
  { id: "13-trust", title: "Trust — public model cards (Layer 4)", url: () => "/trust" },
  { id: "14-pricing", title: "Pricing — 4 self-serve plans (Layer 8)", url: () => "/pricing" },
  {
    id: "15-catalog",
    title: "Catalog — Cấu kiện · vật tư · NCC + form thêm cấu kiện",
    url: () => "/catalog",
    before: async (page) => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const btn = page.locator('[data-testid="open-create-form"]').first();
      await btn.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
      await btn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(600);
    },
  },
  {
    id: "16-schedule",
    title: "Schedule — Tiến độ + đường găng + form thêm task",
    url: () => "/schedule",
    before: async (page) => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const btn = page.locator('[data-testid="open-create-form"]').first();
      await btn.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
      await btn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(600);
    },
  },
  {
    id: "17-permitflow",
    title: "PermitFlow — Xin GPXD NĐ 15/2021 + form tạo hồ sơ",
    url: () => "/permitflow",
    before: async (page) => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const btn = page.locator('[data-testid="open-create-form"]').first();
      await btn.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
      await btn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(600);
    },
  },
  {
    id: "18-pccc",
    title: "PCCC — Thẩm duyệt NĐ 136/2020 + form tạo hồ sơ",
    url: () => "/pccc",
    before: async (page) => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const btn = page.locator('[data-testid="open-create-form"]').first();
      await btn.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
      await btn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(600);
    },
  },
  {
    id: "19-bidradar",
    title: "BidRadar — Săn gói thầu + form thêm cơ hội",
    url: () => "/bidradar",
    before: async (page) => {
      await page.waitForLoadState("networkidle").catch(() => undefined);
      const btn = page.locator('[data-testid="open-create-form"]').first();
      await btn.waitFor({ state: "visible", timeout: 8000 }).catch(() => undefined);
      await btn.click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(600);
    },
  },
];

async function main() {
  // Optional: best-effort push of demo BIM elements + BoQ so 09/11 have content
  try {
    seedDemoExtras();
  } catch (e) {
    console.warn("(demo-extras seed skipped:", (e as Error).message, ")");
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
  const page = await ctx.newPage();

  // Sign in
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "01-signin.png"), fullPage: false });
  await page.locator("input[type=email]").fill(EMAIL);
  await page.locator("input[type=password]").fill(PASSWORD);
  await page.locator("button[type=submit]").click();
  await page.waitForURL((u) => !u.toString().includes("/signin"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle").catch(() => undefined);

  // Resolve the seeded project id once
  const projectId = await page.evaluate(async () => {
    const r = await fetch("/api/me");
    if (!r.ok) return "";
    return "";
  });
  // Easier: navigate home and grab the first project link
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const pid = await page.evaluate(() => {
    // Prefer the seeded primary project (VHGP-S9) which has BoQ + dossier + clashes
    const links = [...document.querySelectorAll("a")]
      .map((a) => a.getAttribute("href") ?? "")
      .filter((h) => /^\/projects\/[A-Za-z0-9_]+$/.test(h));
    // Pick the longest id (the cuid-style one is longer than 'proj_fpt')
    links.sort((a, b) => b.length - a.length);
    return links[0]?.split("/").pop() ?? "";
  });
  if (!pid) throw new Error("could not resolve seeded project id from home page");
  console.log("project id:", pid);

  for (const s of scenes.slice(1)) {
    const url = `${BASE}${s.url(pid)}`;
    console.log("→", s.id, url);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    if (s.before) await s.before(page);
    await page.waitForTimeout(s.settleMs ?? 800);
    await page.screenshot({ path: path.join(OUT, `${s.id}.png`), fullPage: true });
  }

  await browser.close();
  console.log("✅ Captured", scenes.length, "scenes into", OUT);
}

function seedDemoExtras() {
  // Push 8 BIM elements + a 9-line BoQ via psql in docker. Idempotent.
  const sql = `
    INSERT INTO "ModelElement" (id, "modelId", "elementId", name, category, discipline, level, zone, "ifcType", bbox, "createdAt")
    SELECT v.id, m.id, v."elementId", v.name, v.category, v.discipline, v.level, v.zone, v.ifctype, v.bbox, NOW()
    FROM (VALUES
      ('elem_col_c12', 'GLB-001', 'Cot C-12 tang 5',     'Cot',     'KET_CAU',   'Tang 5','Khu A','IfcColumn',     ARRAY[10.0,10.0,18.0,10.6,10.6,21.0]),
      ('elem_col_c13', 'GLB-002', 'Cot C-13 tang 5',     'Cot',     'KET_CAU',   'Tang 5','Khu A','IfcColumn',     ARRAY[18.0,10.0,18.0,18.6,10.6,21.0]),
      ('elem_dam_b3',  'GLB-003', 'Dam B-3 tang 5',      'Dam',     'KET_CAU',   'Tang 5','Khu A','IfcBeam',       ARRAY[10.0,10.0,20.4,18.6,10.4,21.0]),
      ('elem_mep1',    'MEP-001', 'Ong HVAC Phi400',     'MEP-Pipe','CO_DIEN_M', 'Tang 5','Khu A','IfcPipeSegment',ARRAY[12.0,9.8,20.5,16.0,10.2,20.9]),
      ('elem_mep2',    'MEP-002', 'Ong PCCC DN150',      'MEP-Pipe','PCCC',      'Tang 5','Khu A','IfcPipeSegment',ARRAY[11.5,10.0,20.7,15.5,10.4,21.1]),
      ('elem_mep3',    'MEP-003', 'Ong thoat PVC DN110', 'MEP-Pipe','CO_DIEN_P', 'Tang 5','Khu B','IfcPipeSegment',ARRAY[30.0,10.0,20.5,33.0,10.5,20.8]),
      ('elem_wall_w1', 'ARC-001', 'Tuong W-1 12A',       'Tuong',   'KIEN_TRUC', 'Tang 5','Khu B','IfcWall',       ARRAY[25.0,10.0,18.0,25.2,18.0,21.0]),
      ('elem_floor_s5','ARC-002', 'San tang 5',          'San',     'KIEN_TRUC', 'Tang 5','Toan tang','IfcSlab',   ARRAY[0.0,0.0,20.8,40.0,20.0,21.0])
    ) AS v(id,"elementId",name,category,discipline,level,zone,ifctype,bbox)
    CROSS JOIN LATERAL (SELECT id FROM "Model" LIMIT 1) m
    ON CONFLICT DO NOTHING;

    INSERT INTO "BoQ" (id, "projectId", name, "contractValueVnd", version, "isCurrent", "createdAt")
    SELECT 'boq_demo_v1', p.id, 'BoQ hop dong thi cong chinh', 1850000000000, 'v1', true, NOW()
    FROM "Project" p LIMIT 1
    ON CONFLICT DO NOTHING;

    INSERT INTO "BoQLine" (id, "boqId", code, description, unit, qty, "unitPriceVnd", "totalVnd", "qtyCompleted", category, "createdAt")
    VALUES
      ('boql_1','boq_demo_v1','1.1','Be tong mong M300','m3',5400,1850000,9990000000,5180,'Phan ngam',NOW()),
      ('boql_2','boq_demo_v1','1.2','Cot thep CB300-V','tan',820,21500000,17630000000,760,'Phan ngam',NOW()),
      ('boql_3','boq_demo_v1','2.1','Be tong phan than M400','m3',12800,2050000,26240000000,6900,'Phan than',NOW()),
      ('boql_4','boq_demo_v1','2.2','Cot thep phan than','tan',1950,22000000,42900000000,1150,'Phan than',NOW()),
      ('boql_5','boq_demo_v1','3.1','Tuong gach AAC','m3',3200,1200000,3840000000,1100,'Phan than',NOW()),
      ('boql_6','boq_demo_v1','4.1','Duong ong PCCC','m',8400,285000,2394000000,3100,'MEP',NOW()),
      ('boql_7','boq_demo_v1','4.2','Ong HVAC chinh','m',6200,420000,2604000000,1900,'MEP',NOW()),
      ('boql_8','boq_demo_v1','5.1','Son noi that','m2',85000,58000,4930000000,6500,'Hoan thien',NOW()),
      ('boql_9','boq_demo_v1','5.2','Gach lat nen','m2',42000,285000,11970000000,4200,'Hoan thien',NOW())
    ON CONFLICT DO NOTHING;
  `;
  execSync(`docker exec -i atlas-aec-postgres psql -U atlas -d atlas_aec`, {
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
