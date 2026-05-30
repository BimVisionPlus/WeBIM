import { prisma } from "@atlas/db";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateTimeVn } from "@atlas/lib";

export const dynamic = "force-dynamic";

export default async function TrustPage() {
  const cards = await prisma.modelCard.findMany({
    orderBy: [{ feature: "asc" }, { publishedAt: "desc" }],
  });

  // Group by feature, keep latest version per feature
  const byFeature = new Map<string, (typeof cards)[number]>();
  for (const c of cards) if (!byFeature.has(c.feature)) byFeature.set(c.feature, c);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold">Trust — Model Cards & MLOps</h1>
        <p className="mt-2 text-sm text-slate-600">
          Viwase Quản lý công việc chạy mọi tính năng AI bằng mô hình open-source, tự host. Trang này công khai
          danh sách model, dataset huấn luyện, kết quả benchmark, và mức độ trôi (drift) trong
          30 ngày gần nhất — để bạn kiểm tra trước khi tin AI.
        </p>
      </header>

      {byFeature.size === 0 ? (
        <Card>
          <CardBody className="p-8 text-center text-sm text-slate-500">
            Chưa khai báo model card. Chạy <code className="rounded bg-slate-100 px-1">pnpm db:seed</code> để load baseline.
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(byFeature.values()).map((card) => (
            <Card key={card.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-sm">{card.feature}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{card.modelName}</Badge>
                    <Badge variant="neutral">v{card.modelVersion}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                {card.intendedUse && (
                  <Section title="Mục đích sử dụng">{card.intendedUse}</Section>
                )}
                {card.trainingDataSummary && (
                  <Section title="Dữ liệu huấn luyện">{card.trainingDataSummary}</Section>
                )}
                {card.limitations && (
                  <Section title="Hạn chế đã biết">{card.limitations}</Section>
                )}
                {Array.isArray(card.datasetCitations) && card.datasetCitations.length > 0 && (
                  <Section title="Trích dẫn dataset">
                    <ul className="list-inside list-disc text-slate-600">
                      {card.datasetCitations.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </Section>
                )}
                <div className="text-[11px] text-slate-500">
                  Công bố: {formatDateTimeVn(card.publishedAt)}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 whitespace-pre-wrap text-slate-700">{children}</div>
    </div>
  );
}
