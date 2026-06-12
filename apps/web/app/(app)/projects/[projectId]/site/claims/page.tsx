import Link from "next/link";
import { prisma } from "@atlas/db";
import { Card, CardBody, Badge, stateBadgeVariant } from "@atlas/ui";
import { formatDateVn, formatVndShort } from "@atlas/lib";
import { ClaimForm } from "./form";
import { CLAIM_TYPE_LABEL, CLAIM_STATE_LABEL, CLAIM_DIRECTION_LABEL } from "./labels";

export default async function ClaimsPage({ params }: { params: { projectId: string } }) {
  const claims = await prisma.claim.findMany({
    where: { projectId: params.projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      assignee: { select: { name: true } },
      _count: { select: { events: true, evidence: true, legalBases: true } },
    },
  });

  const now = Date.now();
  const DAY = 86_400_000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Hồ sơ khiếu nại / EOT</h2>
          <p className="text-xs text-slate-500">
            NĐ 37/2015/NĐ-CP Điều 44–45 — khiếu nại và giải quyết tranh chấp hợp đồng xây dựng.
            Nhật ký thi công, sổ TVGS, RFI là xương sống chứng cứ.
          </p>
        </div>
        <ClaimForm projectId={params.projectId} />
      </div>

      <div className="space-y-3">
        {claims.map((c) => {
          const deadlineSoon =
            c.noticeDeadlineAt &&
            ["DRAFT", "EVIDENCE"].includes(c.state) &&
            c.noticeDeadlineAt.getTime() - now < 14 * DAY;
          return (
            <Link key={c.id} href={`/projects/${params.projectId}/site/claims/${c.id}`} className="block">
              <Card className="transition hover:ring-2 hover:ring-blue-200">
                <CardBody className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">{c.key}</span>
                    <span className="text-sm font-semibold text-slate-800">{c.title}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <Badge variant={stateBadgeVariant(c.state)}>{CLAIM_STATE_LABEL[c.state] ?? c.state}</Badge>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <Badge variant="violet">{CLAIM_TYPE_LABEL[c.type] ?? c.type}</Badge>
                    <Badge variant="neutral">{CLAIM_DIRECTION_LABEL[c.direction] ?? c.direction}</Badge>
                    {c.amountVnd != null && (
                      <Badge variant="amber">{formatVndShort(c.amountVnd)}</Badge>
                    )}
                    {c.eotDays != null && <Badge variant="info">EOT {c.eotDays} ngày</Badge>}
                    {deadlineSoon && (
                      <Badge variant="danger">
                        ⚠ Hạn thông báo: {formatDateVn(c.noticeDeadlineAt!)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                    <span>{c._count.events} sự kiện</span>
                    <span>{c._count.evidence} chứng cứ</span>
                    <span>{c._count.legalBases} căn cứ pháp lý</span>
                    {c.assignee && <span>Phụ trách: {c.assignee.name}</span>}
                    <span className="ml-auto">Cập nhật {formatDateVn(c.updatedAt)}</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          );
        })}
        {claims.length === 0 && (
          <Card>
            <CardBody className="py-10 text-center text-sm text-slate-500">
              Chưa có hồ sơ khiếu nại nào. Tạo hồ sơ khi phát sinh sự kiện cần bảo lưu quyền khiếu nại
              (chậm bàn giao mặt bằng, thay đổi thiết kế, chậm thanh toán…).
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
