/**
 * Giao việc cho nhân sự, để trang /people có gì mà thống kê.
 *
 * Applies each process template to a project and spreads the steps across the
 * org's members with a mix of on-time, late and still-open — a demo where
 * everyone is at 100% teaches nothing about the page.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Fixed so the demo reads the same tomorrow. */
const TODAY = new Date("2026-08-12T00:00:00Z");
const day = (offset: number) => new Date(TODAY.getTime() + offset * 86_400_000);

/**
 * The base seed gives each org one member, so a page whose job is comparing
 * people had exactly one row. Put the whole demo team in the org that owns
 * the projects — idempotent, and it only ever adds.
 */
async function gatherTeam() {
  const host = await prisma.organization.findFirst({
    where: { projectsOwned: { some: {} } },
    orderBy: { projectsOwned: { _count: "desc" } },
  });
  if (!host) return;

  const users = await prisma.user.findMany({ select: { id: true } });
  const roles = ["PROJECT_MGR", "ENGINEER", "SUPERVISOR", "ADMIN"] as const;
  for (const [index, user] of users.entries()) {
    await prisma.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: host.id } },
      update: {},
      create: {
        userId: user.id,
        orgId: host.id,
        role: roles[index % roles.length],
      },
    });
  }
  console.log(`  ✓ ${users.length} người vào ${host.name}`);
}

async function main() {
  await gatherTeam();

  const orgs = await prisma.organization.findMany({
    where: { members: { some: {} } },
    include: { members: { select: { userId: true } }, projectsOwned: { select: { id: true } } },
  });

  let runs = 0;
  for (const org of orgs) {
    const userIds = org.members.map((member) => member.userId);
    if (userIds.length === 0) continue;

    const templates = await prisma.processTemplate.findMany({
      where: { orgId: org.id },
      include: { steps: { orderBy: { seq: "asc" } } },
    });

    for (const [templateIndex, template] of templates.entries()) {
      if (template.steps.length === 0) continue;
      const projectId = org.projectsOwned[templateIndex % Math.max(org.projectsOwned.length, 1)]?.id;

      // One run per template; re-running replaces it rather than piling up.
      await prisma.processRun.deleteMany({
        where: { templateId: template.id, name: { startsWith: "[demo]" } },
      });
      const run = await prisma.processRun.create({
        data: {
          templateId: template.id,
          projectId: projectId ?? null,
          name: `[demo] ${template.name}`,
          startedAt: day(-30),
        },
      });
      runs += 1;

      let elapsed = 0;
      for (const [stepIndex, step] of template.steps.entries()) {
        elapsed += step.slaDays;
        const dueAt = new Date(run.startedAt.getTime() + elapsed * 86_400_000);
        const assignee = userIds[(templateIndex + stepIndex) % userIds.length];

        // A spread worth looking at: mostly done, some late, one left open and
        // overdue, one untouched.
        const position = stepIndex % 4;
        const done = position !== 3;
        const late = position === 2;

        await prisma.processTask.create({
          data: {
            runId: run.id,
            stepId: step.id,
            assigneeUserId: assignee ?? null,
            dueAt,
            status: done ? "DONE" : stepIndex % 2 === 0 ? "IN_PROGRESS" : "PENDING",
            progress: done ? 100 : 45,
            decidedAt: done
              ? new Date(dueAt.getTime() + (late ? 4 : -1) * 86_400_000)
              : null,
          },
        });
      }
    }
  }

  const assigned = await prisma.processTask.count({ where: { assigneeUserId: { not: null } } });
  console.log(`==> ${runs} run demo · ${assigned} bước đã giao người`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
