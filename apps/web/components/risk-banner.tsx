import { prisma } from "@atlas/db";

type Filter = { OR: Array<Record<string, unknown>> };

/**
 * Server component — shows a strip of computed risks across all modules.
 * Pulls from existing data; no new tables. Quiet when there are zero risks.
 */
export async function RiskBanner({ orgIds, accessFilter }: { orgIds: string[]; accessFilter: Filter }) {
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86400000);
  const past30 = new Date(now.getTime() - 30 * 86400000);

  const [overdueAdvances, expiringCerts, slippingProjects, staleLeads, pendingBhxh] = await Promise.all([
    prisma.advanceTransaction.count({
      where: { orgId: { in: orgIds }, type: "TAM_UNG", status: { in: ["PENDING", "APPROVED"] }, txnDate: { lt: past30 } },
    }),
    prisma.hseCertificate.count({
      where: { orgId: { in: orgIds }, expiresAt: { lte: in7d, gte: now }, state: "ACTIVE" },
    }).catch(() => 0),
    prisma.project.count({
      where: { AND: [accessFilter, { department: "CONG_VIEC", endDate: { lt: now }, status: { in: ["PLANNING", "IN_PROGRESS"] } }] },
    }),
    prisma.projectLead.count({
      where: { orgId: { in: orgIds }, status: "TRACKING", OR: [{ nextActionAt: null }, { nextActionAt: { lt: now } }] },
    }),
    prisma.socialInsuranceRecord.count({
      where: { orgId: { in: orgIds }, status: "CHO_DANG_KY" },
    }),
  ]);

  const items: { label: string; count: number; href: string; tone: "amber" | "rose" }[] = [];
  if (overdueAdvances > 0) items.push({ label: `Tạm ứng > 30 ngày chưa quyết toán`, count: overdueAdvances, href: "/advances", tone: "rose" });
  if (expiringCerts > 0) items.push({ label: `Chứng chỉ ATLĐ hết hạn ≤ 7 ngày`, count: expiringCerts, href: "/hsetrain", tone: "amber" });
  if (slippingProjects > 0) items.push({ label: `Dự án CONG_VIEC quá deadline`, count: slippingProjects, href: "/?tab=CONG_VIEC", tone: "rose" });
  if (staleLeads > 0) items.push({ label: `Lead theo dõi chưa lên lịch follow-up`, count: staleLeads, href: "/leads", tone: "amber" });
  if (pendingBhxh > 0) items.push({ label: `NLĐ chờ đăng ký BHXH`, count: pendingBhxh, href: "/bhxh", tone: "amber" });

  if (items.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3" data-testid="risk-banner">
      <span className="text-xs font-semibold uppercase tracking-wide text-rose-800">⚠ Cần chú ý</span>
      {items.map((it) => (
        <a
          key={it.label}
          href={it.href}
          className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${it.tone === "rose" ? "bg-rose-100 text-rose-800 ring-rose-200 hover:bg-rose-200" : "bg-amber-100 text-amber-800 ring-amber-200 hover:bg-amber-200"}`}
          data-testid={`risk-${it.label.slice(0,12).replace(/\s/g,'-')}`}
        >
          <span className="rounded-full bg-white/70 px-1.5">{it.count}</span>
          <span>{it.label}</span>
        </a>
      ))}
    </div>
  );
}
