// DocChat-VN API — RAG endpoint stub. Production: hits Ollama qwen2.5-14b-instruct + bge-m3 embed.
// For now: returns a deterministic stub citation so the UI has something to show.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const question = (form.get("question") as string | null)?.trim();
  if (!question) return NextResponse.redirect(new URL("/docchat", req.url));

  const t0 = Date.now();

  // Production: embed question → top-k cosine pgvector → Qwen2.5-14B with citations
  // Stub: pick last 3 indexed corpus entries, return them as citations.
  const corpus = await prisma.docCorpus.findMany({
    where: { indexed: true },
    take: 3,
    orderBy: { updatedAt: "desc" },
  });

  const answer = corpus.length > 0
    ? `Theo các tài liệu trong corpus, có ${corpus.length} đoạn liên quan đến câu hỏi của bạn. Vui lòng xem citation bên dưới.`
    : "Chưa có tài liệu nào được index trong corpus. Vui lòng upload + index trước khi hỏi.";

  const citations = corpus.map((c) => ({
    corpusId: c.id,
    title: c.title,
    sourceType: c.sourceType,
    snippet: c.body.slice(0, 200) + "…",
    score: 0.85 - corpus.indexOf(c) * 0.05,
  }));

  await prisma.docChatQuery.create({
    data: {
      userId: session.userId,
      question,
      answer,
      citations,
      modelUsed: "qwen2.5-14b-instruct (stub)",
      latencyMs: Date.now() - t0,
    },
  });

  return NextResponse.redirect(new URL("/docchat", req.url));
}
