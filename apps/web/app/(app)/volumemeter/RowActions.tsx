"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS: Record<string, { action: string; label: string; tone: "primary" | "danger" }[]> = {
  DRAFT: [{ action: "NT_SUBMIT", label: "NT nộp", tone: "primary" }, { action: "REJECT", label: "Hủy", tone: "danger" }],
  NT_SUBMITTED: [{ action: "TVGS_VERIFY", label: "TVGS xác nhận", tone: "primary" }, { action: "REJECT", label: "Trả về", tone: "danger" }],
  TVGS_VERIFIED: [{ action: "CDT_APPROVE", label: "CĐT duyệt", tone: "primary" }, { action: "REJECT", label: "Trả về", tone: "danger" }],
  CDT_APPROVED: [], REJECTED: [],
};

export function RowActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const actions = ACTIONS[state] ?? [];
  if (actions.length === 0) return <span className="text-[10px] text-[rgb(var(--muted-2))]">—</span>;

  async function go(action: string) {
    setBusy(action); setErr(null);
    const body: Record<string, unknown> = { action };
    if (action === "REJECT") { const n = window.prompt("Lý do trả về:"); if (!n) { setBusy(null); return; } body.rejectionNote = n; }
    const res = await fetch(`/api/volumemeter/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button key={a.action} onClick={() => go(a.action)} disabled={busy === a.action}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${a.tone === "danger" ? "bg-rose-100 text-rose-800" : "bg-blue-600 text-[rgb(var(--inverse-ink))]"} disabled:opacity-50`}
          data-testid={`action-${a.action}`}>{busy === a.action ? "…" : a.label}</button>
      ))}
      {err && <span className="text-[10px] text-rose-700">{err}</span>}
    </div>
  );
}
