/**
 * Slim banner shown when the AI stack is reachable-but-degraded or offline.
 *
 * - Polls /api/health every 60s
 * - Hides itself when soft.ollama.ok is true
 * - Survives across pages (rendered in the project layout)
 */

"use client";

import { useEffect, useState } from "react";

type State = "ok" | "degraded" | "checking";

export function AiOfflineBanner() {
  const [state, setState] = useState<State>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        const ollamaOk = !!j.soft?.ollama?.ok;
        const whisperOk = !!j.soft?.whisper?.ok;
        if (ollamaOk && whisperOk) {
          setState("ok");
        } else {
          setState("degraded");
          const parts: string[] = [];
          if (!ollamaOk) parts.push("Ollama (LLM/VLM)");
          if (!whisperOk) parts.push("Whisper (STT)");
          setDetail(parts.join(" + "));
        }
      } catch {
        if (!cancelled) setState("degraded");
      }
    }
    poll();
    const t = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (state !== "degraded") return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
      <strong>AI đang ngoại tuyến</strong> — {detail || "Ollama/Whisper không kết nối được"}.
      Các tính năng AI (RFI gợi ý, NCR vision, voice-to-form) tạm ẩn. Đang khôi phục.
      Kiểm tra: <a href="/settings/ai" className="underline">/settings/ai</a>.
    </div>
  );
}
