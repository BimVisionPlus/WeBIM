/**
 * POST /api/tenant/provision — Self-serve "give me a demo sandbox" endpoint.
 *
 * Body: { slug, name, email, company?, industry? }
 *
 * Creates a tenant Organization cloned from the DEMO_TEMPLATE org with:
 *  - Up to 5 projects, BoQ, issues, schedule, daily logs
 *  - 1 OWNER user (the prospect)
 *  - 14-day pilot expiry
 *  - One-time magic-link signin token
 *
 * Optionally emails the prospect with the signin URL.
 *
 * Hot path: ~3-6 seconds (heavy clone). Idempotent on slug uniqueness (409).
 *
 * SECURITY:
 *  - Rate limited (3 req/min/IP) to prevent slug squatting.
 *  - Slug normalized + validated to safe DNS label format.
 *  - No auth required (public signup) but stored prospectSource for fraud
 *    detection if abused.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit, reqMeta, rateLimitGuard, sendEmail, cloneTenant } from "@atlas/lib";

const Body = z.object({
  slug: z.string().min(2).max(40).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "Slug chỉ chứa chữ thường, số, dấu gạch nối"),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  prospectName: z.string().max(120).optional(),
  company: z.string().max(200).optional(),
  industry: z.string().max(120).optional(),
  source: z.string().max(80).optional(),
});

const BASE_DOMAIN = process.env.TENANT_BASE_DOMAIN ?? "aecplatform.vn";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "tenant.provision", windowSec: 60, max: 3 });
  if (rl) return rl;

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // Reserved slugs that can never be used as tenant subdomains.
    const reserved = ["www", "app", "api", "admin", "mail", "blog", "docs", "status", "marketing", "demo", "test", "staging", "dev"];
    if (reserved.includes(d.slug)) {
      return NextResponse.json({ error: "Subdomain này đã giữ chỗ — chọn slug khác" }, { status: 400 });
    }

    let result;
    try {
      result = await cloneTenant({
        slug: d.slug,
        name: d.name,
        prospectEmail: d.email,
        prospectName: d.prospectName,
        prospectCompany: d.company,
        prospectIndustry: d.industry,
        prospectSource: d.source ?? "self-serve /start",
        templateSlug: process.env.TENANT_TEMPLATE_SLUG ?? "cofico",
        pilotDays: 14,
      });
    } catch (e: any) {
      if (e?.message?.includes("already taken")) {
        return NextResponse.json({ error: "Subdomain này đã có người đăng ký rồi — chọn slug khác" }, { status: 409 });
      }
      throw e;
    }

    const signinUrl = `https://${d.slug}.${BASE_DOMAIN}/signin-magic?token=${result.signinToken}`;

    // Audit trail
    await audit({
      action: "tenant.provision",
      entityType: "Organization",
      entityId: result.orgId,
      actorId: result.ownerUserId,
      orgId: result.orgId,
      ...reqMeta(req),
      after: { slug: d.slug, stats: result.stats, prospectEmail: d.email },
    });

    // Welcome email — fire-and-forget; failure shouldn't block response.
    sendEmail({
      to: d.email,
      subject: `Sandbox Viwase đã sẵn sàng — ${d.name}`,
      html: `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#0f172a">Chào ${d.prospectName ?? "bạn"}!</h2>
        <p>Sandbox riêng của bạn đã được tạo với <strong>${result.stats.projects} dự án mẫu</strong>, <strong>${result.stats.boqLines} dòng BoQ</strong>, ${result.stats.issues} issue (RFI/NCR/Submittal), ${result.stats.scheduleTasks} công việc, ${result.stats.dailyLogs} nhật ký.</p>
        <p style="margin:24px 0">
          <a href="${signinUrl}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Mở sandbox →</a>
        </p>
        <p>URL: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">https://${d.slug}.${BASE_DOMAIN}</code></p>
        <p style="color:#64748b;font-size:13px">Sandbox sẽ tự động đóng sau 14 ngày. Tài khoản OWNER: <code>${d.email}</code>. Link đăng nhập hết hạn sau 24h — sau đó dùng email + password (Quên password? trên trang đăng nhập).</p>
      </div>`,
      text: `Chào ${d.prospectName ?? "bạn"}!\n\nSandbox riêng đã sẵn sàng: https://${d.slug}.${BASE_DOMAIN}\n\nĐăng nhập 1-cú-click: ${signinUrl}\n\nSandbox tự đóng sau 14 ngày.`,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      orgId: result.orgId,
      slug: d.slug,
      url: `https://${d.slug}.${BASE_DOMAIN}`,
      signinUrl,
      stats: result.stats,
      expiresIn: "14 ngày",
    });
  } catch (e: any) {
    console.error("tenant.provision failed:", e);
    return NextResponse.json({ error: "Không tạo được sandbox — thử lại sau ít phút" }, { status: 500 });
  }
}
