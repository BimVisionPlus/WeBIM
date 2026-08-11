import Link from "next/link";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { redirect } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle, Badge, stateBadgeVariant } from "@atlas/ui";
import { formatVndShort, relativeDateVn } from "@atlas/lib";

export default async function WinWorkOverview() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);

  const [tenderCount, openBids, awardedBids, lostBids, activeBonds, expiringBonds, recentTenders, recentBids] =
    await Promise.all([
      prisma.tenderOpportunity.count({ where: { scrapedAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      prisma.bid.count({ where: { orgId: { in: orgIds }, state: { in: ["DRAFT", "ESTIMATING", "READY", "SUBMITTED", "OPENED"] } } }),
      prisma.bid.count({ where: { orgId: { in: orgIds }, outcome: "AWARDED" } }),
      prisma.bid.count({ where: { orgId: { in: orgIds }, outcome: "LOST" } }),
      prisma.bidBond.count({ where: { bid: { orgId: { in: orgIds } }, status: "ACTIVE" } }),
      prisma.bidBond.findMany({
        where: {
          bid: { orgId: { in: orgIds } },
          status: "ACTIVE",
          expiresAt: { lte: new Date(Date.now() + 30 * 86_400_000) },
        },
        include: { bid: { select: { key: true, title: true } } },
        orderBy: { expiresAt: "asc" },
        take: 5,
      }),
      prisma.tenderOpportunity.findMany({
        orderBy: { scrapedAt: "desc" },
        take: 6,
      }),
      prisma.bid.findMany({
        where: { orgId: { in: orgIds } },
        orderBy: { updatedAt: "desc" },
        include: { opportunity: { select: { title: true } } },
        take: 6,
      }),
    ]);

  const totalDecided = awardedBids + lostBids;
  const winRate = totalDecided > 0 ? Math.round((awardedBids / totalDecided) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Cơ hội 30 ngày qua</div>
            <div className="mt-1 text-2xl font-bold">{tenderCount}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Hồ sơ đang xử lý</div>
            <div className="mt-1 text-2xl font-bold text-blue-700">{openBids}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Win rate</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">
              {winRate !== null ? `${winRate}%` : "—"}
            </div>
            <div className="text-[11px] text-[rgb(var(--muted))]">{awardedBids}/{totalDecided} quyết định</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Bảo lãnh đang hoạt động</div>
            <div className="mt-1 text-2xl font-bold">{activeBonds}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-[rgb(var(--muted))]">Bảo lãnh sắp hết hạn ≤30 ngày</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{expiringBonds.length}</div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cơ hội đấu thầu mới</CardTitle>
              <Link href="/winwork/tenders" className="text-xs text-blue-600 hover:underline">Xem tất cả →</Link>
            </div>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--line))] p-0">
            {recentTenders.length === 0 && (
              <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">
                Chưa có cơ hội — chạy scraper hoặc thêm thủ công.
              </div>
            )}
            {recentTenders.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[rgb(var(--ink))]">{t.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                    <Badge variant="neutral">{t.source}</Badge>
                    {t.province && <span>{t.province}</span>}
                    {t.closingAt && <span>Đóng thầu: {relativeDateVn(t.closingAt)}</span>}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{formatVndShort(t.budgetVnd)}</div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Hồ sơ dự thầu gần đây</CardTitle>
              <Link href="/winwork/bids" className="text-xs text-blue-600 hover:underline">Xem tất cả →</Link>
            </div>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--line))] p-0">
            {recentBids.length === 0 && (
              <div className="p-6 text-center text-sm text-[rgb(var(--muted))]">
                Chưa có hồ sơ dự thầu nào. <Link href="/winwork/bids" className="text-blue-600">Tạo HSDT mới →</Link>
              </div>
            )}
            {recentBids.map((b) => (
              <Link
                key={b.id}
                href={`/winwork/bids/${b.id}`}
                className="flex items-center justify-between gap-3 p-3 hover:bg-[rgb(var(--raised))]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[rgb(var(--muted))]">{b.key}</span>
                    <Badge variant={stateBadgeVariant(b.state)}>{b.state}</Badge>
                  </div>
                  <div className="truncate text-sm font-medium text-[rgb(var(--ink))]">{b.title}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{formatVndShort(b.proposedValueVnd)}</div>
                  <div className="text-[11px] text-[rgb(var(--muted))]">{relativeDateVn(b.updatedAt)}</div>
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>

      {expiringBonds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-amber-800">⚠ Bảo lãnh sắp hết hạn</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--line))] p-0">
            {expiringBonds.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium">{b.bid.key} — {b.bid.title}</div>
                  <div className="text-xs text-[rgb(var(--muted))]">{b.type} · {b.issuerBank} · {b.bondNumber}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatVndShort(b.amountVnd)}</div>
                  <div className="text-xs text-amber-700">Hết hạn: {relativeDateVn(b.expiresAt)}</div>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
