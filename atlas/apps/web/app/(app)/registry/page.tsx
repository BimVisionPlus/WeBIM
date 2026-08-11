import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, RowActions } from "./Actions";

export const dynamic = "force-dynamic";

const classLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  HANG_I: { vn: "Hạng I", variant: "violet" },
  HANG_II: { vn: "Hạng II", variant: "info" },
  HANG_III: { vn: "Hạng III", variant: "warning" },
  CHUA_PHAN_HANG: { vn: "Chưa phân hạng", variant: "neutral" },
};

export default async function ContractorRegistryPage({ searchParams }: { searchParams: Promise<{ q?: string; class?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/registry");

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const cls = params.class?.trim() ?? "";

  const where: Record<string, unknown> = {};
  if (cls) where.capabilityClass = cls;
  if (q) where.OR = [
    { legalName: { contains: q, mode: "insensitive" } },
    { mst: { contains: q } },
    { org: { name: { contains: q, mode: "insensitive" } } },
  ];

  const profiles = await prisma.contractorProfile.findMany({
    where,
    include: { org: { select: { name: true, type: true } }, _count: { select: { performances: true, references: true } } },
    orderBy: [{ blacklisted: "asc" }, { rating: "desc" }],
    take: 100,
  });

  const allOrgs = await prisma.organization.findMany({ where: { type: { in: ["NHA_THAU_CHINH", "NHA_THAU_PHU", "TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE", "NHA_CUNG_CAP"] } }, select: { id: true, name: true, mst: true }, orderBy: { name: "asc" } });
  const total = await prisma.contractorProfile.count();
  const blacklisted = await prisma.contractorProfile.count({ where: { blacklisted: true } });
  const hangI = await prisma.contractorProfile.count({ where: { capabilityClass: "HANG_I" } });

  return (
    <AecModuleShell
      group="Đấu thầu"
      name="ContractorRegistry — Sổ năng lực"
      subtitle="NĐ 15/2021. Hạng I/II/III năng lực hoạt động XD + chứng chỉ năng lực hành nghề. Cross-project vetting + blacklist + rating đa chiều."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Tổng DN</div><div className="mt-1 text-2xl font-bold">{total}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Hạng I</div><div className="mt-1 text-2xl font-bold text-violet-700">{hangI}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Blacklist</div><div className="mt-1 text-2xl font-bold text-rose-700">{blacklisted}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Hiển thị</div><div className="mt-1 text-2xl font-bold">{profiles.length}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="grow min-w-[260px]"><label className="text-xs text-[rgb(var(--muted))]">Tìm theo tên / MST</label><input name="q" defaultValue={q} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-3 py-1.5 text-sm" /></div>
            <div><label className="text-xs text-[rgb(var(--muted))]">Hạng</label>
              <select name="class" defaultValue={cls} className="mt-1 rounded border border-[rgb(var(--line-2))] px-3 py-1.5 text-sm">
                <option value="">Tất cả</option>
                <option value="HANG_I">Hạng I</option>
                <option value="HANG_II">Hạng II</option>
                <option value="HANG_III">Hạng III</option>
                <option value="CHUA_PHAN_HANG">Chưa phân hạng</option>
              </select>
            </div>
            <button className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700">Tra cứu</button>
          </form>
        </CardBody>
      </Card>

      <div className="mt-4"><CreateForm orgs={allOrgs} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Sổ năng lực ({profiles.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {profiles.length === 0 ? (
            <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">Chưa có hồ sơ doanh nghiệp. Bấm “Đăng ký năng lực” để thêm.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Tên DN / MST</th>
                  <th className="p-2 text-left">Hạng / Số CCNL</th>
                  <th className="p-2 text-left">Phạm vi</th>
                  <th className="p-2 text-right">KS chính</th>
                  <th className="p-2 text-right">DA đã làm</th>
                  <th className="p-2 text-right">Tổng giá trị</th>
                  <th className="p-2 text-right">Rating</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {profiles.map((p) => {
                  const meta = classLabel[p.capabilityClass] ?? { vn: p.capabilityClass, variant: "neutral" as const };
                  return (
                    <tr key={p.id} className={`hover:bg-[rgb(var(--raised))] ${p.blacklisted ? "bg-rose-50" : ""}`} data-testid={`profile-${p.id}`}>
                      <td className="p-2 text-xs"><div className="font-medium">{p.legalName}</div><div className="text-[10px] text-[rgb(var(--muted))]">MST: {p.mst ?? "—"} · {p.org.name}</div></td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge>{p.capabilityNo && <div className="text-[10px] font-mono text-[rgb(var(--muted))] mt-0.5">{p.capabilityNo}</div>}{p.capabilityExpiry && <div className="text-[10px] text-[rgb(var(--muted))]">đến {formatDateVn(p.capabilityExpiry)}</div>}</td>
                      <td className="p-2 text-[11px] text-[rgb(var(--ink-2))]">{p.capabilityScope.slice(0, 2).join(" · ")}{p.capabilityScope.length > 2 && ` +${p.capabilityScope.length - 2}`}</td>
                      <td className="p-2 text-right text-xs">{p.charteredEng}</td>
                      <td className="p-2 text-right text-xs">{p.pastProjects}</td>
                      <td className="p-2 text-right text-xs">{p.pastValueVnd ? formatVnd(p.pastValueVnd) : "—"}</td>
                      <td className="p-2 text-right text-xs">{p.rating ? <span className="font-bold">{p.rating.toString()}<span className="text-[10px] text-[rgb(var(--muted))]">/5</span></span> : "—"}</td>
                      <td className="p-2" data-testid={`status-${p.id}`}>{p.blacklisted ? <Badge variant="danger">Blacklist</Badge> : <Badge variant="success">OK</Badge>}{p.blacklisted && p.blacklistReason && <div className="text-[10px] text-rose-700 mt-1 line-clamp-2">{p.blacklistReason}</div>}</td>
                      <td className="p-2"><RowActions id={p.id} blacklisted={p.blacklisted} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 text-[11px] text-[rgb(var(--muted))]">
        Phân hạng theo NĐ 15/2021 Điều 67-68: Hạng I cần ≥5 KS chính + ≥3 DA cấp I, Hạng II ≥3 KS + DA cấp II.
        Rating tự động từ performance lịch sử (schedule/quality/safety/cost).
      </div>
    </AecModuleShell>
  );
}
