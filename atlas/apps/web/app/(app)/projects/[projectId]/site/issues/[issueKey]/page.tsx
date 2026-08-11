import { notFound } from "next/navigation";
import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge, stateBadgeVariant } from "@atlas/ui";
import { getWorkflow, nextStates, type WorkflowKey } from "@atlas/workflows";
import { issueTypeMeta, formatDateTimeVn, formatVndShort } from "@atlas/lib";
import { TransitionButtons } from "@/components/transition-buttons";
import { CommentForm } from "@/components/comment-form";
import { AiRfiPanel } from "@/components/ai-rfi-panel";
import { RfiAnswerForm } from "@/components/rfi-answer-form";
import { AiNcrPanel } from "@/components/ai-ncr-panel";
import { IssueEditForm } from "@/components/issue-edit-form";

const TYPE_TO_WF: Partial<Record<string, WorkflowKey>> = {
  RFI: "RFI",
  SUBMITTAL: "SUBMITTAL",
  NCR: "NCR",
  PUNCH: "PUNCH",
  CHANGE_ORDER: "CHANGE_ORDER",
};

export default async function IssueDetail({
  params,
}: {
  params: { projectId: string; issueKey: string };
}) {
  const issue = await prisma.issue.findUnique({
    where: { key: decodeURIComponent(params.issueKey) },
    include: {
      reporter: true,
      assignee: true,
      rfi: true,
      submittal: true,
      ncr: true,
      punchItem: true,
      changeOrder: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      transitions: { orderBy: { createdAt: "desc" }, take: 10 },
      attachments: true,
    },
  });
  if (!issue) notFound();

  const wfKey = TYPE_TO_WF[issue.type];
  const wf = wfKey ? getWorkflow(wfKey) : null;
  const moves = wf ? nextStates(wf, issue.state as any) : [];

  // Latest RFI AI suggestions (server-side fetch — passed to AiRfiPanel).
  let aiClassify = null as any;
  let aiDraft = null as any;
  if (issue.rfi) {
    const [cls, drf] = await Promise.all([
      prisma.aiSuggestion.findFirst({
        where: { entityType: "Issue", entityId: issue.id, kind: "rfi.classify", ok: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.aiSuggestion.findFirst({
        where: { entityType: "Issue", entityId: issue.id, kind: "rfi.draft_answer", ok: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    if (cls) aiClassify = { ...(cls.output as any), id: cls.id, accepted: cls.accepted, model: cls.model, latencyMs: cls.latencyMs };
    if (drf) aiDraft = { ...(drf.output as any), id: drf.id, accepted: drf.accepted, model: drf.model, latencyMs: drf.latencyMs };
  }

  // Latest NCR vision suggestion.
  let aiNcr = null as any;
  if (issue.ncr) {
    const row = await prisma.aiSuggestion.findFirst({
      where: { entityType: "Issue", entityId: issue.id, kind: "ncr.assess_photo", ok: true },
      orderBy: { createdAt: "desc" },
    });
    if (row) aiNcr = { ...(row.output as any), id: row.id, accepted: row.accepted, model: row.model, latencyMs: row.latencyMs };
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center gap-3">
          <span
            className="rounded px-2 py-0.5 font-mono text-xs font-medium text-[rgb(var(--inverse-ink))]"
            style={{ background: issueTypeMeta[issue.type]?.color }}
          >
            {issueTypeMeta[issue.type]?.prefix}
          </span>
          <span className="font-mono text-xs text-[rgb(var(--muted))]">{issue.key}</span>
          <Badge variant={stateBadgeVariant(issue.state)}>{issue.state}</Badge>
        </div>
        <h1 className="text-2xl font-bold text-[rgb(var(--ink))]">{issue.title}</h1>

        {issue.description && (
          <Card>
            <CardHeader><CardTitle>Mô tả</CardTitle></CardHeader>
            <CardBody>
              <p className="whitespace-pre-wrap text-sm text-[rgb(var(--ink-2))]">{issue.description}</p>
            </CardBody>
          </Card>
        )}

        {/* Subtype-specific panel */}
        {issue.rfi && (
          <Card>
            <CardHeader><CardTitle>Chi tiết RFI</CardTitle></CardHeader>
            <CardBody className="space-y-3 text-sm">
              <Field label="Câu hỏi" value={issue.rfi.question} />
              <Field label="Danh mục" value={issue.rfi.category} />
              <Field label="Tác động tiến độ (ngày)" value={issue.rfi.scheduleImpactDays?.toString()} />
              <Field label="Tác động chi phí" value={issue.rfi.costImpactVnd ? formatVndShort(issue.rfi.costImpactVnd) : null} />
              <AiRfiPanel
                issueId={issue.id}
                saved={{ classify: aiClassify, draft: aiDraft }}
                answered={!!issue.rfi.answer}
              />
              <div className="space-y-2">
                <div className="text-xs font-medium text-[rgb(var(--ink-2))]">Câu trả lời</div>
                {issue.rfi.answer && (
                  <div className="rounded bg-[rgb(var(--raised))] px-3 py-2 text-sm whitespace-pre-wrap text-[rgb(var(--ink-2))]">
                    {issue.rfi.answer}
                  </div>
                )}
                {issue.state !== "CLOSED" && issue.state !== "REJECTED" && (
                  <RfiAnswerForm issueKey={issue.key} initialAnswer={issue.rfi.answer ?? ""} />
                )}
              </div>
            </CardBody>
          </Card>
        )}
        {issue.submittal && (
          <Card>
            <CardHeader><CardTitle>Chi tiết Submittal</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Field label="Mục spec" value={issue.submittal.specSection} />
              <Field label="Vật liệu" value={issue.submittal.materialName} />
              <Field label="Nhà sản xuất" value={issue.submittal.manufacturer} />
              <Field label="Revision" value={issue.submittal.revision.toString()} />
              <Field label="Quyết định" value={issue.submittal.decision} />
            </CardBody>
          </Card>
        )}
        {issue.ncr && (
          <Card>
            <CardHeader><CardTitle>Chi tiết NCR (NĐ 06/2021 Điều 12)</CardTitle></CardHeader>
            <CardBody className="space-y-3 text-sm">
              <Field label="Mức độ" value={issue.ncr.severity} />
              <Field label="Nguyên nhân gốc" value={issue.ncr.rootCause} />
              <Field label="Biện pháp khắc phục (CAR)" value={issue.ncr.correctiveAction} />
              <Field label="Tham chiếu QCVN/TCVN" value={issue.ncr.qcvnRef} />
              <AiNcrPanel
                issueId={issue.id}
                saved={aiNcr}
                currentSeverity={issue.ncr.severity}
              />
            </CardBody>
          </Card>
        )}
        {issue.changeOrder && (
          <Card>
            <CardHeader><CardTitle>Chi tiết Lệnh thay đổi</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Field label="Lý do" value={issue.changeOrder.reason} />
              <Field label="Phạm vi thay đổi" value={issue.changeOrder.scopeChange} />
              <Field
                label="Δ Chi phí"
                value={`${issue.changeOrder.costDeltaVnd > 0n ? "+" : ""}${formatVndShort(issue.changeOrder.costDeltaVnd)}`}
              />
              <Field label="Δ Tiến độ (ngày)" value={issue.changeOrder.scheduleDeltaDays.toString()} />
            </CardBody>
          </Card>
        )}
        {issue.punchItem && (
          <Card>
            <CardHeader><CardTitle>Chi tiết Punch</CardTitle></CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Field label="Hạng mục" value={issue.punchItem.trade} />
              <Field label="Khu vực" value={issue.punchItem.zone} />
            </CardBody>
          </Card>
        )}

        {/* Comments */}
        <Card>
          <CardHeader><CardTitle>Bình luận ({issue.comments.length})</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {issue.comments.map((c) => (
              <div key={c.id} className="rounded-md bg-[rgb(var(--raised))] p-3">
                <div className="text-xs text-[rgb(var(--muted))]">
                  {c.author.name} · {formatDateTimeVn(c.createdAt)}
                </div>
                <div className="mt-1 text-sm whitespace-pre-wrap">{c.body}</div>
              </div>
            ))}
            {issue.comments.length === 0 && (
              <div className="text-sm text-[rgb(var(--muted-2))]">Chưa có bình luận.</div>
            )}
            <div className="border-t border-[rgb(var(--line))] pt-3">
              <CommentForm issueKey={issue.key} />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Hành động</CardTitle></CardHeader>
          <CardBody className="space-y-2">
            <TransitionButtons
              issueKey={issue.key}
              moves={moves.map((m) => ({
                from: m.from as string,
                to: m.to as string,
                action: m.action,
                allowedRoles: m.allowedRoles as unknown as string[],
                ref: m.ref,
              }))}
            />
            {wf && (
              <div className="mt-3 border-t border-[rgb(var(--line))] pt-2 text-[10px] text-[rgb(var(--muted))]">
                Workflow: {wf.name}
                {wf.transitions.find((t) => t.ref)?.ref && (
                  <> · {wf.transitions.find((t) => t.ref)?.ref}</>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Thông tin</CardTitle></CardHeader>
          <CardBody className="space-y-2 text-sm">
            <Field label="Loại" value={issueTypeMeta[issue.type]?.label} />
            <Field label="Ưu tiên" value={issue.priority} />
            <Field label="Người báo cáo" value={issue.reporter.name} />
            <Field label="Phụ trách" value={issue.assignee?.name} />
            <Field label="Vị trí" value={issue.locationZone} />
            <Field label="Hạn xử lý" value={issue.dueDate ? formatDateTimeVn(issue.dueDate) : null} />
            <IssueEditForm
              issue={{
                key: issue.key,
                title: issue.title,
                description: issue.description,
                priority: issue.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
                assigneeId: issue.assigneeId,
                assigneeName: issue.assignee?.name ?? null,
                dueDate: issue.dueDate ? issue.dueDate.toISOString() : null,
                locationZone: issue.locationZone,
              }}
              members={await loadProjectMembers(issue.projectId)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Lịch sử trạng thái</CardTitle></CardHeader>
          <CardBody className="space-y-2 text-xs">
            {issue.transitions.length === 0 && <div className="text-[rgb(var(--muted-2))]">Chưa có chuyển trạng thái.</div>}
            {issue.transitions.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <span>{t.fromState} → <strong>{t.toState}</strong></span>
                <span className="text-[rgb(var(--muted))]">{formatDateTimeVn(t.createdAt)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="col-span-1 text-xs text-[rgb(var(--muted))]">{label}</div>
      <div className="col-span-2 text-sm text-[rgb(var(--ink-2))]">{value ?? "—"}</div>
    </div>
  );
}

// Members of the project's owning org — used to populate the IssueEditForm
// assignee dropdown. Goes through Membership (User has no direct orgId;
// it's a many-to-many). Cap at 200 (a single-org dropdown above that
// needs a search box, which is a different UX problem).
async function loadProjectMembers(projectId: string): Promise<{ id: string; name: string }[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerOrgId: true },
  });
  if (!project) return [];
  const memberships = await prisma.membership.findMany({
    where: { orgId: project.ownerOrgId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
    take: 200,
  });
  return memberships.map((m) => ({ id: m.user.id, name: m.user.name ?? "(không tên)" }));
}
