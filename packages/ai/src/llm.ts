// Ollama LLM adapter — chat + JSON-mode generate.
// All callers receive AiResult<T>; never throws.

import { aiConfig } from "./config";
import { postJson } from "./http";
import type { AiResult } from "./types";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  // Base64 image data (no data: prefix). Used by vision models (Qwen2.5-VL).
  images?: string[];
};

type OllamaChatResp = {
  model: string;
  message?: { role: string; content: string };
  done: boolean;
  // present when streaming or with eval stats
  prompt_eval_count?: number;
  eval_count?: number;
};

export async function chat(
  messages: ChatMessage[],
  opts: {
    model?: string;            // override default LLM
    format?: "json";           // ask Ollama for JSON-only output
    temperature?: number;
    timeoutMs?: number;
  } = {},
): Promise<AiResult<string>> {
  const cfg = aiConfig();
  if (!cfg.enabled) return { ok: false, reason: "disabled", latencyMs: 0 };

  const model = opts.model ?? cfg.ollama.llmModel;
  const started = Date.now();
  const r = await postJson<OllamaChatResp>(
    `${cfg.ollama.baseUrl}/api/chat`,
    {
      model,
      messages,
      stream: false,
      ...(opts.format === "json" ? { format: "json" } : {}),
      options: {
        temperature: opts.temperature ?? 0.2,
      },
    },
    { timeoutMs: opts.timeoutMs ?? cfg.ollama.timeoutMs },
  );
  const latencyMs = Date.now() - started;
  if (!r.ok) return { ok: false, reason: r.reason, error: r.error, latencyMs };
  const content = r.data.message?.content?.trim();
  if (!content) return { ok: false, reason: "invalid_response", latencyMs, error: "empty content" };
  return { ok: true, data: content, model, latencyMs };
}

/**
 * Chat where the model is asked to return strict JSON. Parses + validates
 * downstream-callable; returns invalid_response on parse failure.
 */
export async function chatJson<T>(
  messages: ChatMessage[],
  parse: (raw: unknown) => T | null,
  opts: { model?: string; temperature?: number; timeoutMs?: number } = {},
): Promise<AiResult<T>> {
  const r = await chat(messages, { ...opts, format: "json" });
  if (!r.ok) return r;
  let parsed: unknown;
  try {
    parsed = JSON.parse(r.data);
  } catch {
    return { ok: false, reason: "invalid_response", latencyMs: r.latencyMs, error: "JSON parse failed" };
  }
  const out = parse(parsed);
  if (out == null) return { ok: false, reason: "invalid_response", latencyMs: r.latencyMs, error: "schema mismatch" };
  return { ok: true, data: out, model: r.model, latencyMs: r.latencyMs };
}
