// Resolve AI settings from env. Re-evaluated lazily so tests can mutate env.
// Reads process.env defensively — when @atlas/lib's env() falls back to raw
// process.env (validation failed in dev), defaults still apply here.
//
// Multi-provider: each capability (llm/embed/vision/stt) can point at a
// different backend, selected via *_PROVIDER env vars. Defaults = Ollama/Whisper
// (self-host). Cloud free tiers (Groq + Cloudflare Workers AI) serve the SAME
// OSS models (Llama/Qwen/Whisper/bge-m3) — no proprietary models.

import { env } from "@atlas/lib";

export type LlmProvider = "ollama" | "groq";
export type EmbedProvider = "ollama" | "cloudflare";
export type VisionProvider = "ollama" | "groq";
export type SttProvider = "whisper" | "groq";

export type AiConfig = {
  enabled: boolean;
  llmProvider: LlmProvider;
  embedProvider: EmbedProvider;
  visionProvider: VisionProvider;
  sttProvider: SttProvider;
  ollama: { baseUrl: string; llmModel: string; vlmModel: string; embedModel: string; timeoutMs: number };
  whisper: { baseUrl: string; model: string; timeoutMs: number };
  groq: { apiKey: string; baseUrl: string; llmModel: string; visionModel: string; sttModel: string; timeoutMs: number };
  cloudflare: { accountId: string; apiToken: string; embedModel: string; timeoutMs: number };
};

function get(key: string, fallback: string): string {
  const v = (env() as any)[key] ?? process.env[key];
  return (typeof v === "string" && v.length > 0) ? v : fallback;
}
function getNum(key: string, fallback: number): number {
  const v = (env() as any)[key] ?? process.env[key];
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function aiConfig(): AiConfig {
  return {
    enabled: get("AI_ENABLED", "true") !== "false",
    llmProvider: get("AI_LLM_PROVIDER", "ollama") as LlmProvider,
    embedProvider: get("AI_EMBED_PROVIDER", "ollama") as EmbedProvider,
    visionProvider: get("AI_VISION_PROVIDER", "ollama") as VisionProvider,
    sttProvider: get("AI_STT_PROVIDER", "whisper") as SttProvider,
    ollama: {
      baseUrl: get("OLLAMA_BASE_URL", "http://localhost:11434").replace(/\/+$/, ""),
      llmModel: get("OLLAMA_LLM_MODEL", "qwen2.5:7b-instruct"),
      vlmModel: get("OLLAMA_VLM_MODEL", "qwen2.5vl:7b"),
      embedModel: get("OLLAMA_EMBED_MODEL", "bge-m3"),
      timeoutMs: getNum("OLLAMA_TIMEOUT_MS", 45_000),
    },
    whisper: {
      baseUrl: get("WHISPER_BASE_URL", "http://localhost:8009").replace(/\/+$/, ""),
      model: get("WHISPER_MODEL", "Systran/faster-whisper-medium"),
      timeoutMs: getNum("WHISPER_TIMEOUT_MS", 60_000),
    },
    groq: {
      apiKey: get("GROQ_API_KEY", ""),
      baseUrl: get("GROQ_BASE_URL", "https://api.groq.com/openai/v1").replace(/\/+$/, ""),
      // OSS models served by Groq free tier:
      llmModel: get("GROQ_LLM_MODEL", "llama-3.3-70b-versatile"),
      visionModel: get("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
      sttModel: get("GROQ_STT_MODEL", "whisper-large-v3-turbo"),
      timeoutMs: getNum("GROQ_TIMEOUT_MS", 45_000),
    },
    cloudflare: {
      accountId: get("CF_ACCOUNT_ID", ""),
      apiToken: get("CF_API_TOKEN", ""),
      embedModel: get("CF_EMBED_MODEL", "@cf/baai/bge-m3"),
      timeoutMs: getNum("CF_TIMEOUT_MS", 30_000),
    },
  };
}
