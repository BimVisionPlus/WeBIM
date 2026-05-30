import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";
import { orgTypeLabel } from "@atlas/lib";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/settings/team");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId, role: { in: ["OWNER", "ADMIN"] } },
    include: {
      org: {
        include: {
          members: { include: { user: { select: { id: true, email: true, name: true } } } },
          invites: { where: { acceptedAt: null, revokedAt: null }, orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card><CardBody className="text-sm text-slate-600">Bạn chưa là OWNER/ADMIN của tổ chức nào.</CardBody></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 font-bold text-white">A</div>
            <span className="text-lg font-semibold">Viwase Quản lý công việc</span>
          </Link>
          <Link href="/" className="text-sm text-slate-600 hover:text-slate-900">← Dự án</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Quản lý tổ chức</h1>
        <div className="space-y-6">
          {memberships.map((m) => (
            <Card key={m.org.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{m.org.name}</CardTitle>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {orgTypeLabel[m.org.type]}
                  </span>
                </div>
              </CardHeader>
              <CardBody className="space-y-6">
                <div>
                  <h3 className="mb-2 text-sm font-medium text-slate-800">Thành viên ({m.org.members.length})</h3>
                  <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {m.org.members.map((mem) => (
                      <li key={mem.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium text-slate-900">{mem.user.name}</div>
                          <div className="text-xs text-slate-500">{mem.user.email}</div>
                        </div>
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{mem.role}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {m.org.invites.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-slate-800">Lời mời đang chờ</h3>
                    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                      {m.org.invites.map((iv) => (
                        <li key={iv.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div>
                            <div className="font-medium text-slate-700">{iv.email}</div>
                            <div className="text-xs text-slate-500">
                              {iv.role} · hết hạn {iv.expiresAt.toLocaleDateString("vi-VN")}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 text-sm font-medium text-slate-800">Mời thành viên mới</h3>
                  <InviteForm orgId={m.org.id} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
