import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge, stateBadgeVariant } from "@atlas/ui";
import { formatDateVn, formatVnd } from "@atlas/lib";
import {
  CLAIM_TYPE_LABEL,
  CLAIM_STATE_LABEL,
  CLAIM_DIRECTION_LABEL,
  EVENT_KIND_LABEL,
  EVIDENCE_KIND_LABEL,
} from "../labels";
import {
  TransitionControls,
  AddEventForm,
  EvidenceScanner,
  LegalBasisPanel,
  StatementPanel,
} from "./controls";

export default async function ClaimDetailPage({
  params,
}: {
  params: { projectId: string; claimId: string };
}) {
  const claim = await prisma.claim.findUnique({
    where: { id: params.claimId },
    include: {
      createdBy: { select: { name: true } },
      assignee: { select: { name: true } },
      events: { orderBy: { occurredAt: "asc" }, include: { createdBy: { select: { name: true } } } },
      evidence: { orderBy: [{ capturedAt: "asc" }, { createdAt: "asc" }] },
      legalBases: {
        orderBy: { createdAt: "asc" },
        include: { regulation: { select: { code: true, title: true, url: true } } },
      },
    },
  });
  if (!claim || claim.projectId !== params.projectId) notFound();

  const regulations = await prisma.regulation.findMany({
    where: { status: "IN_FORCE", kind: { in: ["LUAT", "NGHI_DINH", "THONG_TU"] } },
    orderBy: { code: "asc" },
    select: { code: true, title: true },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
            <Link href={`/projects/${params.projectId}/site/claims`} className="hover:text-blue-600">
              ← Khiếu nại
            </Link>
            <span className="font-mono">{claim.key}</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold">{claim.title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={stateBadgeVariant(claim.state)}>{CLAIM_STATE_LABEL[claim.state] ?? claim.state}</Badge>
            <Badge variant="violet">{CLAIM_TYPE_LABEL[claim.type] ?? claim.type}</Badge>
            <Badge variant="neutral">{CLAIM_DIRECTION_LABEL[claim.direction] ?? claim.direction}</Badge>
            {claim.amountVnd != null && <Badge variant="amber">{formatVnd(claim.amountVnd)}</Badge>}
            {claim.eotDays != null && <Badge variant="info">EOT {claim.eotDays} ngày</Badge>}
          </div>
        </div>
        <TransitionControls claimId={claim.id} state={claim.state} />
      </div>

      {/* Meta */}
      <Card>
        <CardBody className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Meta label="Bên bị khiếu nại" value={claim.counterparty} />
          <Meta label="Điều khoản hợp đồng" value={claim.contractRef} />
          <Meta
            label="Thời gian sự kiện"
            value={
              claim.periodStart
                ? `${formatDateVn(claim.periodStart)} → ${claim.periodEnd ? formatDateVn(claim.periodEnd) : "nay"}`
                : null
            }
          />
          <Meta
            label="Hạn thông báo"
            value={claim.noticeDeadlineAt ? formatDateVn(claim.noticeDeadlineAt) : null}
            danger={
              !!claim.noticeDeadlineAt &&
              ["DRAFT", "EVIDENCE"].includes(claim.state) &&
              claim.noticeDeadlineAt.getTime() - Date.now() < 14 * 86_400_000
            }
          />
          {claim.description && (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--muted))]">Mô tả</div>
              <p className="mt-1 whitespace-pre-wrap text-[rgb(var(--ink-2))]">{claim.description}</p>
            </div>
          )}
          {claim.resolutionNote && (
            <div className="sm:col-span-2 lg:col-span-4 rounded-md bg-emerald-50 p-3 text-xs text-emerald-900 ring-1 ring-inset ring-emerald-200">
              <div className="font-semibold">Kết quả giải quyết</div>
              <p className="mt-0.5 whitespace-pre-wrap">{claim.resolutionNote}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Timeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Diễn biến sự việc ({claim.events.length})</CardTitle>
              <AddEventForm claimId={claim.id} />
            </div>
          </CardHeader>
          <CardBody>
            <ol className="relative space-y-4 border-l border-[rgb(var(--line))] pl-4">
              {claim.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-[rgb(var(--inverse-ink))]" />
                  <div className="text-xs text-[rgb(var(--muted))]">
                    {formatDateVn(e.occurredAt)} · {EVENT_KIND_LABEL[e.kind] ?? e.kind}
                  </div>
                  <div className="text-sm font-medium text-[rgb(var(--ink-2))]">{e.title}</div>
                  {e.detail && <p className="mt-0.5 whitespace-pre-wrap text-xs text-[rgb(var(--muted))]">{e.detail}</p>}
                  {e.sourceTable && (
                    <div className="mt-0.5 text-[11px] text-[rgb(var(--muted-2))]">
                      Nguồn: {e.sourceTable} #{e.sourceId?.slice(0, 8)}
                    </div>
                  )}
                </li>
              ))}
              {claim.events.length === 0 && (
                <li className="text-sm text-[rgb(var(--muted))]">
                  Chưa có sự kiện. Ghi lại diễn biến theo trình tự thời gian — đây là xương sống của lập luận nhân quả.
                </li>
              )}
            </ol>
          </CardBody>
        </Card>

        {/* Evidence */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Chứng cứ ({claim.evidence.length})</CardTitle>
              <EvidenceScanner claimId={claim.id} />
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {claim.evidence.map((ev, i) => (
              <div key={ev.id} className="rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--raised))]/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[rgb(var(--muted-2))]">[CC-{i + 1}]</span>
                  <Badge variant="info">{EVIDENCE_KIND_LABEL[ev.kind] ?? ev.kind}</Badge>
                  {ev.capturedAt && <span className="text-[rgb(var(--muted))]">{formatDateVn(ev.capturedAt)}</span>}
                </div>
                <div className="mt-1 text-sm text-[rgb(var(--ink-2))]">{ev.title}</div>
                {ev.note && <p className="mt-0.5 text-xs text-[rgb(var(--muted))]">{ev.note}</p>}
              </div>
            ))}
            {claim.evidence.length === 0 && (
              <p className="text-sm text-[rgb(var(--muted))]">
                Chưa có chứng cứ. Dùng <strong>Quét chứng cứ</strong> để tìm nhật ký thi công, sổ TVGS,
                RFI, lệnh thay đổi trong khoảng thời gian sự kiện.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Legal basis */}
      <LegalBasisPanel
        claimId={claim.id}
        regulations={regulations}
        bases={claim.legalBases.map((b) => ({
          id: b.id,
          regulationCode: b.regulation.code,
          regulationTitle: b.regulation.title,
          regulationUrl: b.regulation.url,
          articleRef: b.articleRef,
          argument: b.argument,
          source: b.source,
          aiConfidence: b.aiConfidence,
        }))}
      />

      {/* Statement */}
      <StatementPanel claimId={claim.id} statementMd={claim.statementMd} hasBases={claim.legalBases.length > 0} />

      <div className="text-xs text-[rgb(var(--muted-2))]">
        Người lập: {claim.createdBy.name}
        {claim.assignee && ` · Phụ trách: ${claim.assignee.name}`} · Tạo {formatDateVn(claim.createdAt)}
        {claim.submittedAt && ` · Gửi ${formatDateVn(claim.submittedAt)}`}
      </div>
    </div>
  );
}

function Meta({ label, value, danger }: { label: string; value: string | null | undefined; danger?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--muted))]">{label}</div>
      <div className={`mt-1 text-sm ${danger ? "font-semibold text-rose-600" : "text-[rgb(var(--ink-2))]"}`}>
        {value ?? <span className="text-[rgb(var(--muted-2))]">—</span>}
        {danger && " ⚠"}
      </div>
    </div>
  );
}
