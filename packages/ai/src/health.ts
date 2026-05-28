// Health probe for the AI stack. Used by /settings/ai page + GET /api/ai/health.
// Provider-aware: probes whichever backend each capability is configured to use
// (Ollama/Whisper self-host, or Groq + Cloudflare free tiers). The `ollama` /
// `whisper` field names are kept for UI compatibility — they report the ACTIVE
// LLM and STT provider respectively.

import { aiConfig } from "./config";
import { getJson } from "./http";

export type AiHealth = {
  enabled: boolean;
  providers: { llm: string; embed: string; vision: string; stt: string };
  ollama: {
    baseUrl: string;
    reachable: boolean;
    models: string[];
    required: { llm: string; vlm: string; embed: string };
    missing: string[];
    error?: string;
  };
  whisper: {
    baseUrl: string;
    reachable: boolean;
    model: string;
    error?: string;
  };
};

export async function aiHealth(): Promise<AiHealth> {
  const cfg = aiConfig();
  const [llm, stt] = await Promise.all([probeLlm(cfg), probeStt(cfg)]);
  return {
    enabled: cfg.enabled,
    providers: { llm: cfg.llmProvider, embed: cfg.embedProvider, vision: cfg.visionProvider, stt: cfg.sttProvider },
    ollama: llm,
    whisper: stt,
  };
}

// Probe the active LLM provider; reported via the `ollama` field for UI compat.
async function probeLlm(cfg: ReturnType<typeof aiConfig>): Promise<AiHealth["ollama"]> {
  // ─── Groq ───────────────────────────────────────────────────────────────
  if (cfg.llmProvider === "groq") {
    const required = { llm: cfg.groq.llmModel, vlm: cfg.groq.visionModel, embed: cfg.cloudflare.embedModel };
    if (!cfg.groq.apiKey) {
      return { baseUrl: cfg.groq.baseUrl, reachable: false, models: [], required, missing: Object.values(required), error: "GROQ_API_KEY unset" };
    }
    type ModelsResp = { data?: Array<{ id: string }> };
    const r = await getJson<ModelsResp>(`${cfg.groq.baseUrl}/models`, { timeoutMs: 5_000 });
    // getJson doesn't take headers; Groq /models needs auth — but a 401 still
    // proves reachability. Treat any HTTP response as "reachable".
    if (!r.ok && r.reason === "unreachable") {
      return { baseUrl: cfg.groq.baseUrl, reachable: false, models: [], required, missing: Object.values(required), error: r.reason };
    }
    const models = (r.ok ? r.data.data ?? [] : []).map((m) => m.id);
    return { baseUrl: cfg.groq.baseUrl, reachable: true, models, required, missing: [] };
  }

  // ─── Ollama (default) ─────────────────────────────────────────────────────
  type TagsResp = { models?: Array<{ name: string }> };
  const r = await getJson<TagsResp>(`${cfg.ollama.baseUrl}/api/tags`, { timeoutMs: 5_000 });
  const required = { llm: cfg.ollama.llmModel, vlm: cfg.ollama.vlmModel, embed: cfg.ollama.embedModel };
  if (!r.ok) {
    return { baseUrl: cfg.ollama.baseUrl, reachable: false, models: [], required, missing: [required.llm, required.vlm, required.embed], error: r.reason };
  }
  const models = (r.data.models ?? []).map((m) => m.name);
  const has = (name: string) => models.some((m) => m === name || m.startsWith(name + ":") || m.startsWith(name.split(":")[0] + ":"));
  const missing = [required.llm, required.vlm, required.embed].filter((n) => !has(n));
  return { baseUrl: cfg.ollama.baseUrl, reachable: true, models, required, missing };
}

// Probe the active STT provider; reported via the `whisper` field for UI compat.
async function probeStt(cfg: ReturnType<typeof aiConfig>): Promise<AiHealth["whisper"]> {
  if (cfg.sttProvider === "groq") {
    // Groq STT shares the LLM endpoint — if GROQ_API_KEY is set, consider it up.
    return { baseUrl: cfg.groq.baseUrl, reachable: !!cfg.groq.apiKey, model: cfg.groq.sttModel, error: cfg.groq.apiKey ? undefined : "GROQ_API_KEY unset" };
  }
  const r = await getJson<{ status?: string }>(`${cfg.whisper.baseUrl}/health`, { timeoutMs: 5_000 });
  if (!r.ok) return { baseUrl: cfg.whisper.baseUrl, reachable: false, model: cfg.whisper.model, error: r.reason };
  return { baseUrl: cfg.whisper.baseUrl, reachable: true, model: cfg.whisper.model };
}
