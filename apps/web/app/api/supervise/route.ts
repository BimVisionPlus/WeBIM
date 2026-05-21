// POST /api/supervise — Create SuperviseEntry.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  logDate: z.string(),
  shift: z.enum(["DAY", "NIGHT", "FULL"]).default("DAY"),
  weather: z.string().max(200).optional(),
  attendees: z.string().max(2000).optional(),
  workItems: z.string().min(2).max(5000),
  qualityNotes: z.string().max(5000).optional(),
  safetyNotes: z.string().max(5000).optional(),
  materialsNotes: z.string().max(5000).optional(),
  voiceTranscript: z.string().max(10000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "supervise.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const tvgsOrg = await prisma.organization.findFirst({ where: { type: "TU_VAN_GIAM_SAT" } });
    const entry = await prisma.superviseEntry.upsert({
      where: { projectId_logDate_shift: { projectId: d.projectId, logDate: new Date(d.logDate), shift: d.shift } },
      create: {
        projectId: d.projectId, logDate: new Date(d.logDate), shift: d.shift,
        weather: d.weather ?? null, attendees: d.attendees ?? null,
        workItems: d.workItems, qualityNotes: d.qualityNotes ?? null,
        safetyNotes: d.safetyNotes ?? null, materialsNotes: d.materialsNotes ?? null,
        voiceTranscript: d.voiceTranscript ?? null,
        testRefs: [], ncrIds: [], rfiIds: [], acceptanceIds: [], photoUrls: [],
        supervisorOrgId: tvgsOrg?.id ?? null, supervisorUserId: session.userId,
        state: "DRAFT",
      },
      update: {
        weather: d.weather ?? null, workItems: d.workItems,
        qualityNotes: d.qualityNotes ?? null, safetyNotes: d.safetyNotes ?? null,
      },
    });
    await audit({ action: "supervise.upsert", entityType: "SuperviseEntry", entityId: entry.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { logDate: d.logDate, shift: d.shift } });
    return NextResponse.json({ ok: true, id: entry.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
