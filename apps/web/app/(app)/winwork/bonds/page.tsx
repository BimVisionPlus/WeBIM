import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVnd, formatDateVn, relativeDateVn } from "@atlas/lib";
import { BondCreateButton } from "@/components/winwork-bond-create";

export const dynamic = "force-dynamic";

export default async function BondsPage() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);

  const [bonds, bids] = await Promise.all([
    prisma.bidBond.findMany({
      where: { bid: { orgId: { in: orgIds } } },
      include: { bid: { select: { id: true, key: true, title: true, state: true, orgId: true } } },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }],
    }),
    prisma.bid.findMany({
      where: { orgId: { in: orgIds }, state: { not: "CLOSED" } },
      select: { id: true, key: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const now = Date.now();
  const expiring30 = bonds.filter((b) => b.status === "ACTIVE" && b.expiresAt.getTime() - now < 30 * 86_400_000);
  const expired = bonds.filter((b) => b.status === "ACTIVE" && b.expiresAt.getTime() < now);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bảo lãnh</h2>
          <p className="text-sm text-slate-500">
            BLDT · BL thực hiện · BL tạm ứng · BL bảo hành (Luật ĐT 22/2023 Điều 14, 75)
          </p>
        </div>
        <BondCreateButton bids={bids} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Tổng bảo lãnh</div>
            <div className="mt-1 text-2xl font-bold">{bonds.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Hết hạn ≤ 30 ngày</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{expiring30.length}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3">
            <div className="text-xs text-slate-500">Đã hết hạn (chưa xử lý)</div>
            <div className="mt-1 text-2xl font-bold text-rose-700">{expired.length}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Danh sách bảo lãnh</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {bonds.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">Chưa có bảo lãnh nào.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Loại</th>
                  <th className="p-3 text-left">HSDT</th>
                  <th className="p-3 text-left">Ngân hàng</th>
                  <th className="p-3 text-left">Số BL</th>
                  <th className="p-3 text-right">Mệnh giá</th>
                  <th className="p-3 text-left">Hiệu lực</th>
                  <th className="p-3 text-left">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bonds.map((b) => {
                  const overdue = b.status === "ACTIVE" && b.expiresAt.getTime() < now;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <Badge variant="neutral">{b.type}</Badge>
                      </td>
                      <td className="p-3">
                        <Link href={`/winwork/bids/${b.bid.id}`} className="font-mono text-xs text-blue-700 hover:underline">
                          {b.bid.key}
                        </Link>
                        <div className="text-[11px] text-slate-500 truncate max-w-[260px]">{b.bid.title}</div>
                      </td>
                      <td className="p-3">{b.issuerBank}</td>
                      <td className="p-3 font-mono text-xs">{b.bondNumber}</td>
                      <td className="p-3 text-right font-medium">{formatVnd(b.amountVnd)}</td>
                      <td className="p-3 text-xs">
                        {formatDateVn(b.issuedAt)} → {formatDateVn(b.expiresAt)}
                        <div className={overdue ? "text-rose-700" : "text-slate-500"}>
                          {relativeDateVn(b.expiresAt)}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            overdue
                              ? "danger"
                              : b.status === "ACTIVE"
                                ? "success"
                                : b.status === "RELEASED"
                                  ? "neutral"
                                  : b.status === "EXPIRED"
                                    ? "warning"
                                    : "danger"
                          }
                        >
                          {overdue ? "EXPIRED" : b.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
