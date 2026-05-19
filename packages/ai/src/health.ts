// Health probe for the AI stack. Used by /settings/ai page + GET /api/ai/health.

import { aiConfig } from "./config";
import { getJson } from "./http";

export type AiHealth = {
  enabled: boolean;
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
  const [ollama, whisper] = await Promise.all([probeOllama(cfg), probeWhisper(cfg)]);
  return { enabled: cfg.enabled, ollama, whisper };
}

async function probeOllama(cfg: ReturnType<typeof aiConfig>): Promise<AiHealth["ollama"]> {
  type TagsResp = { models?: Array<{ name: string }> };
  const r = await getJson<TagsResp>(`${cfg.ollama.baseUrl}/api/tags`, { timeoutMs: 5_000 });
  const required = {
    llm: cfg.ollama.llmModel,
    vlm: cfg.ollama.vlmModel,
    embed: cfg.ollama.embedModel,
  };
  if (!r.ok) {
    return {
      baseUrl: cfg.ollama.baseUrl,
      reachable: false,
      models: [],
      required,
      missing: [required.llm, required.vlm, required.embed],
      error: r.reason,
    };
  }
  const models = (r.data.models ?? []).map((m) => m.name);
  const has = (name: string) =>
    models.some((m) => m === name || m.startsWith(name + ":") || m.startsWith(name.split(":")[0] + ":"));
  const missing = [required.llm, required.vlm, required.embed].filter((n) => !has(n));
  return { baseUrl: cfg.ollama.baseUrl, reachable: true, models, required, missing };
}

async function probeWhisper(cfg: ReturnType<typeof aiConfig>): Promise<AiHealth["whisper"]> {
  const r = await getJson<{ status?: string }>(`${cfg.whisper.baseUrl}/health`, { timeoutMs: 5_000 });
  if (!r.ok) {
    return {
      baseUrl: cfg.whisper.baseUrl,
      reachable: false,
      model: cfg.whisper.model,
      error: r.reason,
    };
  }
  return { baseUrl: cfg.whisper.baseUrl, reachable: true, model: cfg.whisper.model };
}
