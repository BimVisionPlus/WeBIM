"use client";
import { useState } from "react";

export function DigestButton({ dept, label }: { dept: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true); setSummary(null); setFallback(null); setOpen(true);
    const res = await fetch(`/api/digest?dept=${encodeURIComponent(dept)}`);
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (j.ok) { setSummary(j.summary); setModel(j.model ?? null); }
    else { setFallback(j.fallback ?? "Không có dữ liệu."); }
  }

  return (
    <>
      <button onClick={run} disabled={busy} className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50" data-testid={`digest-${dept}`}>
        {busy ? "AI đang tóm tắt…" : `✨ AI tóm tắt tuần — ${label}`}
      </button>
      {open && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[rgb(var(--inverse-bg))]/40 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-lg bg-[rgb(var(--surface))] p-5 shadow-2xl" data-testid="digest-modal">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Tóm tắt tuần — {label}</h3>
              <button onClick={() => setOpen(false)} className="text-sm text-[rgb(var(--muted))]">Đóng</button>
            </div>
            {busy && <div className="py-6 text-center text-sm text-[rgb(var(--muted))]">⏳ Groq Llama-3.3-70b đang xử lý…</div>}
            {!busy && summary && (
              <>
                <div className="whitespace-pre-line rounded border border-violet-200 bg-violet-50/40 p-3 text-sm text-[rgb(var(--ink-2))]" data-testid="digest-summary">{summary}</div>
                {model && <div className="mt-2 text-[10px] text-[rgb(var(--muted))]">Mô hình: {model}</div>}
              </>
            )}
            {!busy && fallback && (
              <div className="whitespace-pre-line rounded border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-3 text-sm text-[rgb(var(--ink-2))]" data-testid="digest-fallback">{fallback}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
