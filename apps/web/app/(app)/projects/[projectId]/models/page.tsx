import Link from "next/link";
import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge, Button, stateBadgeVariant } from "@atlas/ui";
import { disciplineLabel, formatDateVn } from "@atlas/lib";

export default async function ModelsPage({ params }: { params: { projectId: string } }) {
  const [drawingSets, models] = await Promise.all([
    prisma.drawingSet.findMany({
      where: { projectId: params.projectId },
      include: { _count: { select: { sheets: true } } },
      orderBy: { issuedDate: "desc" },
    }),
    prisma.model.findMany({
      where: { projectId: params.projectId },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* BIM Models */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Mô hình BIM (IFC / RVT / NWD)</h2>
            <p className="text-xs text-slate-500">
              Tải lên & xem qua Autodesk Platform Services (Forge Viewer)
            </p>
          </div>
          <Link href={`/projects/${params.projectId}/models/upload`}>
            <Button size="sm">+ Tải lên mô hình</Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((m) => (
            <Link key={m.id} href={`/projects/${params.projectId}/models/${m.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{m.name}</CardTitle>
                    <Badge variant={stateBadgeVariant(m.apsTranslationStatus)}>
                      {m.apsTranslationStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardBody className="space-y-1 text-xs text-slate-500">
                  <div>Định dạng: {m.format} · Revision {m.revision}</div>
                  <div>Tải lên: {formatDateVn(m.uploadedAt)}</div>
                  <div>Dung lượng: {(Number(m.fileSizeBytes) / 1024 / 1024).toFixed(1)} MB</div>
                  {m.apsTranslationProgress < 100 && m.apsTranslationStatus !== "SUCCESS" && (
                    <div className="mt-2 h-1 w-full rounded bg-slate-100">
                      <div
                        className="h-1 rounded bg-blue-500"
                        style={{ width: `${m.apsTranslationProgress}%` }}
                      />
                    </div>
                  )}
                </CardBody>
              </Card>
            </Link>
          ))}
          {models.length === 0 && (
            <Card>
              <CardBody className="py-10 text-center text-sm text-slate-500">Chưa có mô hình nào.</CardBody>
            </Card>
          )}
        </div>
      </section>

      {/* Drawing sets */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Bộ bản vẽ (Drawing sets)</h2>
            <p className="text-xs text-slate-500">Versioned: R0 / R1 / IFC. Supersedes chain giữ lịch sử thay đổi.</p>
          </div>
          <Link href={`/projects/${params.projectId}/models/sheets`}>
            <Button size="sm" variant="outline">Xem tất cả sheet</Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {drawingSets.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{d.name}</CardTitle>
                  {d.isCurrent && <Badge variant="success">Hiện hành</Badge>}
                </div>
              </CardHeader>
              <CardBody className="space-y-1 text-xs text-slate-500">
                <div>Bộ môn: {disciplineLabel[d.discipline] ?? d.discipline}</div>
                <div>Revision: <strong>{d.revision}</strong></div>
                <div>Ngày phát hành: {formatDateVn(d.issuedDate)}</div>
                <div>{d._count.sheets} sheet</div>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
