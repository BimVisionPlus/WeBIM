// PATCH /api/labreports/[id] — Mark result + auto-NCR on FAIL.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  result: z.enum(["PASS", "FAIL", "CONDITIONAL"]),
  parameters: z.record(z.union([z.number(), z.string()])).optional(),
  notes: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "labreports.update" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const report = await prisma.labReport.findUnique({ where: { id: params.id } });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(report.projectId);

    const update: Record<string, unknown> = { result: parsed.data.result, testedAt: new Date() };
    if (parsed.data.parameters) update.parameters = parsed.data.parameters;
    if (parsed.data.notes) update.notes = parsed.data.notes;

    // Auto-create NCR Issue on FAIL
    let ncrId: string | null = report.ncrId ?? null;
    if (parsed.data.result === "FAIL" && !ncrId) {
      const project = await prisma.project.findUnique({ where: { id: report.projectId } });
      const keyPrefix = project?.key ?? "PRJ";
      const count = await prisma.issue.count({ where: { projectId: report.projectId, type: "NCR" } });
      const issueKey = `${keyPrefix}-NCR-${String(count + 1).padStart(3, "0")}`;
      const issue = await prisma.issue.create({
        data: {
          projectId: report.projectId, key: issueKey, type: "NCR",
          title: `LAB FAIL: ${report.sampleCode} (${report.sampleType})`,
          description: `Mẫu ${report.sampleCode} thí nghiệm theo ${report.tcvnRef} không đạt. ${parsed.data.notes ?? ""}`,
          state: "OPEN", priority: "HIGH",
          reporterId: session.userId,
        },
      }).catch(() => null);
      if (issue) { update.ncrId = issue.id; ncrId = issue.id; }
    }

    await prisma.labReport.update({ where: { id: params.id }, data: update });
    await audit({ action: "labreports.update", entityType: "LabReport", entityId: params.id, actorId: session.userId, projectId: report.projectId, ...reqMeta(req), before: { result: report.result }, after: { result: parsed.data.result, ncrId } });
    return NextResponse.json({ ok: true, result: parsed.data.result, ncrId });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
