import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm } from "./CreateForm";
import { PromoteAction } from "./PromoteAction";
import { RowActions } from "./RowActions";
import { AuditHistoryLink } from "@/components/audit-history-link";

export const dynamic = "force-dynamic";

const statusMeta: Record<string, { vn: string; variant: "info" | "warning" | "success" | "neutral" | "danger" }> = {
  POTENTIAL: { vn: "Tiềm năng", variant: "neutral" },
  TRACKING: { vn: "Đang theo dõi", variant: "info" },
  WON: { vn: "Đã trúng", variant: "success" },
  LOST: { vn: "Không trúng", variant: "danger" },
  ARCHIVED: { vn: "Lưu trữ", variant: "neutral" },
};

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/leads");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, include: { org: { select: { id: true, name: true } } } });
  const orgs = memberships.map((m) => m.org);
  const orgIds = orgs.map((o) => o.id);

  const [leads, territories] = await Promise.all([
    prisma.projectLead.findMany({ where: { orgId: { in: orgIds } }, include: { org: { select: { name: true } }, territory: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.marketTerritory.findMany({ where: { orgId: { in: orgIds } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const potential = leads.filter((l) => l.status === "POTENTIAL").length;
  const tracking = leads.filter((l) => l.status === "TRACKING").length;
  const won = leads.filter((l) => l.status === "WON").length;
  const pipelineValue = leads.filter((l) => ["POTENTIAL","TRACKING"].includes(l.status)).reduce((s, l) => s + Number(l.estValueVnd ?? 0), 0);

  return (
    <AecModuleShell group="Phát triển thị trường" name="Dự án đang theo & tiềm năng" subtitle="Pipeline cơ hội đấu thầu — tiềm năng → đang theo → trúng / không trúng.">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng cơ hội</div><div className="mt-1 text-2xl font-bold">{leads.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tiềm năng</div><div className="mt-1 text-2xl font-bold text-[rgb(var(--ink-2))]">{potential}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Đang theo dõi</div><div className="mt-1 text-2xl font-bold text-blue-700">{tracking}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Pipeline value</div><div className="mt-1 text-xl font-bold">{formatVnd(BigInt(pipelineValue))}</div><div className="text-[10px] text-emerald-700">{won} đã trúng</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm orgs={orgs} territories={territories} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Pipeline ({leads.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">Chưa có cơ hội nào trong pipeline. Bấm "Thêm cơ hội" để bắt đầu.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Dự án / Gói thầu</th><th className="p-2 text-left">Khách hàng</th><th className="p-2 text-left">Địa bàn</th><th className="p-2 text-right">Giá trị</th><th className="p-2 text-left">Trạng thái</th><th className="p-2 text-left">Next action</th><th className="p-2 text-left">Thao tác</th><th className="p-2 text-left">Promote</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {leads.map((l) => {
                  const m = statusMeta[l.status] ?? { vn: l.status, variant: "neutral" as const };
                  return (
                    <tr key={l.id} className="hover:bg-[rgb(var(--raised))]" data-testid={`row-lead-${l.id}`}>
                      <td className="p-2"><div className="font-medium">{l.name}</div><div className="text-[10px] text-[rgb(var(--muted))]">{l.source ?? "—"} · {l.province ?? "—"}</div></td>
                      <td className="p-2 text-xs">{l.clientName ?? "—"}</td>
                      <td className="p-2 text-xs">{l.territory?.name ?? <span className="text-[rgb(var(--muted-2))]">—</span>}</td>
                      <td className="p-2 text-right font-medium">{l.estValueVnd ? formatVnd(l.estValueVnd) : "—"}</td>
                      <td className="p-2"><Badge variant={m.variant}>{m.vn}</Badge></td>
                      <td className="p-2 text-xs">{l.nextActionAt ? formatDateVn(l.nextActionAt) : "—"}</td>
                      <td className="p-2"><span className="inline-flex items-center gap-2"><RowActions id={l.id} status={l.status} initial={{ name: l.name, clientName: l.clientName, province: l.province, estValueVnd: l.estValueVnd ? l.estValueVnd.toString() : null, source: l.source, nextActionAt: l.nextActionAt ? l.nextActionAt.toISOString().slice(0,10) : null, note: l.note }} /><AuditHistoryLink entityId={l.id} entityType="ProjectLead" /></span></td><td className="p-2">{l.status === "WON" ? <PromoteAction leadId={l.id} orgId={l.orgId} suggestedKey={l.name.split(" ").map((w) => w[0]).filter((c) => /[A-Za-zĐ]/.test(c ?? "")).join("").toUpperCase().slice(0, 6) || "DA-" + l.id.slice(-4).toUpperCase()} /> : <span className="text-[10px] text-[rgb(var(--muted-2))]">—</span>}</td>
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
