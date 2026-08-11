/**
 * POST /api/ai/submittal/check
 *
 * Body: { submittalId: string }   // = Submittal.issueId
 *   - Compares the submittal vs project's spec corpus.
 *   - Returns compliance + findings + suggestion.
 *
 * Auth: requireProject. Rate-limited. Audited.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { submittalCheckAi } from "@atlas/ai";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({ submittalId: z.string() });

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "ai.submittal.check" });
  if (rl) return rl;

  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const submittal = await prisma.submittal.findUnique({
      where: { issueId: parsed.data.submittalId },
      include: { issue: { select: { projectId: true } } },
    });
    if (!submittal) return NextResponse.json({ error: "Submittal không tồn tại" }, { status: 404 });

    const projectId = submittal.issue.projectId;
    const { session } = await requireProject(projectId);

    // Pull spec pages with their embeddings.
    const specPages = await prisma.specPage.findMany({
      where: { projectId },
      select: { id: true, title: true, body: true, embedding: true },
      take: 200,
    });

    const r = await submittalCheckAi.checkSubmittal({
      submittal: {
        specSection: submittal.specSection,
        materialName: submittal.materialName,
        manufacturer: submittal.manufacturer,
      },
      specPages: specPages.map((p) => ({
        id: p.id, title: p.title, body: p.body,
        embedding: Array.isArray(p.embedding) ? (p.embedding as number[]) : null,
      })),
    });

    if (!r.ok) return NextResponse.json({ ok: false, error: r.error ?? r.reason }, { status: 200 });

    await audit({
      action: "ai.submittal.check",
      entityType: "Submittal",
      entityId: submittal.issueId,
      actorId: session.userId,
      projectId,
      ...reqMeta(req),
      after: { compliance: r.data.compliance, findingCount: r.data.findings.length, source: r.data.source },
    });

    return NextResponse.json({ ok: true, ...r.data });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
