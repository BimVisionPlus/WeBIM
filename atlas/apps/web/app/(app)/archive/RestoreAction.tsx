"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RestoreAction({ url, payload, label }: { url: string; payload: Record<string, unknown>; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    if (!confirm(`Khôi phục ${label}?`)) return;
    setBusy(true); setErr(null);
    const r = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button onClick={run} disabled={busy} className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" data-testid="restore-action">{busy ? "…" : "↶ Khôi phục"}</button>
      {err && <span className="text-[10px] text-rose-600" title={err}>!</span>}
    </span>
  );
}
