"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS: Record<string, { action: string; label: string; tone: "primary" | "neutral" | "danger" }[]> = {
  ACTIVE: [
    { action: "RELEASE", label: "Giải phóng", tone: "primary" },
    { action: "CALL", label: "Yêu cầu bồi thường", tone: "danger" },
    { action: "SYNC_BANK", label: "Sync NH", tone: "neutral" },
    { action: "MARK_EXPIRED", label: "Đánh dấu hết hạn", tone: "neutral" },
  ],
  RELEASED: [], EXPIRED: [], CALLED: [],
};

export function RowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const actions = ACTIONS[status] ?? [];
  if (actions.length === 0) return <span className="text-[10px] text-slate-400">—</span>;

  async function go(action: string) {
    setBusy(action); setErr(null);
    const body: Record<string, unknown> = { action };
    if (action === "CALL") { const amt = window.prompt("Số tiền yêu cầu bồi thường (VND, tối đa = giá trị BL):"); if (!amt || !/^\d+$/.test(amt)) { setBusy(null); return; } body.claimedAmountVnd = amt; const n = window.prompt("Ghi chú lý do (optional):"); if (n) body.note = n; }
    if (action === "RELEASE") { const n = window.prompt("Ghi chú giải phóng (optional):"); if (n) body.note = n; }
    const res = await fetch(`/api/bondvault/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button key={a.action} onClick={() => go(a.action)} disabled={busy === a.action}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${a.tone === "danger" ? "bg-rose-100 text-rose-800" : a.tone === "primary" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-800"} disabled:opacity-50`}
          data-testid={`action-${a.action}`}>{busy === a.action ? "…" : a.label}</button>
      ))}
      {err && <span className="text-[10px] text-rose-700">{err}</span>}
    </div>
  );
}
