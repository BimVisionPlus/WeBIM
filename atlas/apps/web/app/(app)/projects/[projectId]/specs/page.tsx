import Link from "next/link";
import { prisma } from "@atlas/db";
import { requireProject } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { SpecsSearch } from "@/components/specs-search";
import { SpecCreateForm } from "@/components/spec-create-form";
import { SpecsReembedButton } from "@/components/specs-reembed";
import { formatDateTimeVn } from "@atlas/lib";

export const dynamic = "force-dynamic";

export default async function SpecsPage({
  params,
}: {
  params: { projectId: string };
}) {
  await requireProject(params.projectId);
  const pages = await prisma.specPage.findMany({
    where: { projectId: params.projectId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, slug: true, title: true, updatedAt: true,
      embeddedAt: true, embedModel: true,
    },
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>
              Specs — Tìm theo ngữ nghĩa
              <Badge className="ml-2" variant="violet">AI · bge-m3</Badge>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <SpecsSearch projectId={params.projectId} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Tất cả trang spec ({pages.length})
              <span className="ml-2"><SpecsReembedButton projectId={params.projectId} /></span>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {pages.length === 0 && (
              <p className="text-sm text-[rgb(var(--muted))]">
                Chưa có spec nào. Tạo trang đầu tiên ở cột bên phải — mỗi lần save, AI tự re-embed.
              </p>
            )}
            {pages.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border border-[rgb(var(--line))] px-3 py-2 hover:bg-[rgb(var(--raised))]">
                <Link href={`/projects/${params.projectId}/specs/${p.slug}`} className="flex-1 text-sm text-[rgb(var(--ink-2))] hover:text-blue-700">
                  <span className="font-medium">{p.title}</span>
                  <span className="ml-2 text-xs text-[rgb(var(--muted))]">/{p.slug}</span>
                </Link>
                <div className="flex items-center gap-2 text-[10px] text-[rgb(var(--muted))]">
                  <span>cập nhật {formatDateTimeVn(p.updatedAt)}</span>
                  {p.embeddedAt ? (
                    <Badge variant="success">đã embed ({p.embedModel ?? "?"})</Badge>
                  ) : (
                    <Badge variant="neutral">chưa embed</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Tạo trang spec mới</CardTitle></CardHeader>
          <CardBody>
            <SpecCreateForm projectId={params.projectId} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
