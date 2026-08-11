"use client";

// AI assistant panel on the RFI detail page.
// - Fetches existing AI suggestions on mount.
// - Lets reviewer (TVTK / CDT) regenerate.
// - "Áp dụng" copies the draft into the answer form below and marks the
//   suggestion accepted (telemetry).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@atlas/ui";

type Classify = {
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  costRiskVnd: number | null;
  scheduleRiskDays: number | null;
  model?: string;
  latencyMs?: number;
  error?: string;
};

type Draft = {
  draftAnswer: string;
  references: string[];
  confidence: "low" | "medium" | "high";
  caveats: string | null;
  model?: string;
  latencyMs?: number;
  error?: string;
};

type SavedSuggestions = {
  classify: (Classify & { id: string; accepted: boolean }) | null;
  draft: (Draft & { id: string; accepted: boolean }) | null;
};

export function AiRfiPanel({
  issueId,
  saved,
  answered,
}: {
  issueId: string;
  saved: SavedSuggestions;
  answered: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [classify, setClassify] = useState<Classify | null>(saved.classify);
  const [draft, setDraft] = useState<Draft | null>(saved.draft);
  const [classifyId, setClassifyId] = useState<string | null>(saved.classify?.id ?? null);
  const [draftId, setDraftId] = useState<string | null>(saved.draft?.id ?? null);

  async function regen() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/ai/rfi/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(typeof j.error === "string" ? j.error : "AI không phản hồi");
        return;
      }
      setClassify(j.classify);
      setDraft(j.draft);
    } catch (e: any) {
      setErr(e.message ?? "Lỗi mạng");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const ta = document.querySelector<HTMLTextAreaElement>("textarea[name=rfi-answer]");
    if (ta && draft?.draftAnswer) {
      // Use native setter so React's controlled-input state updates correctly.
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(ta, draft.draftAnswer);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      ta.focus();
    }
    if (draftId) {
      await fetch("/api/ai/suggestion/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId }),
      });
      router.refresh();
    }
  }

  const nothing = !classify && !draft && !busy;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--inverse-ink))]">AI</span>
          <span className="text-sm font-semibold text-[rgb(var(--ink-2))]">Gợi ý từ mô hình OSS</span>
        </div>
        <Button size="sm" variant="ghost" onClick={regen} disabled={busy}>
          {busy ? "Đang chạy…" : nothing ? "Chạy gợi ý" : "Chạy lại"}
        </Button>
      </div>

      {err && <div className="mt-2 rounded bg-rose-50 px-2 py-1 text-xs text-rose-700">{err}</div>}

      {nothing && !err && (
        <p className="mt-2 text-xs text-[rgb(var(--muted))]">
          Chưa có gợi ý. Nhấn "Chạy gợi ý" để mô hình phân loại RFI và soạn nháp câu trả lời.
        </p>
      )}

      {classify && (
        <div className="mt-3 space-y-1 border-t border-violet-200 pt-3 text-sm">
          {classify.error ? (
            <Failure label="Phân loại" reason={classify.error} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[rgb(var(--muted))]">Phân loại:</span>
                <Badge variant="default">{classify.category}</Badge>
                <Badge variant={priorityVariant(classify.priority)}>{classify.priority}</Badge>
                {classify.scheduleRiskDays != null && (
                  <Badge variant="warning">~{classify.scheduleRiskDays} ngày trễ</Badge>
                )}
                {classify.costRiskVnd != null && (
                  <Badge variant="warning">~{vnd(classify.costRiskVnd)}</Badge>
                )}
              </div>
              <p className="text-xs text-[rgb(var(--muted))]">{classify.reason}</p>
            </>
          )}
        </div>
      )}

      {draft && (
        <div className="mt-3 space-y-2 border-t border-violet-200 pt-3 text-sm">
          {draft.error ? (
            <Failure label="Nháp trả lời" reason={draft.error} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[rgb(var(--muted))]">
                  <span>Nháp trả lời</span>
                  <Badge variant="default">độ tin {draft.confidence}</Badge>
                </div>
                {!answered && (
                  <Button size="sm" onClick={apply} disabled={!draft.draftAnswer}>
                    Áp dụng vào câu trả lời
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap rounded bg-[rgb(var(--surface))]/70 px-3 py-2 text-sm text-[rgb(var(--ink-2))]">
                {draft.draftAnswer}
              </p>
              {draft.references?.length > 0 && (
                <div className="text-xs text-[rgb(var(--muted))]">
                  Tham chiếu: {draft.references.join(" · ")}
                </div>
              )}
              {draft.caveats && (
                <div className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  ⚠ {draft.caveats}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-violet-200 pt-2 text-[10px] text-[rgb(var(--muted))]">
        Engineer-in-loop: TVTK/CĐT quyết định cuối cùng. Mô hình: {modelLabel(classify, draft)}.
      </div>
    </div>
  );
}

function Failure({ label, reason }: { label: string; reason: string }) {
  return (
    <div className="text-xs text-[rgb(var(--muted))]">
      {label}: <span className="text-rose-600">không khả dụng ({reason})</span> —
      kiểm tra Cài đặt → AI để xem trạng thái Ollama.
    </div>
  );
}

function priorityVariant(p: string) {
  if (p === "CRITICAL") return "danger" as const;
  if (p === "HIGH") return "warning" as const;
  return "default" as const;
}

function vnd(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)} tr`;
  return n.toLocaleString("vi-VN");
}

function modelLabel(c: Classify | null, d: Draft | null) {
  return c?.model ?? d?.model ?? "—";
}
