"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = { kind: string; id: string; title: string; subtitle?: string | null; href: string; score: number; icon: string };

const KIND_LABEL: Record<string, string> = {
  project: "Dự án", issue: "Issue", internaldoc: "Văn bản nội bộ", agencydoc: "Công văn QLNN",
  lead: "Cơ hội PTTT", advance: "Tạm ứng/TT/Hoàn ứng", scheduletask: "Công việc lịch", statusupdate: "Tình hình",
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [aiReranked, setAiReranked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Cmd+K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      setSel(0);
    } else {
      setQ(""); setHits([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setHits([]); setBusy(false); return; }
    setBusy(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const useAi = q.split(/\s+/).filter(Boolean).length >= 2 ? "&ai=1" : "";
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}${useAi}`);
        if (!res.ok) { setHits([]); return; }
        const j = await res.json();
        setHits(j.hits ?? []); setSel(0); setAiReranked(!!j.aiReranked);
      } finally { setBusy(false); }
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, open]);

  function go(h: Hit) {
    setOpen(false);
    router.push(h.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && hits[sel]) { e.preventDefault(); go(hits[sel]); }
  }

  if (!open) return (
    // floating hint button bottom-right for discoverability
    <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-40 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow hover:bg-slate-50" title="Cmd/Ctrl+K — tìm xuyên module" data-testid="open-command-palette">
      🔍 ⌘K
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-slate-900/40 p-4 pt-[12vh]" onClick={() => setOpen(false)} data-testid="command-palette">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-lg bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4">
          <span className="text-slate-400">🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Tìm dự án, issue, văn bản, lead, tạm ứng… (tối thiểu 2 ký tự)"
            className="flex-1 border-0 bg-transparent py-3 text-sm focus:outline-none"
            data-testid="command-input"
          />
          {busy && <span className="text-[10px] text-slate-400">Đang tìm…</span>}
          {!busy && aiReranked && hits.length > 0 && <span className="text-[10px] font-medium text-violet-600" title="bge-m3 rerank">AI</span>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1">
          {q.trim().length < 2 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              Gõ ít nhất 2 ký tự để tìm xuyên module.<br />
              <span className="mt-2 inline-block">⌘K mở · ↑↓ chọn · Enter mở · Esc đóng</span>
            </div>
          ) : hits.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">{busy ? "…" : "Không tìm thấy."}</div>
          ) : (
            hits.map((h, i) => (
              <button
                key={`${h.kind}-${h.id}`}
                onClick={() => go(h)}
                onMouseEnter={() => setSel(i)}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm ${i === sel ? "bg-blue-50 text-blue-900" : "hover:bg-slate-50"}`}
                data-testid={`palette-hit-${i}`}
              >
                <span className="text-base">{h.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{h.title}</span>
                  {h.subtitle && <span className="block truncate text-[11px] text-slate-500">{h.subtitle}</span>}
                </span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{KIND_LABEL[h.kind] ?? h.kind}</span>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-[10px] text-slate-500">
          <span>↑↓ chọn · Enter mở · Esc đóng</span>
          <span>AI rerank bge-m3 khi ≥ 2 từ</span>
        </div>
      </div>
    </div>
  );
}
