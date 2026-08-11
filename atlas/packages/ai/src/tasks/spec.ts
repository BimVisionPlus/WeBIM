// Spec page RAG — embed each SpecPage on save, retrieve top-k for RFI drafting.
// Storage: SpecPage.embedding (Json array) — fine for ≤10k pages per project.
// Scale beyond: migrate to pgvector (one column type change, no app code).

import { embed, cosine } from "../embed";
import type { AiResult } from "../types";

export type SpecCandidate = { id: string; title: string; body: string; embedding: number[] | null };
export type SpecHit = { id: string; title: string; snippet: string; score: number };

export async function embedSpecText(text: string): Promise<AiResult<number[]>> {
  // Truncate to keep embed model happy; bge-m3 handles 8192 tokens but we cap shorter.
  const trimmed = text.slice(0, 6_000);
  return embed(trimmed);
}

export async function searchSpecs(args: {
  query: string;
  corpus: SpecCandidate[];
  topK?: number;
}): Promise<AiResult<SpecHit[]>> {
  const qv = await embed(args.query);
  if (!qv.ok) return qv;
  const scored: SpecHit[] = args.corpus
    .filter((c): c is SpecCandidate & { embedding: number[] } =>
      Array.isArray(c.embedding) && c.embedding.length > 0)
    .map((c) => ({
      id: c.id,
      title: c.title,
      snippet: c.body.slice(0, 400),
      score: cosine(qv.data, c.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, args.topK ?? 5);
  return { ok: true, data: scored, model: qv.model, latencyMs: qv.latencyMs };
}
