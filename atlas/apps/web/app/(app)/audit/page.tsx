import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

function actionTone(action: string): "info" | "warning" | "success" | "danger" | "neutral" {
  if (action.endsWith(".create") || action.endsWith(".promote")) return "success";
  if (action.endsWith(".delete") || action.endsWith(".soft.delete")) return "danger";
  if (action.endsWith(".update") || action.includes(".update.") || action.endsWith(".patch")) return "info";
  if (action.includes(".deactivate") || action.includes(".terminate") || action.includes(".cancel")) return "warning";
  return "neutral";
}

function summarizeDiff(before: unknown, after: unknown): string | null {
  if (!before && !after) return null;
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).slice(0, 4);
  const parts: string[] = [];
  for (const k of keys) {
    const bv = b[k]; const av = a[k];
    if (JSON.stringify(bv) === JSON.stringify(av)) continue;
    if (bv === undefined && av !== undefined) parts.push(`${k}=${JSON.stringify(av)}`);
    else if (av === undefined && bv !== undefined) parts.push(`${k}× ${JSON.stringify(bv)}`);
    else parts.push(`${k}: ${JSON.stringify(bv)} → ${JSON.stringify(av)}`);
  }
  return parts.join(" · ").slice(0, 200);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; action?: string; days?: string; entityId?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/audit");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);

  const sp = await searchParams;
  const entity = (sp.entity ?? "").trim();
  const action = (sp.action ?? "").trim();
  const entityId = (sp.entityId ?? "").trim();
  const days = Math.min(Math.max(Number(sp.days ?? "30"), 1), 365);
  const since = new Date(Date.now() - days * 86400000);

  const projects = await prisma.project.findMany({
    where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] },
    select: { id: true },
  });
  const projectIds = projects.map((p) => p.id);

  const events = await prisma.auditEvent.findMany({
    where: {
      createdAt: { gte: since },
      OR: [{ orgId: { in: orgIds } }, { projectId: { in: projectIds } }, { actorId: session.userId }],
      ...(entity ? { entityType: entity } : {}),
      ...(action ? { action: { contains: action } } : {}),
      ...(entityId ? { entityId } : {}),
    },
    include: { actor: { select: { name: true, email: true } }, org: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const byEntity = new Map<string, number>();
  const byAction = new Map<string, number>();
  for (const e of events) {
    byEntity.set(e.entityType, (byEntity.get(e.entityType) ?? 0) + 1);
    byAction.set(e.action, (byAction.get(e.action) ?? 0) + 1);
  }
  const distinctActors = new Set(events.map((e) => e.actorId).filter(Boolean)).size;
  const writes = events.filter((e) => /\.create|\.update|\.delete|\.patch|\.transition|\.promote/.test(e.action)).length;

  return (
    <AecModuleShell group="Hành chính" name="Sổ kiểm toán (audit log)" subtitle="Mọi thao tác ghi nhận theo NĐ 06/2021 — actor, before/after, IP. Read-only.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Sự kiện {days} ngày</div><div className="mt-1 text-2xl font-bold">{events.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Loại thực thể</div><div className="mt-1 text-2xl font-bold">{byEntity.size}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Người thao tác</div><div className="mt-1 text-2xl font-bold text-blue-700">{distinctActors}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Thao tác ghi</div><div className="mt-1 text-2xl font-bold text-violet-700">{writes}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          {entityId && (
            <div className="mb-3 flex items-center gap-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800" data-testid="entity-focus">
              <span>Đang xem lịch sử của <code className="rounded bg-[rgb(var(--surface))] px-1.5 py-0.5 font-mono text-[10px]">{entityId}</code></span>
              <a href={`/audit?days=${days}${entity ? `&entity=${entity}` : ""}${action ? `&action=${action}` : ""}`} className="ml-auto text-[11px] font-medium text-blue-700 hover:underline">× Xoá bộ lọc theo entity</a>
            </div>
          )}
          <form className="flex flex-wrap items-end gap-3" method="get">
            {entityId && <input type="hidden" name="entityId" value={entityId} />}
            <div><label className="text-xs text-[rgb(var(--muted))]">Loại thực thể</label>
              <select name="entity" defaultValue={entity} className="mt-1 rounded border border-[rgb(var(--line-2))] px-3 py-1.5 text-sm">
                <option value="">Tất cả</option>
                {Array.from(byEntity.keys()).sort().map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div><label className="text-xs text-[rgb(var(--muted))]">Action chứa</label><input name="action" defaultValue={action} placeholder="vd: create, delete, promote" className="mt-1 rounded border border-[rgb(var(--line-2))] px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-[rgb(var(--muted))]">Trong (ngày)</label><input type="number" name="days" min={1} max={365} defaultValue={days} className="mt-1 w-24 rounded border border-[rgb(var(--line-2))] px-3 py-1.5 text-sm" /></div>
            <button className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700">Lọc</button>
            <a
              href={`/api/audit/export?days=${days}${entity ? `&entity=${entity}` : ""}${action ? `&action=${action}` : ""}${entityId ? `&entityId=${entityId}` : ""}`}
              className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              data-testid="export-csv"
              download
            >📥 Xuất CSV</a>
          </form>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader><CardTitle>Sự kiện ({events.length}{events.length === 200 && " — giới hạn 200, lọc thêm"})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {events.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Không có sự kiện nào phù hợp.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Thời điểm</th><th className="p-2 text-left">Người</th><th className="p-2 text-left">Action</th><th className="p-2 text-left">Đối tượng</th><th className="p-2 text-left">Thay đổi</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {events.map((e) => {
                  const diff = summarizeDiff(e.before, e.after);
                  return (
                    <tr key={e.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`audit-${e.id}`}>
                      <td className="p-2 text-xs text-[rgb(var(--muted))]">{formatDateVn(e.createdAt)}<div className="text-[10px] text-[rgb(var(--muted-2))]">{e.createdAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div></td>
                      <td className="p-2 text-xs"><div>{e.actor?.name ?? <span className="italic text-[rgb(var(--muted-2))]">hệ thống</span>}</div>{e.actor?.email && <div className="text-[10px] text-[rgb(var(--muted))]">{e.actor.email}</div>}</td>
                      <td className="p-2"><Badge variant={actionTone(e.action)}>{e.action}</Badge></td>
                      <td className="p-2 text-xs"><div className="font-medium text-[rgb(var(--ink-2))]">{e.entityType}</div>{e.entityId && <div className="font-mono text-[10px] text-[rgb(var(--muted))]">{e.entityId.slice(-12)}</div>}</td>
                      <td className="p-2 text-[11px] text-[rgb(var(--ink-2))]">{diff ?? <span className="text-[rgb(var(--muted-2))]">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </AecModuleShell>
  );
}
