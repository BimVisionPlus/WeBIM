/**
 * POST /api/billing/upgrade-request
 *
 * Records an upgrade intent + emails the billing team so they can issue a
 * VAT invoice (TT 78/2021) and activate the plan once the bank transfer lands.
 * No payment provider needed for the first ~10 pilots.
 *
 * Body: { orgId, planCode, contactEmail, contactPhone?, note? }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireOrgMember, AuthError } from "@atlas/auth";
import { audit, reqMeta, sendEmail, rateLimitGuard, logger } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  planCode: z.enum(["pro", "business", "enterprise"]),
  contactEmail: z.string().email(),
  contactPhone: z.string().max(40).optional(),
  note: z.string().max(2000).optional(),
});

const PLAN_LABEL: Record<string, string> = {
  pro: "Pro · 290.000đ/user/tháng",
  business: "Business · 690.000đ/user/tháng",
  enterprise: "Enterprise · báo giá riêng",
};

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "billing.upgrade_request", max: 5, windowSec: 600 });
  if (rl) return rl;

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "validation_failed", message: "Dữ liệu không hợp lệ", fields: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      );
    }
    const d = parsed.data;
    const { session } = await requireOrgMember(d.orgId);
    const org = await prisma.organization.findUnique({ where: { id: d.orgId } });
    if (!org) return NextResponse.json({ error: "org not found" }, { status: 404 });

    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } });

    await audit({
      action: "billing.upgrade_request",
      entityType: "Organization",
      entityId: org.id,
      actorId: session.userId,
      orgId: org.id,
      ...reqMeta(req),
      after: { planCode: d.planCode, contactEmail: d.contactEmail, contactPhone: d.contactPhone },
    });

    const subject = `[Atlas AEC] Yêu cầu nâng cấp ${PLAN_LABEL[d.planCode] ?? d.planCode} — ${org.name}`;
    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 640px; padding: 24px;">
        <h2>Yêu cầu nâng cấp gói</h2>
        <table style="border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Tổ chức</td><td><strong>${org.name}</strong> (${org.slug})</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">MST</td><td>${org.mst ?? "—"}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Gói yêu cầu</td><td><strong>${PLAN_LABEL[d.planCode]}</strong></td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Người yêu cầu</td><td>${me?.name ?? "—"} &lt;${me?.email ?? "—"}&gt;</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Email liên hệ</td><td>${d.contactEmail}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">SĐT</td><td>${d.contactPhone ?? "—"}</td></tr>
        </table>
        ${d.note ? `<p><strong>Ghi chú:</strong></p><p>${d.note.replace(/[<>]/g, "")}</p>` : ""}
        <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e2e8f0;" />
        <p style="color: #64748b; font-size: 12px;">
          Cấp khoản chuyển khoản, xác nhận, kích hoạt subscription qua Prisma:
          <code>prisma.subscription.upsert({ where: { orgId: "${org.id}" }, …})</code>
        </p>
      </div>`;

    // Email the billing team. Fall back to log if email isn't configured.
    const billingTo = process.env.BILLING_INBOX ?? "billing@atlas-aec.vn";
    const r = await sendEmail({
      to: billingTo,
      subject,
      html,
      text: `Upgrade request: ${org.name} → ${d.planCode}. Contact: ${d.contactEmail}`,
    });
    if (!r.ok) {
      logger().warn({ org: org.slug, plan: d.planCode }, "billing.upgrade_request.email_unsent");
    }

    // Bank account info pulled from env so finance can rotate without redeploy
    const BANK_NAME = process.env.BANK_NAME ?? "Vietcombank";
    const BANK_ACCOUNT = process.env.BANK_ACCOUNT ?? "0011 002 345 678";
    const BANK_HOLDER = process.env.BANK_HOLDER ?? "CTCP Atlas AEC";

    // Reply to the customer too (best-effort)
    await sendEmail({
      to: d.contactEmail,
      subject: "Atlas AEC — đã nhận yêu cầu nâng cấp",
      html: `<div style="font-family: -apple-system, system-ui, sans-serif; padding: 24px;">
        <h2>Cảm ơn ${me?.name ?? "bạn"}!</h2>
        <p>Đã nhận yêu cầu nâng cấp tổ chức <strong>${org.name}</strong> sang gói <strong>${PLAN_LABEL[d.planCode]}</strong>.</p>
        <p>Đội kế toán sẽ gửi hóa đơn VAT điện tử (TT 78/2021) qua email <strong>${d.contactEmail}</strong> trong vòng 1 ngày làm việc.
        Sau khi chuyển khoản, subscription sẽ được kích hoạt trong vòng 4 giờ.</p>
        <div style="margin-top: 16px; padding: 12px; background: #f1f5f9; border-radius: 6px; font-size: 13px;">
          <strong>Thông tin chuyển khoản:</strong><br/>
          ${BANK_NAME} · ${BANK_ACCOUNT} · ${BANK_HOLDER}<br/>
          Nội dung: <code>ATLAS-UPGRADE-${org.slug.toUpperCase()}-${d.planCode.toUpperCase()}</code>
        </div>
      </div>`,
      text: `Đã nhận yêu cầu nâng cấp ${org.name} sang ${d.planCode}. Đội kế toán sẽ liên hệ trong 1 ngày làm việc.`,
    });

    return NextResponse.json({ ok: true, message: "Đã ghi nhận. Đội kế toán sẽ liên hệ trong 1 ngày làm việc." });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    logger().error({ err: e }, "billing.upgrade_request.failed");
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
