/**
 * Slim banner shown when the AI stack is reachable-but-degraded or offline.
 *
 * - Polls /api/health every 60s
 * - Hides itself when soft.ollama.ok is true
 * - Survives across pages (rendered in the project layout)
 */

"use client";

import { useEffect, useState } from "react";

/**
 * `partial` — the LLM/VLM answers but speech-to-text does not, or the other
 * way round. Calling that "AI đang ngoại tuyến" sends someone to debug a
 * stack that is mostly working, and hides the one thing that is not. A
 * deployment with no Whisper is a normal deployment, not a broken one.
 */
type State = "ok" | "partial" | "degraded" | "checking";

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
        } else if (ollamaOk) {
          setState("partial");
          setDetail("Whisper (STT)");
        } else {
          setState("degraded");
          setDetail(whisperOk ? "Ollama (LLM/VLM)" : "Ollama (LLM/VLM) + Whisper (STT)");
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

  if (state === "ok" || state === "checking") return null;

  if (state === "partial") {
    return (
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-2 text-xs text-slate-700">
        <strong>Chưa có nhập liệu bằng giọng nói</strong> — {detail} không cấu hình.
        Các tính năng AI khác (RFI gợi ý, NCR vision, soát hồ sơ) vẫn dùng được.
        Xem: <a href="/settings/ai" className="underline">/settings/ai</a>.
      </div>
    );
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
      <strong>AI đang ngoại tuyến</strong> — {detail || "Ollama/Whisper không kết nối được"}.
      Các tính năng AI (RFI gợi ý, NCR vision, voice-to-form) tạm ẩn. Đang khôi phục.
      Kiểm tra: <a href="/settings/ai" className="underline">/settings/ai</a>.
    </div>
  );
}
