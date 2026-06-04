import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { FieldApp } from "./FieldApp";

export const dynamic = "force-dynamic";

export default async function FieldPage() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/field");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    select: { orgId: true },
  });
  const orgIds = memberships.map((m) => m.orgId);

  const [projects, latestAttendance] = await Promise.all([
    prisma.project.findMany({
      where: { OR: [{ ownerOrgId: { in: orgIds } }, { stakeholders: { some: { orgId: { in: orgIds } } } }] },
      select: { id: true, key: true, name: true },
      orderBy: { key: "asc" },
      take: 20,
    }),
    prisma.attendance.findFirst({
      where: { worker: { orgId: { in: orgIds } } },
      include: { worker: { select: { fullName: true, workerCode: true } }, project: { select: { key: true, name: true } } },
      orderBy: { checkInAt: "desc" },
    }),
  ]);

  return (
    <FieldApp
      projects={projects}
      latestAttendance={latestAttendance ? {
        id: latestAttendance.id,
        workerName: latestAttendance.worker.fullName,
        workerCode: latestAttendance.worker.workerCode,
        projectKey: latestAttendance.project.key,
        checkInAt: latestAttendance.checkInAt.toISOString(),
        checkOutAt: latestAttendance.checkOutAt?.toISOString() ?? null,
      } : null}
    />
  );
}
