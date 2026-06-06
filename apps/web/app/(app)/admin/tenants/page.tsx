/**
 * Sales CRM — Tenant pipeline.
 *
 * - List all isTenantDemo organizations
 * - Per-row: prospect details, visit count, status, expires
 * - Actions: extend pilot, archive, convert to paid, view subdomain
 *
 * Access: super-admin OR member of "Atlas team" (the platform-owner org).
 *         Enforced at middleware (main domain only) + here.
 */
import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { TenantRowActions } from "./TenantRowActions";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  PROVISIONING: { vn: "Đang tạo", variant: "info" },
  ACTIVE: { vn: "Đang hoạt động", variant: "success" },
  EXPIRED: { vn: "Hết hạn", variant: "warning" },
  ARCHIVED: { vn: "Lưu trữ", variant: "neutral" },
  CONVERTED: { vn: "Đã chuyển trả phí", variant: "info" },
};

export default async function TenantsAdminPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/admin/tenants");
  if (!session.isSuperAdmin) {
    return (
      <div className="p-12 text-center">
        <div className="text-3xl">🔒</div>
        <h2 className="mt-3 text-xl font-semibold">Cần quyền super-admin</h2>
        <p className="mt-2 text-sm text-slate-600">Liên hệ Atlas team để được cấp quyền truy cập CRM.</p>
      </div>
    );
  }

  const [tenants, totalActive, totalExpired, totalConverted, recentProvisions, last30Visits] = await Promise.all([
    prisma.organization.findMany({
      where: { isTenantDemo: true },
      orderBy: [{ tenantStatus: "asc" }, { tenantProvisionedAt: "desc" }],
      take: 200,
    }),
    prisma.organization.count({ where: { isTenantDemo: true, tenantStatus: "ACTIVE" } }),
    prisma.organization.count({ where: { isTenantDemo: true, tenantStatus: "EXPIRED" } }),
    prisma.organization.count({ where: { isTenantDemo: true, tenantStatus: "CONVERTED" } }),
    prisma.tenantProvisioning.count({
      where: { startedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    }),
    prisma.tenantVisit.count({
      where: { visitedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    }),
  ]);

  const now = Date.now();
  const expiringSoon = tenants.filter((t) => t.tenantExpiresAt && t.tenantExpiresAt.getTime() < now + 3 * 86_400_000 && t.tenantStatus === "ACTIVE").length;

  return (
    <AecModuleShell group="Admin" name="Tenant CRM — Pipeline khách dùng thử" subtitle="Quản lý prospect sandbox: theo dõi, gia hạn, chuyển trả phí. Chỉ super-admin truy cập.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Active</div><div className="mt-1 text-2xl font-bold text-emerald-700">{totalActive}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Sắp hết hạn (≤3 ngày)</div><div className="mt-1 text-2xl font-bold text-amber-700">{expiringSoon}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã hết hạn</div><div className="mt-1 text-2xl font-bold text-slate-700">{totalExpired}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Chuyển trả phí</div><div className="mt-1 text-2xl font-bold text-blue-700">{totalConverted}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Provision 30d</div><div className="mt-1 text-2xl font-bold">{recentProvisions}</div><div className="text-[10px] text-slate-500">{last30Visits} lượt truy cập</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Pipeline ({tenants.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {tenants.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có tenant nào. Khách self-serve tại <a href="https://aecplatform.vn/start" className="text-blue-600 underline">aecplatform.vn/start</a>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Prospect</th>
                  <th className="p-2 text-left">Subdomain</th>
                  <th className="p-2 text-left">Source</th>
                  <th className="p-2 text-right">Visits</th>
                  <th className="p-2 text-left">Tạo</th>
                  <th className="p-2 text-left">Hết hạn</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((t: any) => {
                  const m = STATUS_META[t.tenantStatus ?? "ACTIVE"] ?? STATUS_META.ACTIVE!;
                  const daysLeft = t.tenantExpiresAt ? Math.round((t.tenantExpiresAt.getTime() - now) / 86_400_000) : null;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50" data-testid={`row-tenant-${t.slug}`}>
                      <td className="p-2">
                        <div className="font-medium">{t.prospectName ?? "(no name)"}</div>
                        <div className="text-[10px] text-slate-500">{t.prospectEmail ?? "—"}</div>
                        {t.prospectCompany && <div className="text-[10px] text-slate-500">{t.prospectCompany} · {t.prospectIndustry ?? "—"}</div>}
                      </td>
                      <td className="p-2">
                        <a href={`https://${t.slug}.aecplatform.vn`} target="_blank" rel="noopener" className="font-mono text-xs text-blue-700 underline">{t.slug}</a>
                      </td>
                      <td className="p-2 text-xs">{t.prospectSource ?? "—"}</td>
                      <td className="p-2 text-right">
                        <div className="text-sm font-bold">{t.visitCount}</div>
                        {t.lastVisitedAt && <div className="text-[10px] text-slate-500">{formatDateVn(t.lastVisitedAt)}</div>}
                      </td>
                      <td className="p-2 text-xs">{t.tenantProvisionedAt ? formatDateVn(t.tenantProvisionedAt) : "—"}</td>
                      <td className="p-2 text-xs">
                        {t.tenantExpiresAt ? formatDateVn(t.tenantExpiresAt) : "—"}
                        {daysLeft !== null && daysLeft >= 0 && (
                          <div className={`text-[10px] ${daysLeft <= 3 ? "text-rose-700" : "text-slate-500"}`}>
                            còn {daysLeft} ngày
                          </div>
                        )}
                      </td>
                      <td className="p-2"><Badge variant={m.variant}>{m.vn}</Badge></td>
                      <td className="p-2"><TenantRowActions tenantId={t.id} slug={t.slug} status={t.tenantStatus ?? "ACTIVE"} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Tài khoản OWNER mỗi tenant = email prospect đã đăng ký. Sandbox tự đóng sau 14 ngày. Sau khi đóng → chuyển sang EXPIRED → đọc-only 7 ngày → ARCHIVED → xoá vĩnh viễn.
      </div>
    </AecModuleShell>
  );
}
