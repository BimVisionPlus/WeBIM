import { notFound } from "next/navigation";
import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge, stateBadgeVariant } from "@atlas/ui";
import { formatDateVn, disciplineLabel } from "@atlas/lib";
import { ForgeViewer } from "@/components/forge-viewer";

export default async function ModelDetail({
  params,
}: {
  params: { projectId: string; modelId: string };
}) {
  const model = await prisma.model.findUnique({ where: { id: params.modelId } });
  if (!model) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold">{model.name}</h2>
          <p className="text-xs text-[rgb(var(--muted))]">
            {model.format} · {disciplineLabel[model.discipline ?? ""] ?? "—"} · Revision {model.revision}
          </p>
        </div>
        <Badge variant={stateBadgeVariant(model.apsTranslationStatus)}>
          {model.apsTranslationStatus}
        </Badge>
      </div>

      <Card>
        <CardBody className="p-0">
          {model.apsUrn && model.apsTranslationStatus === "SUCCESS" ? (
            <ForgeViewer urn={model.apsUrn} />
          ) : (
            <div className="grid h-[560px] place-items-center bg-[rgb(var(--inverse-bg))] text-[rgb(var(--inverse-ink))]">
              <div className="text-center">
                <div className="mb-2 text-sm">Mô hình đang được chuyển đổi…</div>
                <div className="mx-auto h-2 w-64 rounded bg-[rgb(var(--inverse-bg))]">
                  <div
                    className="h-2 rounded bg-blue-500 transition-all"
                    style={{ width: `${model.apsTranslationProgress}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-[rgb(var(--muted-2))]">{model.apsTranslationProgress}%</div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Thông tin tệp</CardTitle></CardHeader>
        <CardBody className="space-y-1 text-sm">
          <Field label="Dung lượng" value={`${(Number(model.fileSizeBytes) / 1024 / 1024).toFixed(1)} MB`} />
          <Field label="Tải lên" value={formatDateVn(model.uploadedAt)} />
          <Field label="APS URN" value={model.apsUrn ?? "—"} />
        </CardBody>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="col-span-1 text-xs text-[rgb(var(--muted))]">{label}</div>
      <div className="col-span-2 break-all font-mono text-xs text-[rgb(var(--ink-2))]">{value}</div>
    </div>
  );
}
