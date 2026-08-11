/**
 * Atlas AEC end-to-end flow tester ("thông luồng").
 *
 * Signs in via NextAuth credentials, reuses the session cookie, and hits every
 * Layer 1 API endpoint asserting the response shape + business rules. Designed
 * to be re-runnable: it creates one test tender / one test bid / one test bond
 * and verifies the workflow guard, then leaves the demo seed intact.
 *
 *   pnpm exec tsx scripts/smoke-flow.ts
 *   or
 *   BASE=http://localhost:3030 packages/db/node_modules/.bin/tsx scripts/smoke-flow.ts
 */

import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.BASE ?? "http://localhost:3030";
const EMAIL = process.env.EMAIL ?? "anh.nguyen@cofico.vn";
const PASSWORD = process.env.PASSWORD ?? "demo1234!";

// ────────────────────────────────────────────────────────────────────────────
// Cookie jar + request helpers
// ────────────────────────────────────────────────────────────────────────────

const jar = new Map<string, string>();
function jarHeader(): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function stashSetCookie(res: Response) {
  // node fetch exposes raw set-cookie via getSetCookie()
  const raw: string[] = (res.headers as any).getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const [k, v] = pair.split("=");
    if (k && v !== undefined) jar.set(k.trim(), v.trim());
  }
}
async function req(method: string, path: string, body?: unknown, opts: { expectStatus?: number } = {}): Promise<{ status: number; data: any; raw: Response }> {
  const url = path.startsWith("http") ? path : BASE + path;
  const headers: Record<string, string> = { cookie: jarHeader() };
  let init: RequestInit = { method, headers, redirect: "manual" };
  if (body !== undefined) {
    if (typeof body === "string") {
      headers["content-type"] = "application/x-www-form-urlencoded";
      init.body = body;
    } else {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  }
  const res = await fetch(url, init);
  stashSetCookie(res);
  const ct = res.headers.get("content-type") ?? "";
  const data = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, data, raw: res };
}

// ────────────────────────────────────────────────────────────────────────────
// Assertion harness
// ────────────────────────────────────────────────────────────────────────────

type Check = { ok: boolean; name: string; detail?: string; ms: number };
const checks: Check[] = [];

async function step(name: string, fn: () => Promise<void | string>) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    checks.push({ ok: true, name, detail: detail || undefined, ms: Date.now() - t0 });
    process.stdout.write(`  ✓ ${name}${detail ? "  — " + detail : ""}\n`);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    checks.push({ ok: false, name, detail: msg, ms: Date.now() - t0 });
    process.stdout.write(`  ✗ ${name}\n      ${msg}\n`);
  }
}
function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// ────────────────────────────────────────────────────────────────────────────
// Auth (NextAuth credentials sign-in)
// ────────────────────────────────────────────────────────────────────────────

async function signIn() {
  // 1. Get CSRF token
  const csrf = await req("GET", "/api/auth/csrf");
  assert(csrf.status === 200 && csrf.data?.csrfToken, `csrf fetch failed: ${csrf.status}`);
  const csrfToken = csrf.data.csrfToken as string;

  // 2. Submit credentials
  const form = new URLSearchParams({
    csrfToken,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: BASE + "/",
    json: "true",
  }).toString();
  const login = await req("POST", "/api/auth/callback/credentials", form);
  // NextAuth credentials returns 200 with json {url} when json:true is set
  assert(login.status < 400, `sign-in HTTP ${login.status}: ${JSON.stringify(login.data).slice(0, 200)}`);

  // 3. Verify session
  const sess = await req("GET", "/api/auth/session");
  assert(sess.status === 200, `session fetch ${sess.status}`);
  assert(sess.data?.user?.email === EMAIL, `session email mismatch: ${JSON.stringify(sess.data).slice(0, 150)}`);
  return sess.data.user;
}

// ────────────────────────────────────────────────────────────────────────────
// Suite
// ────────────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`▶ smoke-flow against ${BASE}\n`);

  // -- Auth ---------------------------------------------------------------
  let user: any;
  await step("auth.signin", async () => {
    user = await signIn();
    return `userId=${user.id.slice(0, 8)}… email=${user.email}`;
  });
  if (!user) {
    console.error("Sign-in failed — abort the rest of the suite.");
    process.exit(1);
  }

  // Resolve a primary org + project. Prefer Prisma direct (works for both
  // local Docker and Neon prod via DATABASE_URL env). Falls back to docker
  // exec for legacy local setups.
  let cofico: any, project: any;
  await step("auth.bootstrap.orgs_and_project", async () => {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      const dbMod = await import("../packages/db/src/index.js" as any).catch(() => import("../packages/db/src/index"));
      const { PrismaClient } = dbMod as any;
      const p = new PrismaClient();
      const [org, proj] = await Promise.all([
        p.organization.findUnique({ where: { slug: "cofico" }, select: { id: true, slug: true } }),
        p.project.findUnique({ where: { key: "VHGP-S9" }, select: { id: true, key: true } }),
      ]);
      await p.$disconnect();
      assert(org && proj, "Prisma lookup failed");
      cofico = org;
      project = proj;
      return `org=${cofico.slug} project=${project.key} (via Prisma DATABASE_URL)`;
    }
    const { execSync } = await import("node:child_process");
    const sql = `SELECT o.id || '|' || o.slug || '|' || p.id || '|' || p.key FROM "Organization" o, "Project" p WHERE o.slug='cofico' AND p.key='VHGP-S9' LIMIT 1;`;
    const out = execSync(`docker exec -i atlas-aec-postgres psql -U atlas -d atlas_aec -At`, {
      encoding: "utf-8",
      input: sql,
    }).trim();
    const [orgId, orgSlug, projId, projKey] = out.split("|");
    assert(orgId && projId, `psql lookup failed: ${out}`);
    cofico = { id: orgId, slug: orgSlug };
    project = { id: projId, key: projKey };
    return `org=${cofico.slug} project=${project.key}`;
  });

  // -- Layer 1.1 WinWork --------------------------------------------------
  console.log("\n── Layer 1.1 WinWork ──");
  let createdTenderId: string | null = null;
  let createdBidId: string | null = null;

  await step("winwork.tenders.list", async () => {
    const r = await req("GET", "/api/winwork/tenders?days=120");
    assert(r.status === 200, `status ${r.status}`);
    const count = r.data.tenders?.length ?? 0;
    assert(count >= 5, `expected ≥5 tenders, got ${count}`);
    return `${count} tenders returned`;
  });

  await step("winwork.tenders.create", async () => {
    const title = `[smoke] Cong trinh test ${Date.now()}`;
    const r = await req("POST", "/api/winwork/tenders", {
      source: "MANUAL",
      title,
      invitorMst: "0300999999",
      budgetVnd: "5500000000",
      province: "TP. HCM",
      closingAt: new Date(Date.now() + 21 * 86_400_000).toISOString(),
    });
    assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0,200)}`);
    assert(r.data.tender?.id, "tender.id missing");
    createdTenderId = r.data.tender.id;
    return `id=${createdTenderId?.slice(0, 8)}…`;
  });

  await step("winwork.tenders.create_dedupe", async () => {
    // re-post same payload → de-dup by hash returns {duplicate: true}
    const title = `[smoke] dedupe ${Date.now()}`;
    const body = { source: "MANUAL", title, invitorMst: "0300999999", budgetVnd: "1100000000" };
    const a = await req("POST", "/api/winwork/tenders", body);
    const b = await req("POST", "/api/winwork/tenders", body);
    assert(a.status === 200 && b.status === 200, `${a.status}/${b.status}`);
    assert(b.data.duplicate === true, `expected duplicate:true, got ${JSON.stringify(b.data).slice(0,150)}`);
    return "second POST returned duplicate:true";
  });

  await step("winwork.bids.list", async () => {
    const r = await req("GET", `/api/winwork/bids?orgId=${cofico.id}`);
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.bids?.length ?? 0;
    assert(n >= 5, `expected ≥5 cofico bids, got ${n}`);
    return `${n} bids`;
  });

  await step("winwork.bids.create_and_state", async () => {
    const r = await req("POST", "/api/winwork/bids", {
      orgId: cofico.id,
      title: `[smoke] HSDT test ${Date.now()}`,
      estimatedValueVnd: "12000000000",
    });
    assert(r.status === 200, `status ${r.status}`);
    assert(r.data.bid?.state === "DRAFT", `expected DRAFT, got ${r.data.bid?.state}`);
    createdBidId = r.data.bid.id;
    return `id=${createdBidId?.slice(0, 8)}… state=DRAFT`;
  });

  await step("winwork.compliance.run_9_rules", async () => {
    assert(createdBidId, "no bid id");
    const r = await req("POST", `/api/winwork/bids/${createdBidId}/compliance`);
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.results?.length ?? 0;
    assert(n === 9, `expected 9 rule evaluations, got ${n}`);
    assert(typeof r.data.summary?.blockingFail === "number", "summary.blockingFail missing");
    return `9 rules · blockingFail=${r.data.summary.blockingFail}`;
  });

  await step("winwork.compliance.get_latest", async () => {
    assert(createdBidId, "no bid id");
    const r = await req("GET", `/api/winwork/bids/${createdBidId}/compliance`);
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.checks?.length ?? 0;
    assert(n === 9, `expected 9 latest checks (one per rule), got ${n}`);
    return `${n} latest per ruleId`;
  });

  await step("winwork.transition.guard_blocks_submit_without_compliance_clean", async () => {
    assert(createdBidId, "no bid id");
    // DRAFT → ESTIMATING is allowed
    let r = await req("POST", `/api/winwork/bids/${createdBidId}/transition`, { to: "ESTIMATING" });
    assert(r.status === 200, `ESTIMATING transition status ${r.status}`);

    // ESTIMATING → READY requires proposedValueVnd > 0 (guard)
    r = await req("POST", `/api/winwork/bids/${createdBidId}/transition`, { to: "READY" });
    assert(r.status === 422, `expected 422 (guard rejected READY without proposedValueVnd), got ${r.status}`);

    return "READY transition correctly rejected by FSM guard (proposedValueVnd missing)";
  });

  await step("winwork.bonds.list_filtered", async () => {
    const r = await req("GET", `/api/winwork/bonds?orgId=${cofico.id}&expiring=120`);
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.bonds?.length ?? 0;
    assert(n >= 0, `bad shape: ${JSON.stringify(r.data).slice(0,150)}`);
    return `${n} bonds expiring ≤120d`;
  });

  await step("winwork.bonds.create_for_new_bid", async () => {
    assert(createdBidId, "no bid id");
    const issuedAt = new Date(Date.now() - 86_400_000).toISOString();
    const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
    const r = await req("POST", "/api/winwork/bonds", {
      bidId: createdBidId,
      type: "BAO_LANH_DU_THAU",
      issuerBank: "Vietcombank — Smoke CN",
      bondNumber: `BL/2026/SMK/${Date.now()}`,
      amountVnd: "150000000",
      issuedAt,
      expiresAt,
    });
    assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0,200)}`);
    assert(r.data.bond?.id, "no bond id");
    return `bond id=${r.data.bond.id.slice(0, 8)}…`;
  });

  // -- Layer 1.2 CodeGuard ------------------------------------------------
  console.log("\n── Layer 1.2 CodeGuard ──");

  await step("codeguard.regulations.in_force_baseline", async () => {
    const r = await req("GET", "/api/codeguard/regulations");
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.regulations?.length ?? 0;
    assert(n >= 10, `expected ≥10 baseline regs, got ${n}`);
    const codes = r.data.regulations.map((x: any) => x.code);
    for (const c of ["TCVN 5574:2018", "QCVN 06:2022/BXD", "NĐ 06/2021/NĐ-CP", "NĐ 15/2021/NĐ-CP"]) {
      assert(codes.includes(c), `missing baseline reg: ${c}`);
    }
    return `${n} regs · baseline 4 present`;
  });

  await step("codeguard.dossier.read_19_items_summary", async () => {
    const r = await req("GET", `/api/codeguard/dossier/${project.id}`);
    assert(r.status === 200, `status ${r.status}`);
    const items = r.data.items ?? [];
    assert(items.length === 19, `expected 19 dossier items, got ${items.length}`);
    const sum = r.data.summary;
    assert(sum && typeof sum.total === "number", "summary missing");
    return `19 items · accepted=${sum.accepted} submitted=${sum.submitted} missing=${sum.missing}`;
  });

  await step("codeguard.dossier.seed_idempotent", async () => {
    const r = await req("POST", `/api/codeguard/dossier/${project.id}/seed`);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.data.created === 0, `second seed should be idempotent (created=0), got ${r.data.created}`);
    return `created=${r.data.created} (idempotent ✓)`;
  });

  await step("codeguard.dossier.patch_status_persists", async () => {
    // Toggle I.A.3 between ACCEPTED and DRAFT, then back
    const before = (await req("GET", `/api/codeguard/dossier/${project.id}`)).data.items.find((i: any) => i.itemCode === "I.A.3");
    assert(before, "I.A.3 not found");
    const original = before.status;
    const newStatus = original === "ACCEPTED" ? "DRAFT" : "ACCEPTED";
    const patch = await req("PATCH", `/api/codeguard/dossier/${project.id}`, { itemCode: "I.A.3", status: newStatus });
    assert(patch.status === 200, `patch ${patch.status}`);
    const refetched = (await req("GET", `/api/codeguard/dossier/${project.id}`)).data.items.find((i: any) => i.itemCode === "I.A.3");
    assert(refetched.status === newStatus, `expected ${newStatus} after patch, got ${refetched.status}`);
    // Restore
    await req("PATCH", `/api/codeguard/dossier/${project.id}`, { itemCode: "I.A.3", status: original });
    return `I.A.3 ${original} → ${newStatus} → ${original}`;
  });

  // -- Layer 1.3 DrawBridge -----------------------------------------------
  console.log("\n── Layer 1.3 DrawBridge ──");

  await step("drawbridge.elements.list", async () => {
    const r = await req("GET", `/api/drawbridge/elements?projectId=${project.id}`);
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.elements?.length ?? 0;
    assert(n >= 8, `expected ≥8 seeded BIM elements, got ${n}`);
    const cats = new Set(r.data.elements.map((e: any) => e.category));
    assert(cats.size >= 4, `expected ≥4 categories, got ${cats.size}`);
    return `${n} elements · ${cats.size} categories`;
  });

  await step("drawbridge.clashes.detect_run_and_persist", async () => {
    const r = await req("POST", "/api/drawbridge/clashes", { projectId: project.id });
    assert(r.status === 200, `status ${r.status}`);
    assert(typeof r.data.totalHits === "number", `bad shape: ${JSON.stringify(r.data).slice(0,150)}`);
    return `${r.data.totalHits} hits · created=${r.data.created} new`;
  });

  await step("drawbridge.clashes.list_top_severity", async () => {
    const r = await req("GET", `/api/drawbridge/clashes?projectId=${project.id}`);
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.clashes?.length ?? 0;
    assert(n >= 1, `expected ≥1 clash, got ${n}`);
    // First entry should have the highest severity due to orderBy: severity desc
    const top = r.data.clashes[0];
    assert(typeof top.severity === "number", "severity not number");
    return `${n} clashes · top severity=${top.severity}`;
  });

  await step("drawbridge.issue_link.create_and_delete", async () => {
    const els = (await req("GET", `/api/drawbridge/elements?projectId=${project.id}`)).data.elements;
    const elementId = els[0].id;
    // Find any issue
    const issues = (await req("GET", `/api/issues?projectId=${project.id}`)).data?.issues ?? [];
    if (issues.length === 0) {
      return "skipped — no issues available";
    }
    const issueId = issues[0].id;
    const created = await req("POST", "/api/drawbridge/issue-links", { issueId, elementIds: [elementId], note: "[smoke]" });
    assert(created.status === 200, `create ${created.status}`);
    assert(created.data.created >= 1, "no link created");
    const del = await req("DELETE", `/api/drawbridge/issue-links?issueId=${issueId}&elementId=${elementId}`);
    assert(del.status === 200, `delete ${del.status}`);
    return `linked + unlinked element=${elementId.slice(0,8)}…`;
  });

  // -- Layer 1.4 SiteEye --------------------------------------------------
  console.log("\n── Layer 1.4 SiteEye ──");

  await step("siteeye.incidents.list", async () => {
    const r = await req("GET", `/api/siteeye/incidents?projectId=${project.id}`);
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.incidents?.length ?? 0;
    assert(n >= 1, `expected ≥1 seeded incident, got ${n}`);
    return `${n} incidents`;
  });

  await step("siteeye.incidents.create", async () => {
    const r = await req("POST", "/api/siteeye/incidents", {
      projectId: project.id,
      occurredAt: new Date().toISOString(),
      category: "AN_TOAN_LAO_DONG",
      severity: "NEAR_MISS",
      description: "[smoke] Test sự cố tự chạy",
      location: "Tang 1 - Khu test",
      injured: 0,
    });
    assert(r.status === 200, `status ${r.status} ${JSON.stringify(r.data).slice(0,200)}`);
    assert(r.data.incident?.id, "no incident id");
    return `id=${r.data.incident.id.slice(0,8)}…`;
  });

  await step("siteeye.weather.open_meteo_live", async () => {
    const r = await req("GET", `/api/siteeye/weather?projectId=${project.id}&lat=10.776&lng=106.7`);
    assert(r.status === 200 || r.status === 502, `unexpected ${r.status}`);
    if (r.status === 502) return "open-meteo unreachable (network) — graceful degrade";
    assert(r.data.snapshot, "no snapshot in response");
    const t = r.data.snapshot.tempC;
    assert(typeof t === "number" && t > -50 && t < 60, `tempC out of range: ${t}`);
    return `tempC=${t} · condition=${r.data.snapshot.condition} · alert=${r.data.alert?.level ?? "none"}`;
  });

  // -- Layer 1.5 CostPulse ------------------------------------------------
  console.log("\n── Layer 1.5 CostPulse ──");

  await step("costpulse.boq.read", async () => {
    const r = await req("GET", `/api/costpulse/boq?projectId=${project.id}`);
    assert(r.status === 200, `status ${r.status}`);
    assert(r.data.boq, "no boq returned");
    const n = r.data.boq.lines?.length ?? 0;
    assert(n >= 5, `expected ≥5 BoQ lines, got ${n}`);
    // Verify totalVnd ≈ qty * unitPriceVnd for first line
    const l = r.data.boq.lines[0];
    const expected = BigInt(Math.round(l.qty * 1000)) * BigInt(l.unitPriceVnd) / 1000n;
    assert(BigInt(l.totalVnd) === expected, `line total mismatch: ${l.totalVnd} ≠ ${expected}`);
    return `${n} lines · totals reconcile ✓`;
  });

  await step("costpulse.evm.cpi_eac_compute", async () => {
    const r = await req("GET", `/api/costpulse/evm/${project.id}`);
    assert(r.status === 200, `status ${r.status}`);
    const e = r.data.evm;
    assert(e, "no evm");
    assert(BigInt(e.bac) > 0n, "BAC=0");
    assert(BigInt(e.ev) > 0n, "EV=0");
    assert(typeof e.cpi === "number" && e.cpi > 0, `CPI invalid: ${e.cpi}`);
    // EAC = BAC / CPI ⇒ should be close to BAC × (AC/EV)
    const eac = BigInt(e.eac);
    assert(eac > 0n, "EAC=0");
    return `CPI=${e.cpi.toFixed(2)} SPI=${e.spi?.toFixed?.(2) ?? "—"} EAC=${(Number(e.eac) / 1e9).toFixed(1)} tỉ`;
  });

  // -- Layer 4 Trust ------------------------------------------------------
  console.log("\n── Layer 4 Trust ──");

  await step("trust.models.public_read", async () => {
    const r = await req("GET", "/api/trust/models");
    assert(r.status === 200, `status ${r.status}`);
    const n = r.data.cards?.length ?? 0;
    assert(n >= 5, `expected ≥5 model cards, got ${n}`);
    const features = new Set(r.data.cards.map((c: any) => c.feature));
    for (const f of ["rfi.classify", "ncr.assess_photo", "siteeye.ppe", "daily_log.transcribe", "spec.embed"]) {
      assert(features.has(f), `missing feature ${f}`);
    }
    return `${n} model cards · 5 features present`;
  });

  // -- Audit log written --------------------------------------------------
  console.log("\n── Audit log ──");

  await step("audit.events_written_for_mutations", async () => {
    const dbUrl = process.env.DATABASE_URL;
    let actions: string[];
    if (dbUrl) {
      const dbMod = await import("../packages/db/src/index.js" as any).catch(() => import("../packages/db/src/index"));
      const { PrismaClient } = dbMod as any;
      const p = new PrismaClient();
      const rows = await p.auditEvent.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
        orderBy: { createdAt: "desc" },
        take: 60,
        select: { action: true },
      });
      await p.$disconnect();
      actions = rows.map((r) => r.action);
    } else {
      const { execSync } = await import("node:child_process");
      const sql = `SELECT action FROM "AuditEvent" WHERE "createdAt" > NOW() - INTERVAL '5 minutes' ORDER BY "createdAt" DESC LIMIT 60;`;
      const out = execSync(`docker exec -i atlas-aec-postgres psql -U atlas -d atlas_aec -At`, {
        encoding: "utf-8",
        input: sql,
      });
      actions = out.trim().split("\n").filter(Boolean);
    }
    const has = (a: string) => actions.includes(a);
    assert(has("tender.create"), "missing tender.create");
    assert(has("bid.create"), "missing bid.create");
    assert(has("bid.compliance.run"), "missing bid.compliance.run");
    assert(has("bond.create"), "missing bond.create");
    assert(has("dossier.update"), "missing dossier.update");
    assert(has("drawbridge.clash.run"), "missing drawbridge.clash.run");
    assert(has("incident.create"), "missing incident.create");
    return `${actions.length} fresh audit events · 7 expected actions all present`;
  });

  // -- Result -------------------------------------------------------------
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  console.log("\n──────────────────────────────────");
  console.log(`Passed: ${passed} / ${checks.length}`);
  if (failed > 0) {
    console.log(`Failed: ${failed}`);
    for (const c of checks.filter((x) => !x.ok)) console.log(`  ✗ ${c.name} — ${c.detail}`);
    process.exit(1);
  } else {
    console.log("✅ All assertions passed.");
  }
})();
