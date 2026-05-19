import Link from "next/link";
import { prisma } from "@atlas/db";
import { Card, CardBody, Badge, stateBadgeVariant } from "@atlas/ui";
import { issueTypeMeta, relativeDateVn } from "@atlas/lib";
import { CreateIssueDialog } from "@/components/create-issue-dialog";

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { type?: string; state?: string };
}) {
  const where: any = { projectId: params.projectId };
  if (searchParams.type) where.type = searchParams.type;
  if (searchParams.state) where.state = searchParams.state;

  const [issues, stakeholders] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { assignee: true, reporter: true },
    }),
    prisma.projectStakeholder.findMany({
      where: { projectId: params.projectId },
      include: { org: { select: { id: true, name: true } } },
    }),
  ]);

  const stakeholderOpts = stakeholders.map((s) => ({ id: s.org.id, name: s.org.name, role: s.role }));
  const kind = (searchParams.type as any) || "TASK";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Issues ({issues.length})</h2>
        <CreateIssueDialog kind={kind} projectId={params.projectId} stakeholders={stakeholderOpts} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/projects/${params.projectId}/site/issues`}
          className={`rounded-full px-3 py-1 text-xs ${
            !searchParams.type ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200 hover:bg-slate-100"
          }`}
        >
          Tất cả
        </Link>
        {(["RFI", "SUBMITTAL", "NCR", "PUNCH", "CHANGE_ORDER"] as const).map((t) => (
          <Link
            key={t}
            href={`/projects/${params.projectId}/site/issues?type=${t}`}
            className={`rounded-full px-3 py-1 text-xs ${
              searchParams.type === t ? "bg-slate-900 text-white" : "bg-white ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
          >
            {issueTypeMeta[t]?.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Khoá</th>
                <th className="px-4 py-2.5">Loại</th>
                <th className="px-4 py-2.5">Tiêu đề</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5">Phụ trách</th>
                <th className="px-4 py-2.5">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issues.map((i) => (
                <tr key={i.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">
                    <Link
                      href={`/projects/${params.projectId}/site/issues/${encodeURIComponent(i.key)}`}
                      className="hover:underline"
                    >
                      {i.key}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ background: issueTypeMeta[i.type]?.color }}
                    >
                      {issueTypeMeta[i.type]?.prefix}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-900">{i.title}</td>
                  <td className="px-4 py-2">
                    <Badge variant={stateBadgeVariant(i.state)}>{i.state}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{i.assignee?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{relativeDateVn(i.updatedAt)}</td>
                </tr>
              ))}
              {issues.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    Chưa có issue nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
