import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@atlas/db";
import { requireProject } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@atlas/ui";
import { formatDateTimeVn } from "@atlas/lib";

export const dynamic = "force-dynamic";

export default async function SpecDetail({
  params,
}: {
  params: { projectId: string; slug: string };
}) {
  await requireProject(params.projectId);
  // Support both /specs/<slug> and /specs/<id>.
  const page = await prisma.specPage.findFirst({
    where: {
      projectId: params.projectId,
      OR: [{ slug: params.slug }, { id: params.slug }],
    },
  });
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="text-xs text-slate-500">
        <Link href={`/projects/${params.projectId}/specs`} className="hover:text-slate-900">
          ← Specs
        </Link>
      </div>
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{page.title}</h1>
          <div className="mt-1 text-xs text-slate-500">
            /{page.slug} · cập nhật {formatDateTimeVn(page.updatedAt)}
          </div>
        </div>
        {page.embeddedAt ? (
          <Badge variant="success">đã embed ({page.embedModel ?? "?"})</Badge>
        ) : (
          <Badge variant="neutral">chưa embed</Badge>
        )}
      </header>
      <Card>
        <CardHeader><CardTitle>Nội dung</CardTitle></CardHeader>
        <CardBody>
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800">{page.body}</pre>
        </CardBody>
      </Card>
    </div>
  );
}
