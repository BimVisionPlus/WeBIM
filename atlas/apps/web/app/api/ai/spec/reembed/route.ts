import { rateLimitGuard } from "@atlas/lib";
// Batch re-embed every SpecPage in a project — useful after seed, model
// upgrade, or pgvector migration. Idempotent: skips pages whose embedModel
// already matches the current default.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { specAi, aiConfig } from "@atlas/ai";

const Body = z.object({
  projectId: z.string(),
  force: z.boolean().default(false),
});

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "ai.spec.reembed" });
  if (__rl) return __rl;
try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await requireProject(parsed.data.projectId);

    if (!aiConfig().enabled) {
      return NextResponse.json({ ok: false, reason: "AI disabled" }, { status: 503 });
    }
    const targetModel = aiConfig().ollama.embedModel;

    const pages = await prisma.specPage.findMany({
      where: { projectId: parsed.data.projectId },
      select: { id: true, title: true, body: true, embedModel: true },
    });

    let embedded = 0, skipped = 0, failed = 0;
    for (const p of pages) {
      if (!parsed.data.force && p.embedModel === targetModel) {
        skipped++;
        continue;
      }
      const r = await specAi.embedSpecText(`${p.title}\n\n${p.body}`);
      if (!r.ok) { failed++; continue; }
      await prisma.specPage.update({
        where: { id: p.id },
        data: { embedding: r.data as any, embeddedAt: new Date(), embedModel: r.model },
      });
      embedded++;
    }

    return NextResponse.json({ ok: true, total: pages.length, embedded, skipped, failed, model: targetModel });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
