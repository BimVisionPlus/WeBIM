/**
 * POST /api/ai/compliance/check
 *
 * Body: { projectId: string, standardCodes?: string[] }
 *
 * Runs AI compliance assessment of a project against TCVN/QCVN standards.
 * Uses Regulation + CodeRule for the standards library, NCR + Submittal +
 * IncidentReport + AuditPrep for project artifacts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { complianceAi } from "@atlas/ai";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  standardCodes: z.array(z.string()).optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.compliance.check" }); if (rl) return rl;
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { projectId, standardCodes } = parsed.data;
    const { session, project } = await requireProject(projectId);

    // Standards — either explicit list or all IN_FORCE TCVN/QCVN
    const regulationsRaw = await prisma.regulation.findMany({
      where: {
        status: "IN_FORCE",
        kind: { in: ["TCVN", "QCVN"] },
        ...(standardCodes?.length ? { code: { in: standardCodes } } : {}),
      },
      include: { rules: { where: { isActive: true }, select: { clauseRef: true, title: true, severity: true } } },
      take: 15,
    });
    if (regulationsRaw.length === 0) return NextResponse.json({ error: "Chưa có tiêu chuẩn TCVN/QCVN nào trong hệ thống" }, { status: 400 });

    // Artifacts
    const [ncrs, submittals, incidents, pcccPassed, sxdPassed, openPreps] = await Promise.all([
      prisma.nCR.findMany({
        where: { projectId },
        select: { qcvnRef: true, rectifiedAt: true, severity: true, issue: { select: { title: true } } },
        take: 30,
      }),
      prisma.submittal.findMany({
        where: { projectId },
        select: { specSection: true, materialName: true, decision: true },
        take: 30,
      }),
      prisma.incidentReport.findMany({
        where: { projectId },
        select: { category: true, severity: true, description: true },
        take: 10,
      }),
      prisma.auditPrep.count({ where: { projectId, kind: "PC07_PCCC", state: "PASSED" } }),
      prisma.auditPrep.count({ where: { projectId, kind: "SO_XAY_DUNG", state: "PASSED" } }),
      prisma.auditPrep.count({ where: { projectId, state: { in: ["DRAFT", "IN_PROGRESS", "READY", "INSPECTING"] } } }),
    ]);

    const r = await complianceAi.checkCompliance({
      projectKey: project.key, projectName: project.name,
      standards: regulationsRaw.map((reg) => ({
        code: reg.code, title: reg.title,
        rules: reg.rules.map((rl) => ({ clauseRef: rl.clauseRef, title: rl.title, severity: rl.severity })),
      })),
      artifacts: {
        ncrs: ncrs.map((n) => ({
          title: n.issue.title, qcvnRef: n.qcvnRef, severity: n.severity,
          rectified: !!n.rectifiedAt,
        })),
        submittals: submittals.map((s) => ({ specSection: s.specSection, materialName: s.materialName, decision: s.decision })),
        incidents: incidents.map((i) => ({ category: i.category, severity: i.severity, description: i.description.slice(0, 200) })),
        pcccPrepsCompleted: pcccPassed,
        sxdPrepsCompleted: sxdPassed,
        openAuditPreps: openPreps,
      },
    });
    if (!r.ok) return NextResponse.json({ error: r.error ?? r.reason }, { status: 500 });

    await audit({
      action: "ai.compliance.check", entityType: "Project", entityId: projectId,
      actorId: session.userId, projectId, ...reqMeta(req),
      after: {
        overallScore: r.data.overallScore, overallStatus: r.data.overallStatus,
        standardCount: r.data.standards.length, source: r.data.source,
      },
    });

    return NextResponse.json({ ok: true, ...r.data });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
