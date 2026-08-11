// POST /api/docchat/corpus — Index a new document into the RAG corpus.
// Production: chunk + bge-m3 embed via worker. Here: store + naive chunk count.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string().optional(),
  sourceType: z.enum(["HOP_DONG", "BBNT", "CV_QLNN", "THIET_KE", "TCVN", "BPTC", "RFI", "EMAIL", "KHAC"]),
  title: z.string().min(2).max(300),
  body: z.string().min(10).max(200000),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "docchat.corpus" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    // Naive chunking: ~512-char windows (production: bge-m3 token-aware split).
    const chunkCount = Math.max(1, Math.ceil(d.body.length / 512));
    const corpus = await prisma.docCorpus.create({
      data: {
        projectId: d.projectId ?? null,
        sourceType: d.sourceType, title: d.title, body: d.body,
        chunkCount, indexed: true, indexedAt: new Date(), embedModel: "bge-m3",
      },
    });
    await audit({ action: "docchat.corpus.create", entityType: "DocCorpus", entityId: corpus.id, actorId: session.userId, ...reqMeta(req), after: { title: d.title, chunkCount } });
    return NextResponse.json({ ok: true, id: corpus.id, chunkCount });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
