import Link from "next/link";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { redirect } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle, Badge, stateBadgeVariant } from "@atlas/ui";
import { formatVndShort, relativeDateVn } from "@atlas/lib";
import { BidCreateButton } from "@/components/winwork-bid-create";

export const dynamic = "force-dynamic";

export default async function BidsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { org: { select: { id: true, name: true, slug: true } } },
  });
  const orgIds = memberships.map((m) => m.orgId);

  const [bids, opportunities] = await Promise.all([
    prisma.bid.findMany({
      where: { orgId: { in: orgIds } },
      include: {
        opportunity: { select: { title: true, closingAt: true } },
        owner: { select: { name: true } },
        _count: { select: { bonds: true, complianceChecks: true, documents: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.tenderOpportunity.findMany({
      where: { scrapedAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
      orderBy: { closingAt: "asc" },
      select: { id: true, title: true, budgetVnd: true, closingAt: true },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Hồ sơ dự thầu</h2>
          <p className="text-sm text-slate-500">Quản lý vòng đời HSDT: dự toán → nộp → trúng/trượt</p>
        </div>
        <BidCreateButton
          orgs={memberships.map((m) => ({ id: m.org.id, name: m.org.name }))}
          opportunities={opportunities.map((o) => ({
            id: o.id,
            title: o.title,
            budgetVnd: o.budgetVnd?.toString() ?? null,
            closingAt: o.closingAt?.toISOString() ?? null,
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{bids.length} hồ sơ</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {bids.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có hồ sơ dự thầu nào. Tạo HSDT từ một cơ hội đấu thầu hoặc trống.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Mã</th>
                  <th className="p-3 text-left">Tên gói thầu</th>
                  <th className="p-3 text-left">Trạng thái</th>
                  <th className="p-3 text-right">Giá dự thầu</th>
                  <th className="p-3 text-left">Người phụ trách</th>
                  <th className="p-3 text-center">Bond</th>
                  <th className="p-3 text-center">Tuân thủ</th>
                  <th className="p-3 text-left">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bids.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">
                      <Link href={`/winwork/bids/${b.id}`} className="text-blue-700 hover:underline">{b.key}</Link>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{b.title}</div>
                      {b.opportunity && (
                        <div className="text-[11px] text-slate-500">↳ {b.opportunity.title}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant={stateBadgeVariant(b.state)}>{b.state}</Badge>
                      {b.outcome && b.outcome !== "PENDING" && (
                        <Badge
                          className="ml-1"
                          variant={b.outcome === "AWARDED" ? "success" : "danger"}
                        >
                          {b.outcome}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right font-medium">{formatVndShort(b.proposedValueVnd)}</td>
                    <td className="p-3 text-slate-700">{b.owner.name}</td>
                    <td className="p-3 text-center">{b._count.bonds}</td>
                    <td className="p-3 text-center">{b._count.complianceChecks}</td>
                    <td className="p-3 text-xs text-slate-500">{relativeDateVn(b.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
