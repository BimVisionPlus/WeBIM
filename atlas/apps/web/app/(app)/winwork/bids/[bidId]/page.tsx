import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge, stateBadgeVariant } from "@atlas/ui";
import { formatVnd, formatVndShort, formatDateVn } from "@atlas/lib";
import { bidWorkflow, nextStates, type BidState } from "@atlas/workflows";
import { BidTransitionButtons } from "@/components/winwork-bid-transitions";
import { BidComplianceRunner } from "@/components/winwork-bid-compliance";

export const dynamic = "force-dynamic";

export default async function BidDetailPage({ params }: { params: { bidId: string } }) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const bid = await prisma.bid.findUnique({
    where: { id: params.bidId },
    include: {
      org: true,
      opportunity: true,
      owner: { select: { id: true, name: true } },
      bonds: { orderBy: { createdAt: "desc" } },
      complianceChecks: { orderBy: { checkedAt: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!bid) notFound();

  // Latest compliance result per ruleId
  const latestChecks = new Map<string, (typeof bid.complianceChecks)[number]>();
  for (const c of bid.complianceChecks) if (!latestChecks.has(c.ruleId)) latestChecks.set(c.ruleId, c);
  const checks = Array.from(latestChecks.values());

  const transitions = nextStates(bidWorkflow, bid.state as BidState);

  const blockingFail = checks.filter((c) => c.severity === "BLOCKING" && c.status === "FAIL").length;
  const warningFail = checks.filter((c) => c.severity === "WARNING" && c.status === "FAIL").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/winwork/bids" className="text-[rgb(var(--muted))] hover:text-[rgb(var(--ink))]">← Hồ sơ dự thầu</Link>
            <span className="text-[rgb(var(--muted-2))]">·</span>
            <span className="font-mono text-[rgb(var(--muted))]">{bid.key}</span>
            <Badge variant={stateBadgeVariant(bid.state)}>{bid.state}</Badge>
            {bid.outcome && bid.outcome !== "PENDING" && (
              <Badge variant={bid.outcome === "AWARDED" ? "success" : "danger"}>{bid.outcome}</Badge>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold">{bid.title}</h1>
          <div className="mt-1 text-sm text-[rgb(var(--muted))]">
            {bid.org.name} · Phụ trách: {bid.owner.name}
          </div>
        </div>
      </div>

      <BidTransitionButtons
        bidId={bid.id}
        currentState={bid.state}
        transitions={transitions.map((t) => ({ to: t.to, action: t.action, ref: t.ref ?? null }))}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thông tin gói thầu</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              {bid.opportunity ? (
                <>
                  <Row label="Cơ hội nguồn" value={bid.opportunity.title} />
                  <Row label="Bên mời thầu" value={bid.opportunity.invitor ?? "—"} />
                  <Row label="MST bên mời thầu" value={bid.opportunity.invitorMst ?? "—"} />
                  <Row label="Giá gói thầu" value={formatVnd(bid.opportunity.budgetVnd)} />
                  <Row label="Nguồn vốn" value={bid.opportunity.fundingSource ?? "—"} />
                  <Row label="Hình thức" value={bid.opportunity.bidMethod ?? "—"} />
                  <Row label="Đóng thầu" value={bid.opportunity.closingAt ? formatDateVn(bid.opportunity.closingAt) : "—"} />
                </>
              ) : (
                <div className="text-[rgb(var(--muted))]">Chưa gắn cơ hội đấu thầu cụ thể.</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Định giá nội bộ</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <Row label="Dự toán nội bộ" value={formatVnd(bid.estimatedValueVnd)} />
              <Row label="Giá dự thầu" value={formatVnd(bid.proposedValueVnd)} />
              <Row label="Margin" value={bid.marginPct !== null ? `${bid.marginPct?.toFixed(2)}%` : "—"} />
              <Row label="Dự phòng" value={bid.contingencyPct !== null ? `${bid.contingencyPct?.toFixed(2)}%` : "—"} />
              <Row label="Win probability" value={bid.winProbability !== null ? `${Math.round((bid.winProbability ?? 0) * 100)}%` : "Chưa tính"} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Tuân thủ Luật ĐT 22/2023
                  {blockingFail > 0 ? (
                    <Badge className="ml-2" variant="danger">{blockingFail} chặn</Badge>
                  ) : warningFail > 0 ? (
                    <Badge className="ml-2" variant="warning">{warningFail} cảnh báo</Badge>
                  ) : checks.length > 0 ? (
                    <Badge className="ml-2" variant="success">Đạt</Badge>
                  ) : (
                    <Badge className="ml-2" variant="neutral">Chưa kiểm</Badge>
                  )}
                </CardTitle>
                <BidComplianceRunner bidId={bid.id} />
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {checks.length === 0 ? (
                <div className="p-6 text-sm text-[rgb(var(--muted))]">
                  Bấm "↻ Chạy kiểm tra" để chạy 9 quy tắc theo Luật ĐT 22/2023 + best-practice Atlas.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-[rgb(var(--line))] bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                    <tr>
                      <th className="p-2 text-left">Quy tắc</th>
                      <th className="p-2 text-left">Căn cứ</th>
                      <th className="p-2 text-center">Mức</th>
                      <th className="p-2 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--line))]">
                    {checks.map((c) => (
                      <tr key={c.id}>
                        <td className="p-2">
                          <div className="font-medium">{c.ruleTitle}</div>
                          {c.note && <div className="text-[11px] text-[rgb(var(--muted))]">{c.note}</div>}
                        </td>
                        <td className="p-2 text-xs text-[rgb(var(--muted))]">{c.ruleRef}</td>
                        <td className="p-2 text-center">
                          <Badge
                            variant={
                              c.severity === "BLOCKING"
                                ? "danger"
                                : c.severity === "WARNING"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {c.severity}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Badge
                            variant={
                              c.status === "PASS"
                                ? "success"
                                : c.status === "FAIL"
                                  ? "danger"
                                  : c.status === "NEEDS_REVIEW"
                                    ? "warning"
                                    : "neutral"
                            }
                          >
                            {c.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bảo lãnh ({bid.bonds.length})</CardTitle>
            </CardHeader>
            <CardBody className="divide-y divide-[rgb(var(--line))] p-0">
              {bid.bonds.length === 0 && (
                <div className="p-3 text-sm text-[rgb(var(--muted))]">Chưa có bảo lãnh nào.</div>
              )}
              {bid.bonds.map((b) => (
                <div key={b.id} className="p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge variant="neutral">{b.type}</Badge>
                    <Badge variant={b.status === "ACTIVE" ? "success" : "neutral"}>{b.status}</Badge>
                  </div>
                  <div className="mt-1 font-medium text-[rgb(var(--ink))]">{formatVndShort(b.amountVnd)}</div>
                  <div className="mt-0.5 text-[rgb(var(--muted))]">
                    {b.issuerBank} · {b.bondNumber}
                  </div>
                  <div className="mt-0.5 text-[rgb(var(--muted))]">
                    Hiệu lực: {formatDateVn(b.issuedAt)} → {formatDateVn(b.expiresAt)}
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tài liệu ({bid.documents.length})</CardTitle>
            </CardHeader>
            <CardBody className="divide-y divide-[rgb(var(--line))] p-0">
              {bid.documents.length === 0 && (
                <div className="p-3 text-sm text-[rgb(var(--muted))]">
                  Chưa có tài liệu. Tải lên các tài liệu (BCTC, kinh nghiệm, biện pháp, tiến độ…) để engine tuân thủ kiểm được tính đầy đủ.
                </div>
              )}
              {bid.documents.map((d) => (
                <div key={d.id} className="p-3 text-xs">
                  <div className="font-medium text-[rgb(var(--ink))] truncate">{d.fileName}</div>
                  <div className="text-[rgb(var(--muted))]">{d.contentType} · {Math.round(d.sizeBytes / 1024)} KB</div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-[rgb(var(--muted))]">{label}</span>
      <span className="text-[rgb(var(--ink))]">{value}</span>
    </div>
  );
}
