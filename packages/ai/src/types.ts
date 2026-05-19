// Shared types for the AI layer.

export type AiResult<T> =
  | { ok: true; data: T; model: string; latencyMs: number }
  | { ok: false; reason: AiFailReason; error?: string; latencyMs: number };

export type AiFailReason =
  | "disabled"          // AI_ENABLED=false
  | "timeout"           // upstream took longer than configured budget
  | "unreachable"       // could not connect to Ollama/Whisper
  | "model_missing"     // model not pulled (404 from Ollama)
  | "invalid_response"  // upstream returned malformed JSON
  | "rate_limited"      // upstream said 429
  | "server_error";     // anything else (5xx, parse error)

export type AiSuggestionKind =
  | "rfi.classify"
  | "rfi.draft_answer"
  | "ncr.assess_photo"
  | "daily_log.transcribe"
  | "daily_log.summarize"
  | "spec.embed"
  | "spec.search"
  | "siteeye.ppe"
  | "siteeye.weather_advisory"
  | "boq.parse"
  | "cost.overrun_warning"
  | "portfolio.briefing"
  | "agent.plan"
  | "agent.execute";
