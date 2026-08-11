import { DeleteRow } from "./DeleteRow";

import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateVn } from "@atlas/lib";
import { AecModuleShell } from "@/components/aec-module-shell";
import { CreateForm, RowActions } from "./Actions";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, { vn: string; variant: "neutral" | "info" | "warning" | "success" | "danger" | "violet" }> = {
  DRAFT: { vn: "Nháp", variant: "neutral" },
  TVGS_SIGNED: { vn: "TVGS ký", variant: "info" },
  NT_SIGNED: { vn: "NT ký", variant: "warning" },
  CDT_SIGNED: { vn: "CĐT ký", variant: "violet" },
  FINALIZED: { vn: "Hoàn tất", variant: "success" },
};

const shiftLabel: Record<string, string> = { DAY: "Ngày", NIGHT: "Đêm", FULL: "Cả ngày" };

export default async function SuperviseLogPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/supervise");

  const memberships = await prisma.membership.findMany({ where: { userId: session.userId }, select: { orgId: true } });
  const orgIds = memberships.map((m) => m.orgId);
  const projectFilter = {
    OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }],
  };

  const entries = await prisma.superviseEntry.findMany({
    where: { project: projectFilter },
    include: {
      project: { select: { key: true } },
      supervisorOrg: { select: { name: true } },
      supervisorUser: { select: { name: true } },
    },
    orderBy: { logDate: "desc" },
    take: 50,
  });

  const accessibleProjects = await prisma.project.findMany({ where: projectFilter, select: { id: true, key: true, name: true }, orderBy: { key: "asc" } });

  const finalized = entries.filter((e) => e.state === "FINALIZED").length;
  const pendingNT = entries.filter((e) => e.state === "TVGS_SIGNED").length;
  const pendingCDT = entries.filter((e) => e.state === "NT_SIGNED").length;
  const withTranscript = entries.filter((e) => e.voiceTranscript).length;

  return (
    <AecModuleShell
      group="Thi công"
      name="SuperviseLog — Nhật ký TVGS"
      subtitle="NĐ 06/2021 Điều 10. Bản ghi giám sát ca/ngày, ký số chuỗi TVGS→NT→CĐT. Voice-to-text qua whisper.cpp. Output VIIIb.6."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Hoàn tất ký số</div><div className="mt-1 text-2xl font-bold text-emerald-700">{finalized}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Chờ NT ký</div><div className="mt-1 text-2xl font-bold text-amber-700">{pendingNT}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Chờ CĐT ký</div><div className="mt-1 text-2xl font-bold text-violet-700">{pendingCDT}</div></CardBody></Card>
        <Card><CardBody className="py-3"><div className="text-xs text-[rgb(var(--muted))]">Có voice transcript</div><div className="mt-1 text-2xl font-bold text-blue-700">{withTranscript}</div></CardBody></Card>
      </div>

      <div className="mt-6"><CreateForm projects={accessibleProjects} /></div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Nhật ký TVGS ({entries.length})</CardTitle></CardHeader>
        <CardBody className="p-0">
          {entries.length === 0 ? (
            <div className="p-8 text-center text-sm text-[rgb(var(--muted))]">
              Chưa có nhật ký TVGS. KS giám sát ghi nhật ký mỗi ca + ký số → NT đồng ý → CĐT duyệt.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr>
                  <th className="p-2 text-left">Ngày</th>
                  <th className="p-2 text-left">Ca</th>
                  <th className="p-2 text-left">Dự án</th>
                  <th className="p-2 text-left">TVGS</th>
                  <th className="p-2 text-left">Công việc + chất lượng + ATLĐ</th>
                  <th className="p-2 text-left">Ảnh</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-left">Ký số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {entries.map((e) => {
                  const meta = stateLabel[e.state] ?? { vn: e.state, variant: "neutral" as const };
                  return (
                    <tr key={e.id} className="hover:bg-[rgb(var(--raised))] align-top" data-testid={`row-${e.id}`}>
                      <td className="p-2 text-xs">{formatDateVn(e.logDate)}</td>
                      <td className="p-2 text-xs">{shiftLabel[e.shift]}</td>
                      <td className="p-2 text-xs font-mono text-[rgb(var(--muted))]">{e.project.key}</td>
                      <td className="p-2 text-xs">{e.supervisorUser?.name ?? "—"}<div className="text-[10px] text-[rgb(var(--muted))]">{e.supervisorOrg?.name ?? ""}</div></td>
                      <td className="p-2 text-xs">
                        <div className="font-medium line-clamp-1">{e.workItems}</div>
                        {e.qualityNotes && <div className="text-[10px] text-[rgb(var(--muted))] line-clamp-1">CL: {e.qualityNotes}</div>}
                        {e.safetyNotes && <div className="text-[10px] text-amber-700 line-clamp-1">AT: {e.safetyNotes}</div>}
                        {e.voiceTranscript && <div className="text-[10px] text-blue-700">🎤 voice</div>}
                      </td>
                      <td className="p-2 text-xs">{e.photoUrls.length}</td>
                      <td className="p-2" data-testid={`state-${e.id}`}><Badge variant={meta.variant}>{meta.vn}</Badge></td>
                      <td className="p-2"><RowActions id={e.id} state={e.state} /></td>
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
          <CardHeader><CardTitle>Liên kết module</CardTitle></CardHeader>
          <CardBody className="text-sm text-[rgb(var(--ink-2))]">
            <ul className="space-y-1.5">
              <li>• <b>DailyLog</b> — entry NT auto-fill workItems</li>
              <li>• <b>SiteEye</b> — photoUrls + PPE detection events</li>
              <li>• <b>LabReports</b> — testRefs link mẫu vật liệu</li>
              <li>• <b>QAQC</b> — acceptanceIds gắn BBNT trong ca</li>
              <li>• <b>HoanCong</b> — VIIIb.6 auto-fed mỗi entry FINALIZED</li>
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>OSS voice-to-text pipeline</CardTitle></CardHeader>
          <CardBody className="text-sm text-[rgb(var(--ink-2))]">
            <ol className="space-y-1.5">
              <li>1. Ghi âm điện thoại field engineer (~30-60s)</li>
              <li>2. Upload MP3 → <code>whisper.cpp</code> (model <code>vi-medium</code>)</li>
              <li>3. Transcript tiếng Việt vào <code>voiceTranscript</code></li>
              <li>4. LLM Qwen2.5-7B local extract: workItems/quality/safety</li>
              <li>5. KS chỉnh sửa nhẹ + ký số</li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </AecModuleShell>
  );
}
