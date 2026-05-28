// Vision adapter — Ollama VLM (Qwen2.5-VL) or Groq Llama-Vision (OpenAI format).
// Image bytes sent base64-encoded.

import { chatJson, type ChatMessage } from "./llm";
import { aiConfig } from "./config";
import { postJson } from "./http";
import type { AiResult } from "./types";

export async function describeImage<T>(args: {
  imageBase64: string;          // raw base64 (no data: prefix)
  prompt: string;
  parse: (raw: unknown) => T | null;
  systemPrompt?: string;
}): Promise<AiResult<T>> {
  const cfg = aiConfig();
  if (!cfg.enabled) return { ok: false, reason: "disabled", latencyMs: 0 };

  // ─── Groq vision (OpenAI image_url format) ──────────────────────────────
  if (cfg.visionProvider === "groq") {
    if (!cfg.groq.apiKey) return { ok: false, reason: "disabled", latencyMs: 0, error: "GROQ_API_KEY unset" };
    type OpenAIChatResp = { choices?: Array<{ message?: { content?: string } }> };
    const content: Array<Record<string, unknown>> = [
      { type: "text", text: args.prompt },
      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${args.imageBase64}` } },
    ];
    const messages = [
      ...(args.systemPrompt ? [{ role: "system", content: args.systemPrompt }] : []),
      { role: "user", content },
    ];
    const started = Date.now();
    const r = await postJson<OpenAIChatResp>(
      `${cfg.groq.baseUrl}/chat/completions`,
      { model: cfg.groq.visionModel, messages, stream: false, temperature: 0.2, response_format: { type: "json_object" } },
      { timeoutMs: cfg.groq.timeoutMs, headers: { Authorization: `Bearer ${cfg.groq.apiKey}` } },
    );
    const latencyMs = Date.now() - started;
    if (!r.ok) return { ok: false, reason: r.reason, error: r.error, latencyMs };
    const raw = r.data.choices?.[0]?.message?.content?.trim();
    if (!raw) return { ok: false, reason: "invalid_response", latencyMs, error: "empty content" };
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { ok: false, reason: "invalid_response", latencyMs, error: "JSON parse failed" }; }
    const out = args.parse(parsed);
    if (out == null) return { ok: false, reason: "invalid_response", latencyMs, error: "schema mismatch" };
    return { ok: true, data: out, model: cfg.groq.visionModel, latencyMs };
  }

  // ─── Ollama VLM (default, self-host) ────────────────────────────────────
  const messages: ChatMessage[] = [
    ...(args.systemPrompt ? [{ role: "system" as const, content: args.systemPrompt }] : []),
    { role: "user", content: args.prompt, images: [args.imageBase64] },
  ];
  return chatJson(messages, args.parse, { model: cfg.ollama.vlmModel });
}
