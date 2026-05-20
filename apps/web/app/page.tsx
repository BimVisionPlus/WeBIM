import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";
import { formatVndShort } from "@atlas/lib";
import { OrgSwitcher } from "@/components/org-switcher";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/signin");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { org: { select: { id: true, name: true, slug: true } } },
  });
  if (memberships.length === 0) redirect("/onboarding/org");

  const orgs = memberships.map((m) => m.org);
  const activeSlug = cookies().get("atlas_active_org")?.value ?? orgs[0]!.slug;
  const activeOrg = orgs.find((o) => o.slug === activeSlug) ?? orgs[0]!;
  const orgIds = activeOrg ? [activeOrg.id] : memberships.map((m) => m.orgId);
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerOrgId: { in: orgIds } },
        { stakeholders: { some: { orgId: { in: orgIds } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { issues: true, models: true, drawingSets: true } } },
  });

  if (projects.length === 0) {
    redirect(`/onboarding/project?orgId=${orgIds[0]}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <a href="https://aecplatform.vn" className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 font-bold text-white hover:opacity-90" title="AEC Platform — về trang chủ">
              A
            </a>
            <div className="flex flex-col leading-tight">
              <a href="https://aecplatform.vn" className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-900">
                AEC Platform
              </a>
              <span className="text-base font-semibold text-slate-900">Atlas AEC</span>
            </div>
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              v1 · LIVE
            </span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-600">
            <OrgSwitcher orgs={orgs} activeSlug={activeOrg.slug} />
            <Link href="/" className="hover:text-slate-900">Dự án</Link>
            <Link href="/winwork" className="hover:text-slate-900">WinWork</Link>
            <Link href="/portfolio" className="hover:text-slate-900">Portfolio</Link>
            <Link href="/trust" className="hover:text-slate-900">Trust</Link>
            <Link href="/pricing" className="hover:text-slate-900">Giá</Link>
            <Link href="/settings/team" className="hover:text-slate-900">Tổ chức</Link>
            <Link href="/api/auth/signout" className="hover:text-slate-900">Đăng xuất ({session.name})</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dự án</h1>
            <p className="text-sm text-slate-500">
              Tất cả công trình bạn đang tham gia với vai trò CĐT / TVGS / NT / TVTK
            </p>
          </div>
          <Link
            href={`/onboarding/project?orgId=${orgIds[0]}`}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Dự án mới
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{p.key}</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      {p.status === "IN_PROGRESS" ? "Đang thi công" : p.status}
                    </span>
                  </div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Địa điểm</span>
                    <span className="text-slate-700">{p.province ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Giá trị HĐ</span>
                    <span className="font-medium text-slate-900">{formatVndShort(p.contractValueVnd)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-xs">
                    <span className="text-slate-500">{p._count.issues} issues</span>
                    <span className="text-slate-500">{p._count.drawingSets} bộ vẽ</span>
                    <span className="text-slate-500">{p._count.models} mô hình</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
