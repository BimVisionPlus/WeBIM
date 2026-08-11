"use client";

import { useState } from "react";

type Result = { label: string; body: string; latencyMs: number; source?: string; success: boolean };

export function DemoAiPanel({
  projectId,
  projectKey,
  taskId,
  taskLabel,
  submittalId,
  submittalLabel,
}: {
  projectId: string;
  projectKey: string;
  taskId: string | null;
  taskLabel: string | null;
  submittalId: string | null;
  submittalLabel: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);

  async function run(label: string, fn: () => Promise<any>) {
    setBusy(label);
    const t0 = Date.now();
    try {
      const data = await fn();
      const latencyMs = Date.now() - t0;
      const body = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      setResults((s) => [{ label, body, latencyMs, source: data?.source, success: !!(data?.ok ?? true) }, ...s].slice(0, 5));
    } catch (e: any) {
      setResults((s) => [{ label, body: `Lỗi: ${e?.message ?? e}`, latencyMs: Date.now() - t0, success: false }, ...s].slice(0, 5));
    } finally {
      setBusy(null);
    }
  }

  function pretty(data: any): string {
    if (!data) return "";
    if (data.summary) return data.summary;
    if (data.drafts?.[0]?.body) return data.drafts[0].body;
    if (data.results) {
      return data.results
        .map((r: any) => `${r.taskCode}: ${r.riskPct}% — ${r.explanation ?? ""}`)
        .join("\n\n");
    }
    if (data.findings) {
      const head = `compliance: ${data.compliance ?? "?"} (${data.source ?? "?"})\nsuggestion: ${data.suggestion ?? ""}\n\n`;
      const body = (data.findings ?? []).map((f: any) => `[${f.verdict}] ${f.requirement} — nhà thầu: ${f.submittedValue} | ${f.note}`).join("\n");
      return head + body;
    }
    return JSON.stringify(data, null, 2);
  }

  async function call(label: string, url: string, body: any | null) {
    return run(label, async () => {
      const init: RequestInit = body
        ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        : { method: "GET" };
      const r = await fetch(url, init);
      const data = await r.json().catch(() => ({}));
      const pretty_text = pretty(data);
      return { ...data, _pretty: pretty_text };
    });
  }

  const buttons: Array<{ label: string; emoji: string; disabled?: boolean; onClick: () => void }> = [
    {
      label: "Tóm tắt Hành chính tuần",
      emoji: "📊",
      onClick: () => call("Weekly digest — phòng Hành chính", "/api/digest?dept=HANH_CHINH", null),
    },
    {
      label: "Tóm tắt Tài chính tuần",
      emoji: "💹",
      onClick: () => call("Weekly digest — phòng TC-KT", "/api/digest?dept=TAI_CHINH_KE_TOAN", null),
    },
    {
      label: "Phân loại văn bản",
      emoji: "🤖",
      onClick: () => call("Classify-doc — Quyết định bổ nhiệm…", "/api/ai/classify-doc", { title: "Quyết định bổ nhiệm Chỉ huy phó công trường Nguyễn Văn A" }),
    },
    {
      label: taskLabel ? `Schedule risk: ${taskLabel.slice(0, 30)}…` : "Schedule risk",
      emoji: "⚠️",
      disabled: !taskId,
      onClick: () => taskId && call(`Risk task ${taskLabel}`, "/api/ai/schedule/risk", { taskId }),
    },
    {
      label: "Schedule risk toàn dự án",
      emoji: "📉",
      onClick: () => call("Risk toàn dự án", "/api/ai/schedule/risk", { projectId }),
    },
    {
      label: "Soạn hồ sơ hoàn công — Mục 13 (Kết luận)",
      emoji: "📑",
      onClick: () => call("Hoàn công — Mục VIIIb.13", "/api/ai/hoancong/draft", { projectId, seq: 13 }),
    },
    {
      label: "Soạn hồ sơ hoàn công — Mục 7 (Khối lượng)",
      emoji: "📋",
      onClick: () => call("Hoàn công — Mục VIIIb.7", "/api/ai/hoancong/draft", { projectId, seq: 7 }),
    },
    {
      label: submittalLabel ? `Kiểm tra submittal: ${submittalLabel.slice(0, 30)}…` : "Submittal check",
      emoji: "📐",
      disabled: !submittalId,
      onClick: () => submittalId && call(`Submittal check — ${submittalLabel}`, "/api/ai/submittal/check", { submittalId }),
    },
    {
      label: "Tóm tắt status dự án",
      emoji: "🧾",
      onClick: () => call("Summarize status", "/api/ai/summarize-status", { projectId }),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {buttons.map((b) => (
          <button
            key={b.label}
            onClick={b.onClick}
            disabled={busy === b.label || b.disabled}
            className="group flex items-center justify-between gap-2 rounded-md border border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] px-3 py-2 text-left text-xs font-medium text-[rgb(var(--ink-2))] hover:border-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{b.emoji}</span>
              <span>{b.label}</span>
            </span>
            <span className="text-blue-500 group-hover:text-blue-700">
              {busy === b.label ? "…" : "▶"}
            </span>
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3">
          <div className="mb-2 text-xs font-semibold text-[rgb(var(--muted))]">Kết quả gần nhất (5 lần gọi):</div>
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="border-l-2 border-emerald-400 bg-emerald-50/40 px-3 py-2">
                <div className="text-[11px] font-semibold text-[rgb(var(--muted))]">
                  {r.label} <span className="text-emerald-700">· {r.latencyMs}ms</span>
                  {r.source && <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] text-emerald-800">{r.source}</span>}
                </div>
                <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-[rgb(var(--ink-2))]">
                  {r.body.slice(0, 4000)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
