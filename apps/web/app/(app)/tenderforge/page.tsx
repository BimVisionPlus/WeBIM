import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  REVIEWING: { vn: "Đang rà soát", variant: "info" },
  READY: { vn: "Sẵn sàng nộp", variant: "warning" },
  SUBMITTED: { vn: "Đã nộp eGP", variant: "violet" },
  AWARDED: { vn: "Trúng thầu", variant: "success" },
  LOST: { vn: "Trượt", variant: "danger" },
  CANCELLED: { vn: "Hủy", variant: "neutral" },
};

const perspectiveLabel: Record<string, string> = {
  BEN_MOI: "HSMT (Bên mời)",
  NHA_THAU: "HSDT (Nhà thầu)",
};

export default async function TenderForgePage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/tenderforge");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);

  const packages = await prisma.tenderPackage.findMany({
    where: { orgId: { in: orgIds } },
    include: { org: { select: { name: true } }, _count: { select: { sections: true } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const submitted = packages.filter((p) => ["SUBMITTED", "AWARDED", "LOST"].includes(p.state)).length;
  const won = packages.filter((p) => p.state === "AWARDED").length;
  const winRate = submitted > 0 ? Math.round((won / submitted) * 100) : 0;
  const totalEstimated = packages.filter((p) => p.state === "AWARDED").reduce((s, p) => s + Number(p.estimatedValueVnd ?? 0n), 0);

  return (
    <AecModuleShell
      group="Đấu thầu"
      name="TenderForge — HSMT/HSDT"
      subtitle="Luật ĐT 22/2023 + NĐ 24/2024 + NĐ 23/2024. Auto-assembly HSMT/HSDT từ template + DinhMucDB pricing + sync muasamcong.mpi.gov.vn."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng gói thầu</div><div className="mt-1 text-2xl font-bold">{packages.length}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã nộp</div><div className="mt-1 text-2xl font-bold text-violet-700">{submitted}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Win rate</div><div className={`mt-1 text-2xl font-bold ${winRate >= 25 ? "text-emerald-700" : "text-amber-700"}`}>{winRate}%</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng giá trị trúng</div><div className="mt-1 text-2xl font-bold">{formatVnd(BigInt(totalEstimated))}</div></CardBody></Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Gói thầu ({packages.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {packages.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có gói thầu nào. Khởi tạo gói HSMT (CĐT) hoặc HSDT (NT) — chọn template ngành để auto-fill các chương.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Mã</th>
                  <th className="p-2 text-left">Tổ chức</th>
                  <th className="p-2 text-left">Vai trò</th>
                  <th className="p-2 text-left">Tiêu đề / Hình thức</th>
                  <th className="p-2 text-right">Giá trị</th>
                  <th className="p-2 text-right">Chương</th>
                  <th className="p-2 text-left">Nộp lúc</th>
                  <th className="p-2 text-left">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packages.map((p) => {
                  const meta = stateLabel[p.state] ?? { vn: p.state, variant: "neutral" as const };
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-2 font-mono text-xs">{p.code}</td>
                      <td className="p-2 text-xs">{p.org.name}</td>
                      <td className="p-2 text-xs">{perspectiveLabel[p.perspective]}</td>
                      <td className="p-2 text-xs"><div className="font-medium">{p.title}</div><div className="text-[10px] text-slate-500">{p.packageType} · {p.selectionMethod}</div></td>
                      <td className="p-2 text-right text-xs">{p.estimatedValueVnd ? formatVnd(p.estimatedValueVnd) : "—"}</td>
                      <td className="p-2 text-right text-xs">{p._count.sections}</td>
                      <td className="p-2 text-xs">{p.submittedAt ? formatDateVn(p.submittedAt) : "—"}</td>
                      <td className="p-2"><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Auto-assembly HSDT</CardTitle></CardHeader>
          <CardBody className="text-sm text-slate-700">
            <ol className="space-y-1.5">
              <li>1. Pull HSMT từ <code>muasamcong</code> (BidRadar) hoặc upload PDF</li>
              <li>2. Qwen2.5 OCR + extract yêu cầu (năng lực, tài chính, kinh nghiệm)</li>
              <li>3. Match profile DN (ContractorRegistry) → fill Chương Năng lực</li>
              <li>4. Pull BoQ + DinhMucDB → fill bảng giá dự thầu</li>
              <li>5. Generate cover letter + bảo lãnh dự thầu (BondVault)</li>
              <li>6. Submit eGP qua muasamcong API</li>
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Compliance engine (Luật 22/2023)</CardTitle></CardHeader>
          <CardBody className="text-sm text-slate-700">
            <ul className="space-y-1.5">
              <li>• <b>Đ.6</b> tư cách hợp lệ NT (mã số thuế, ngành nghề)</li>
              <li>• <b>Đ.9</b> đảm bảo cạnh tranh (≠ TVTK/TVGS gói này)</li>
              <li>• <b>Đ.10</b> ưu đãi (DN nhỏ, sản phẩm trong nước)</li>
              <li>• <b>Đ.14</b> bảo đảm dự thầu (1-3% giá trị)</li>
              <li>• <b>Đ.16</b> thẩm định + đánh giá HSDT</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </AecModuleShell>
  );
}
