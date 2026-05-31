/**
 * GET /api/digest?dept=HANH_CHINH — Groq-summarized weekly digest per phòng.
 *
 * Builds a stat blob server-side from last 7 days of activity in the dept's
 * modules, feeds it to Llama-3.3-70b via Groq, and returns a short Vietnamese
 * summary. Falls back gracefully when AI disabled.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { chat } from "@atlas/ai";
import { rateLimitGuard } from "@atlas/lib";

const DEPT_LABEL: Record<string, string> = {
  HANH_CHINH: "Hành chính", TAI_CHINH_KE_TOAN: "Tài chính kế toán",
  PHAT_TRIEN_THI_TRUONG: "Phát triển thị trường", CONG_VIEC: "Công việc",
  DAU_THAU: "Đấu thầu", CONG_VIEC_KHAC: "Công việc khác",
};

export async function GET(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "digest" }); if (rl) return rl;
  try {
    const session = await requireSession();
    const dept = (new URL(req.url)).searchParams.get("dept") ?? "";
    if (!DEPT_LABEL[dept]) return NextResponse.json({ error: "dept invalid" }, { status: 400 });

    const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
    const orgIds = memberships.map((m) => m.orgId);
    const past7 = new Date(Date.now() - 7 * 86400000);

    // Gather dept-specific signals
    let stats: Record<string, number> = {};
    let bullets: string[] = [];

    if (dept === "HANH_CHINH") {
      const [docs, agencyDocs, bhxh, dispatches] = await Promise.all([
        prisma.internalDocument.count({ where: { orgId: { in: orgIds }, issuedAt: { gte: past7 } } }),
        prisma.agencyDocument.count({ where: { docDate: { gte: past7 } } }),
        prisma.socialInsuranceRecord.count({ where: { orgId: { in: orgIds }, createdAt: { gte: past7 } } }),
        prisma.vehicleDispatch.count({ where: { orgId: { in: orgIds }, startAt: { gte: past7 } } }),
      ]);
      stats = { "Văn bản nội bộ mới": docs, "Công văn QLNN mới": agencyDocs, "BHXH bản ghi mới": bhxh, "Lệnh điều xe": dispatches };
    } else if (dept === "TAI_CHINH_KE_TOAN") {
      const [tamUng, thanhToan, hoanUng, assignments, overdue] = await Promise.all([
        prisma.advanceTransaction.count({ where: { orgId: { in: orgIds }, type: "TAM_UNG", txnDate: { gte: past7 } } }),
        prisma.advanceTransaction.count({ where: { orgId: { in: orgIds }, type: "THANH_TOAN", txnDate: { gte: past7 } } }),
        prisma.advanceTransaction.count({ where: { orgId: { in: orgIds }, type: "HOAN_UNG", txnDate: { gte: past7 } } }),
        prisma.contractorAssignment.count({ where: { createdAt: { gte: past7 } } }),
        prisma.advanceTransaction.count({ where: { orgId: { in: orgIds }, type: "TAM_UNG", status: { in: ["PENDING", "APPROVED"] }, txnDate: { lt: new Date(Date.now() - 30 * 86400000) } } }),
      ]);
      stats = { "Tạm ứng mới": tamUng, "Thanh toán mới": thanhToan, "Hoàn ứng": hoanUng, "Giao khoán mới": assignments, "Tạm ứng quá 30 ngày": overdue };
    } else if (dept === "PHAT_TRIEN_THI_TRUONG") {
      const [newLeads, won, lost, tracking] = await Promise.all([
        prisma.projectLead.count({ where: { orgId: { in: orgIds }, createdAt: { gte: past7 } } }),
        prisma.projectLead.count({ where: { orgId: { in: orgIds }, status: "WON" } }),
        prisma.projectLead.count({ where: { orgId: { in: orgIds }, status: "LOST" } }),
        prisma.projectLead.count({ where: { orgId: { in: orgIds }, status: "TRACKING" } }),
      ]);
      stats = { "Cơ hội mới (7 ngày)": newLeads, "Đang theo dõi": tracking, "Đã trúng (cộng dồn)": won, "Không trúng (cộng dồn)": lost };
    } else if (dept === "CONG_VIEC") {
      const [issues, ncrs, daily] = await Promise.all([
        prisma.issue.count({ where: { createdAt: { gte: past7 } } }),
        prisma.nCR.count({ where: { issue: { createdAt: { gte: past7 } } } }),
        prisma.dailyLog.count({ where: { date: { gte: past7 } } }),
      ]);
      stats = { "Issues mới": issues, "NCR mới": ncrs, "Nhật ký công trường (7 ngày)": daily };
    } else if (dept === "DAU_THAU") {
      const [bids, bonds] = await Promise.all([
        prisma.bid.count({ where: { createdAt: { gte: past7 } } }),
        prisma.bidBond.count({ where: { createdAt: { gte: past7 } } }),
      ]);
      stats = { "HSDT mới": bids, "Bảo lãnh dự thầu mới": bonds };
    } else {
      stats = { "Hoạt động 7 ngày qua": 0 };
    }

    for (const [k, v] of Object.entries(stats)) bullets.push(`- ${k}: ${v}`);

    // Compose prompt + call Groq
    const sys = "Bạn là trợ lý văn phòng tóm tắt hoạt động phòng ban bằng tiếng Việt ngắn gọn. Không bịa số liệu.";
    const user = `Tóm tắt hoạt động 7 ngày qua của phòng "${DEPT_LABEL[dept]}" dưới 80 từ. Nêu 1 điểm tích cực, 1 điểm cần chú ý nếu có. Số liệu thực tế:\n${bullets.join("\n")}`;

    const res = await chat([{ role: "system", content: sys }, { role: "user", content: user }]);
    if (!res.ok) {
      return NextResponse.json({
        ok: false, reason: res.reason,
        fallback: `📊 ${DEPT_LABEL[dept]} — hoạt động 7 ngày:\n${bullets.join("\n")}`,
        stats, dept,
      });
    }
    return NextResponse.json({ ok: true, summary: res.data, stats, dept, model: res.model, latencyMs: res.latencyMs });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
