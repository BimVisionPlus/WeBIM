import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatVndShort, formatDateVn, relativeDateVn } from "@atlas/lib";
import { TenderCreateButton } from "@/components/winwork-tender-create";

export const dynamic = "force-dynamic";

export default async function TendersPage({
  searchParams,
}: {
  searchParams: { province?: string; source?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const where: any = {
    scrapedAt: { gte: new Date(Date.now() - 90 * 86_400_000) },
  };
  if (searchParams.province) where.province = searchParams.province;
  if (searchParams.source) where.source = searchParams.source;

  const tenders = await prisma.tenderOpportunity.findMany({
    where,
    orderBy: [{ closingAt: "asc" }, { scrapedAt: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Cơ hội đấu thầu</h2>
          <p className="text-sm text-slate-500">
            Tổng hợp từ muasamcong.mpi.gov.vn · dauthau.asia · báo đấu thầu
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session.isSuperAdmin && (
            <form action="/api/winwork/tenders/scrape" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ↻ Chạy scraper
              </button>
            </form>
          )}
          <TenderCreateButton />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {tenders.length} cơ hội · 90 ngày gần nhất
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {tenders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Chưa có cơ hội nào. Scraper chưa được kích hoạt — bạn có thể nhập thủ công.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3 text-left">Gói thầu</th>
                  <th className="p-3 text-left">Bên mời thầu</th>
                  <th className="p-3 text-left">Tỉnh/TP</th>
                  <th className="p-3 text-right">Giá gói</th>
                  <th className="p-3 text-left">Đóng thầu</th>
                  <th className="p-3 text-left">Nguồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenders.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-medium text-slate-900">{t.title}</div>
                      <div className="mt-0.5 flex gap-2 text-[11px] text-slate-500">
                        {t.category && <span>{t.category}</span>}
                        {t.bidMethod && <span>· {t.bidMethod}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-slate-700">{t.invitor ?? "—"}</td>
                    <td className="p-3 text-slate-700">{t.province ?? "—"}</td>
                    <td className="p-3 text-right font-medium">{formatVndShort(t.budgetVnd)}</td>
                    <td className="p-3">
                      {t.closingAt ? (
                        <div>
                          <div>{formatDateVn(t.closingAt)}</div>
                          <div className="text-[11px] text-slate-500">{relativeDateVn(t.closingAt)}</div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      {t.sourceUrl ? (
                        <Link
                          href={t.sourceUrl}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          {t.source}
                        </Link>
                      ) : (
                        <Badge variant="neutral">{t.source}</Badge>
                      )}
                    </td>
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
