// PATCH /api/qaqc/[id] — Mark result PASS/FAIL/REWORK/WAIVED. FAIL → auto-create NCR Issue.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  result: z.enum(["PASS", "FAIL", "REWORK", "WAIVED"]),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "qaqc.update" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { result, notes } = parsed.data;
    const check = await prisma.qaqcCheck.findUnique({ where: { id: params.id } });
    if (!check) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(check.projectId);

    let ncrId: string | null = check.ncrId ?? null;
    if (result === "FAIL" && !ncrId) {
      // FAIL auto-tạo NCR (Issue type) — anchor truy ngược
      const project = await prisma.project.findUnique({ where: { id: check.projectId } });
      const keyPrefix = project?.key ?? "PRJ";
      const count = await prisma.issue.count({ where: { projectId: check.projectId, type: "NCR" } });
      const issueKey = `${keyPrefix}-NCR-${String(count + 1).padStart(3, "0")}`;
      const issue = await prisma.issue.create({
        data: {
          projectId: check.projectId, key: issueKey, type: "NCR",
          title: `QAQC FAIL @ ${check.location}`,
          description: `Auto-tạo từ QaqcCheck ${check.id}. ${notes ?? ""}`,
          state: "OPEN",
          priority: "HIGH",
          reporterId: session.userId,
        },
      }).catch(() => null);
      if (issue) ncrId = issue.id;
    }

    await prisma.qaqcCheck.update({
      where: { id: params.id },
      data: { result, conductedAt: new Date(), notes: notes ?? check.notes, ncrId },
    });
    await audit({ action: "qaqc.update", entityType: "QaqcCheck", entityId: params.id, actorId: session.userId, projectId: check.projectId, ...reqMeta(req), before: { result: check.result }, after: { result, ncrId } });
    return NextResponse.json({ ok: true, result, ncrId });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
