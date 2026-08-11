import { prisma } from "@atlas/db";
import Link from "next/link";
import { Card, CardBody } from "@atlas/ui";

export default async function SheetsPage({ params }: { params: { projectId: string } }) {
  const sets = await prisma.drawingSet.findMany({
    where: { projectId: params.projectId },
    include: { sheets: { include: { _count: { select: { markups: true } } }, orderBy: { sheetNumber: "asc" } } },
    orderBy: { issuedDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Tất cả sheet</h2>
      {sets.map((s) => (
        <div key={s.id}>
          <div className="mb-2 text-sm font-medium text-[rgb(var(--ink-2))]">
            {s.name} <span className="text-xs text-[rgb(var(--muted))]">· {s.revision}</span>
          </div>
          <Card>
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--raised))] text-left text-xs uppercase text-[rgb(var(--muted))]">
                  <tr>
                    <th className="px-4 py-2.5">Sheet #</th>
                    <th className="px-4 py-2.5">Tiêu đề</th>
                    <th className="px-4 py-2.5">Tỉ lệ</th>
                    <th className="px-4 py-2.5">Revision</th>
                    <th className="px-4 py-2.5">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--line))]">
                  {s.sheets.map((sh) => (
                    <tr key={sh.id} className="transition hover:bg-[rgb(var(--raised))]">
                      <td className="px-4 py-2 font-mono text-xs">{sh.sheetNumber}</td>
                      <td className="px-4 py-2 text-[rgb(var(--ink))]"><Link className="font-medium hover:text-blue-600" href={`/projects/${params.projectId}/models/sheets/${sh.id}`}>{sh.title}</Link></td>
                      <td className="px-4 py-2 text-[rgb(var(--muted))]">{sh.scale ?? "—"}</td>
                      <td className="px-4 py-2 text-[rgb(var(--muted))]">{sh.revision}</td>
                      <td className="px-4 py-2"><Link className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100" href={`/projects/${params.projectId}/models/sheets/${sh.id}`}>Mở canvas · {sh._count.markups}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      ))}
    </div>
  );
}
