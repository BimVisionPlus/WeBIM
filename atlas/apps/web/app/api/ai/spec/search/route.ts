import { rateLimitGuard } from "@atlas/lib";
// Semantic search over a project's SpecPage corpus.
// In-memory cosine over Postgres JSON embeddings — fine for <10k pages/project.
// Migrate to pgvector when corpus grows.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, requireSession } from "@atlas/auth";
import { specAi } from "@atlas/ai";

const Body = z.object({
  projectId: z.string(),
  query: z.string().min(2).max(500),
  topK: z.number().int().min(1).max(20).default(5),
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "ai.spec.search" });
  if (__rl) return __rl;
try {
    await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { projectId, query, topK } = parsed.data;
    await requireProject(projectId);

    const corpus = await prisma.specPage.findMany({
      where: { projectId, NOT: { embedding: { equals: null as any } } },
      select: { id: true, title: true, body: true, embedding: true },
    });
    if (corpus.length === 0) {
      return NextResponse.json({
        ok: true, hits: [],
        message: "Chưa có spec nào được embed. Tạo/cập nhật SpecPage trước.",
      });
    }

    const result = await specAi.searchSpecs({
      query,
      corpus: corpus.map((c) => ({
        id: c.id,
        title: c.title,
        body: c.body,
        embedding: (c.embedding as number[] | null) ?? null,
      })),
      topK,
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      hits: result.data,
      model: result.model,
      latencyMs: result.latencyMs,
      corpusSize: corpus.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
