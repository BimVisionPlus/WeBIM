import { prisma } from "@atlas/db";
import { Card, CardBody } from "@atlas/ui";

export default async function SheetsPage({ params }: { params: { projectId: string } }) {
  const sets = await prisma.drawingSet.findMany({
    where: { projectId: params.projectId },
    include: { sheets: { orderBy: { sheetNumber: "asc" } } },
    orderBy: { issuedDate: "desc" },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Tất cả sheet</h2>
      {sets.map((s) => (
        <div key={s.id}>
          <div className="mb-2 text-sm font-medium text-slate-700">
            {s.name} <span className="text-xs text-slate-500">· {s.revision}</span>
          </div>
          <Card>
            <CardBody className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Sheet #</th>
                    <th className="px-4 py-2.5">Tiêu đề</th>
                    <th className="px-4 py-2.5">Tỉ lệ</th>
                    <th className="px-4 py-2.5">Revision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {s.sheets.map((sh) => (
                    <tr key={sh.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs">{sh.sheetNumber}</td>
                      <td className="px-4 py-2 text-slate-900">{sh.title}</td>
                      <td className="px-4 py-2 text-slate-600">{sh.scale ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{sh.revision}</td>
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
