// Resolve AI settings from env. Re-evaluated lazily so tests can mutate env.
// Reads process.env defensively — when @atlas/lib's env() falls back to raw
// process.env (validation failed in dev), defaults still apply here.

import { env } from "@atlas/lib";

export type AiConfig = {
  enabled: boolean;
  ollama: { baseUrl: string; llmModel: string; vlmModel: string; embedModel: string; timeoutMs: number };
  whisper: { baseUrl: string; model: string; timeoutMs: number };
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
  };
}
