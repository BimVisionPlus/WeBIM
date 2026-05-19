// Ollama embeddings adapter (bge-m3 / nomic-embed-text / multilingual-e5).
// Returns a single vector per input string; callers batch by mapping.

import { aiConfig } from "./config";
import { postJson } from "./http";
import type { AiResult } from "./types";

type EmbedResp = { embedding: number[] } | { embeddings: number[][] };

export async function embed(text: string): Promise<AiResult<number[]>> {
  const cfg = aiConfig();
  if (!cfg.enabled) return { ok: false, reason: "disabled", latencyMs: 0 };
  const started = Date.now();
  const r = await postJson<EmbedResp>(
    `${cfg.ollama.baseUrl}/api/embeddings`,
    { model: cfg.ollama.embedModel, prompt: text },
    { timeoutMs: cfg.ollama.timeoutMs },
  );
  const latencyMs = Date.now() - started;
  if (!r.ok) return { ok: false, reason: r.reason, error: r.error, latencyMs };
  const vec = "embedding" in r.data ? r.data.embedding : r.data.embeddings?.[0];
  if (!vec || !vec.length) return { ok: false, reason: "invalid_response", latencyMs };
  return { ok: true, data: vec, model: cfg.ollama.embedModel, latencyMs };
}

/** Cosine similarity for in-memory KNN over small corpuses. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
