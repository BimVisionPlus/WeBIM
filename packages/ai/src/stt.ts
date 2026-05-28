// Whisper speech-to-text adapter.
// faster-whisper-server exposes an OpenAI-API-compatible /v1/audio/transcriptions.

import { aiConfig } from "./config";
import { postForm } from "./http";
import type { AiResult } from "./types";

type WhisperResp = { text: string };

export async function transcribe(args: {
  audio: Blob | Uint8Array;   // .webm, .mp3, .wav, .m4a all accepted
  filename?: string;
  language?: string;           // ISO-639-1, default "vi"
}): Promise<AiResult<string>> {
  const cfg = aiConfig();
  if (!cfg.enabled) return { ok: false, reason: "disabled", latencyMs: 0 };

  // Both faster-whisper-server and Groq expose OpenAI /audio/transcriptions.
  const useGroq = cfg.sttProvider === "groq";
  if (useGroq && !cfg.groq.apiKey) return { ok: false, reason: "disabled", latencyMs: 0, error: "GROQ_API_KEY unset" };
  const url = useGroq
    ? `${cfg.groq.baseUrl}/audio/transcriptions`
    : `${cfg.whisper.baseUrl}/v1/audio/transcriptions`;
  const model = useGroq ? cfg.groq.sttModel : cfg.whisper.model;
  const timeoutMs = useGroq ? cfg.groq.timeoutMs : cfg.whisper.timeoutMs;

  const form = new FormData();
  const blob = args.audio instanceof Blob
    ? args.audio
    : new Blob([new Uint8Array(args.audio).buffer as ArrayBuffer], { type: "audio/webm" });
  form.append("file", blob, args.filename ?? "audio.webm");
  form.append("model", model);
  form.append("language", args.language ?? "vi");
  form.append("response_format", "json");

  const started = Date.now();
  const r = await postForm<WhisperResp>(url, form, {
    timeoutMs,
    headers: useGroq ? { Authorization: `Bearer ${cfg.groq.apiKey}` } : undefined,
  });
  const latencyMs = Date.now() - started;
  if (!r.ok) return { ok: false, reason: r.reason, error: r.error, latencyMs };
  const text = r.data?.text?.trim();
  if (!text) return { ok: false, reason: "invalid_response", latencyMs };
  return { ok: true, data: text, model, latencyMs };
}
