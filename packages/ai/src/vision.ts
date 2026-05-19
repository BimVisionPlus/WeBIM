// Vision adapter — runs against Ollama VLM (Qwen2.5-VL or Llama3.2-Vision).
// Image bytes are sent base64-encoded as inline content.

import { chatJson, type ChatMessage } from "./llm";
import { aiConfig } from "./config";
import type { AiResult } from "./types";

export async function describeImage<T>(args: {
  imageBase64: string;          // raw base64 (no data: prefix)
  prompt: string;
  parse: (raw: unknown) => T | null;
  systemPrompt?: string;
}): Promise<AiResult<T>> {
  const cfg = aiConfig();
  const messages: ChatMessage[] = [
    ...(args.systemPrompt ? [{ role: "system" as const, content: args.systemPrompt }] : []),
    { role: "user", content: args.prompt, images: [args.imageBase64] },
  ];
  return chatJson(messages, args.parse, { model: cfg.ollama.vlmModel });
}
