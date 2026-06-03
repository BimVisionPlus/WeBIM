/**
 * POST /api/ai/hoancong/draft
 *
 * Body: { projectId: string, seq?: number, all?: boolean }
 *   - seq: draft just that section (1..13).
 *   - all=true: draft ALL 13 sections sequentially (slow — ~30s).
 *   - default: draft section seq=13 (the conclusion) as a quick demo.
 *
 * Persists drafts into HoanCongSection.notes (so reruns overwrite the draft
 * but never blow away the section's structural state — itemCount, signedCount).
 * If a HoanCongDossier doesn't exist yet, creates one in DRAFT state.
 *
 * Auth: requireProject. Rate-limited. Audited as ai.hoancong.draft.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { hoanCongAi } from "@atlas/ai";
import { audit, reqMeta, rateLimitGuard, formatVnd } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  seq: z.number().int().min(1).max(13).optional(),
  all: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

async function buildContext(projectId: string): Promise<Parameters<typeof hoanCongAi.draftHoanCongSection>[0]> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { ownerOrg: { select: { name: true } }, stakeholders: { include: { org: { select: { name: true } } } } },
  });

  const [boq, taskAgg, ncrAgg, dailyLogCount, acceptanceCount, incidentCount, boqByCategory] = await Promise.all([
    prisma.boQ.findFirst({ where: { projectId, isCurrent: true }, select: { contractValueVnd: true } }),
    prisma.scheduleTask.groupBy({ by: ["state"], where: { projectId }, _count: { _all: true } }),
    prisma.nCR.findMany({
      where: { projectId },
      select: { rectifiedAt: true },
    }),
    prisma.dailyLog.count({ where: { projectId } }),
    prisma.acceptance.count({ where: { projectId } }).catch(() => 0),
    prisma.incidentReport.count({ where: { projectId } }).catch(() => 0),
    prisma.$queryRaw<Array<{ category: string; total: bigint }>>`
      SELECT l."category" as category, SUM(l."totalVnd")::bigint as total
      FROM "BoQLine" l
      INNER JOIN "BoQ" b ON b.id = l."boqId"
      WHERE b."projectId" = ${projectId} AND b."isCurrent" = true
      GROUP BY l."category"
      ORDER BY total DESC
      LIMIT 5
    `.catch(() => []),
  ]);

  const taskCount = taskAgg.reduce((s, g) => s + g._count._all, 0);
  const doneTaskCount = taskAgg.find((g) => g.state === "DONE")?._count._all ?? 0;
  const ncrCount = ncrAgg.length;
  const ncrResolvedCount = ncrAgg.filter((n) => n.rectifiedAt).length;

  return {
    projectKey: project.key,
    projectName: project.name,
    ownerOrgName: project.ownerOrg.name,
    contractValueVnd: formatVnd(boq?.contractValueVnd ?? BigInt(0)),
    warrantyMonths: project.warrantyMonths ?? 24,
    boqLineCount: undefined,  // skip raw line count; categories more useful
    boqTopCategories: boqByCategory.map((c) => ({ category: c.category, valueVnd: formatVnd(c.total) })),
    taskCount,
    doneTaskCount,
    ncrCount,
    ncrResolvedCount,
    dailyLogCount,
    acceptanceCount,
    startDate: project.startDate?.toISOString().slice(0, 10),
    endDate: project.endDate?.toISOString().slice(0, 10),
    stakeholderRoles: project.stakeholders.map((s) => ({ role: s.role, orgName: s.org.name })),
    notableIncidentCount: incidentCount,
  };
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.hoancong.draft" });
  if (rl) return rl;

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { projectId, seq, all } = parsed.data;

    const { session } = await requireProject(projectId);

    // Ensure a dossier exists.
    let dossier = await prisma.hoanCongDossier.findUnique({ where: { projectId } });
    if (!dossier) {
      const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { key: true, name: true } });
      dossier = await prisma.hoanCongDossier.create({
        data: { projectId, code: `HC-${p.key}-${new Date().getFullYear()}`, title: `Hồ sơ hoàn công — ${p.name}`, state: "DRAFT" },
      });
    }

    const ctx = await buildContext(projectId);

    const seqs = all ? hoanCongAi.HOAN_CONG_SECTIONS.map((s) => s.seq) : [seq ?? 13];

    const drafts = [];
    for (const s of seqs) {
      const r = await hoanCongAi.draftHoanCongSection(ctx, s);
      if (!r.ok) continue;
      const d = r.data;

      // Upsert HoanCongSection row keyed by (dossierId, seq).
      const meta = hoanCongAi.HOAN_CONG_SECTIONS.find((x) => x.seq === s)!;
      await prisma.hoanCongSection.upsert({
        where: { dossierId_seq: { dossierId: dossier.id, seq: s } },
        create: {
          dossierId: dossier.id, seq: s, code: meta.code, title: meta.title,
          required: meta.required, notes: d.body,
        },
        update: { notes: d.body },
      });
      drafts.push(d);
    }

    await audit({
      action: "ai.hoancong.draft",
      entityType: "HoanCongDossier",
      entityId: dossier.id,
      actorId: session.userId,
      projectId,
      ...reqMeta(req),
      after: { sectionsDrafted: drafts.length, sourceMix: drafts.map((d) => d.source) },
    });

    return NextResponse.json({ ok: true, dossierId: dossier.id, drafts });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
