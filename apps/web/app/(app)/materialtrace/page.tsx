import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, RowActions } from "./Actions";

export const dynamic = "force-dynamic";

const catLabel: Record<string, string> = {
  XI_MANG: "Xi măng", THEP: "Thép", KINH: "Kính XD", GACH: "Gạch",
  BE_TONG_TUOI: "BT thương phẩm", SON: "Sơn", PHU_GIA: "Phụ gia", OTHER: "Khác",
};

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  RECEIVED: { vn: "Đã nhận", variant: "info" },
  TESTING: { vn: "Đang thí nghiệm", variant: "warning" },
  ACCEPTED: { vn: "Chấp thuận", variant: "success" },
  REJECTED: { vn: "Trả NCC", variant: "danger" },
  PARTIAL_USED: { vn: "Dùng dở", variant: "violet" },
  USED_UP: { vn: "Hết", variant: "neutral" },
};

export default async function MaterialTracePage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/materialtrace");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const lots = await prisma.materialLot.findMany({
    where: { project: projectFilter },
    include: { project: { select: { key: true } }, supplierOrg: { select: { name: true } } },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });

  const accessibleProjects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } });

  const total = lots.length;
  const rejected = lots.filter((l) => l.state === "REJECTED").length;
  const noCo = lots.filter((l) => !l.coDocUrl).length;
  const noCr = lots.filter((l) => ["XI_MANG", "THEP", "KINH", "GACH"].includes(l.category) && !l.crCertNo).length;
  const byCat = new Map<string, number>();
  lots.forEach((l) => byCat.set(l.category, (byCat.get(l.category) ?? 0) + 1));

  return (
    <AecModuleShell
      group="Thi công"
      name="MaterialTrace — Truy xuất nguồn gốc VL"
      subtitle="CO/CQ + hợp quy CR (QCVN 7:2018 thép, QCVN 16:2023 xi măng/kính/gạch). QR lot scan tại cổng/kho. Pairs với LabReports + EIAFlow."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Tổng lô VL</div><div className="mt-1 text-2xl font-bold">{total}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Đã trả NCC</div><div className="mt-1 text-2xl font-bold text-rose-700">{rejected}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Thiếu CO</div><div className="mt-1 text-2xl font-bold text-amber-700">{noCo}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-slate-500">Thiếu CR hợp quy</div><div className="mt-1 text-2xl font-bold text-amber-700">{noCr}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lô vật liệu nhận ({total})</CardTitle>
            <div className="text-xs text-slate-500">{Array.from(byCat.entries()).map(([k, v]) => `${catLabel[k]}: ${v}`).join(" · ")}</div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {lots.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">Chưa có lô VL. Seed: <code>scripts/seed-materialtrace.ts</code></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-2 text-left">Lot</th>
                  <th className="p-2 text-left">Vật liệu</th>
                  <th className="p-2 text-left">Loại</th>
                  <th className="p-2 text-left">Nhận / NSX</th>
                  <th className="p-2 text-right">SL</th>
                  <th className="p-2 text-left">NCC</th>
                  <th className="p-2 text-left">CO/CQ/CR</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lots.map((l) => {
                  const meta = stateLabel[l.state] ?? { vn: l.state, variant: "neutral" as const };
                  const needsCr = ["XI_MANG", "THEP", "KINH", "GACH"].includes(l.category);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50" data-testid={`lot-${l.lotCode}`}>
                      <td className="p-2 font-mono text-xs">{l.lotCode}</td>
                      <td className="p-2 text-xs"><div className="font-medium">{l.materialName}</div><div className="text-[10px] text-slate-500">{l.manufacturer}{l.origin && ` · ${l.origin}`}</div></td>
                      <td className="p-2 text-xs">{catLabel[l.category]}</td>
                      <td className="p-2 text-xs">{formatDateVn(l.receivedAt)}</td>
                      <td className="p-2 text-right text-xs">{Number(l.quantity).toLocaleString("vi-VN")} {l.unit}</td>
                      <td className="p-2 text-xs">{l.supplierOrg?.name ?? "—"}</td>
                      <td className="p-2 text-[10px]">
                        <span className={l.coDocUrl ? "text-emerald-700" : "text-rose-700"}>CO {l.coDocUrl ? "✓" : "✗"}</span>{" · "}
                        <span className={l.cqDocUrl ? "text-emerald-700" : "text-amber-700"}>CQ {l.cqDocUrl ? "✓" : "?"}</span>
                        {needsCr && <><br/><span className={l.crCertNo ? "text-emerald-700" : "text-rose-700"}>CR {l.crCertNo ? "✓" : "✗"}</span>{l.crCertNo && <span className="text-slate-500"> · {l.crCertNo}</span>}</>}
                      </td>
                      <td className="p-2" data-testid={`state-${l.lotCode}`}><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2"><RowActions id={l.id} state={l.state} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 text-[11px] text-slate-500">
        QR lot scan ngoài công trường → check spec → reject if expired/no CR.
        OSS: <code>node-qrcode</code> sinh QR, <code>quagga2</code> đọc QR/barcode.
        Hợp quy CR bắt buộc cho thép QCVN 7:2018, xi măng/kính/gạch QCVN 16:2023.
      </div>
    </AecModuleShell>
  );
}
