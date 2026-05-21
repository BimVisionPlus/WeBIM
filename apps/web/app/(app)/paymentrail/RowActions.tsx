"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NEXT_ACTIONS: Record<string, { action: string; label: string; tone: "primary" | "neutral" | "danger" }[]> = {
  DRAFT: [
    { action: "NT_SIGN", label: "NT ký", tone: "primary" },
    { action: "REJECT", label: "Hủy", tone: "danger" },
  ],
  NT_SIGNED: [
    { action: "TVGS_SIGN", label: "TVGS ký", tone: "primary" },
    { action: "REJECT", label: "Từ chối", tone: "danger" },
  ],
  TVGS_SIGNED: [
    { action: "CDT_APPROVE", label: "CĐT duyệt", tone: "primary" },
    { action: "REJECT", label: "Từ chối", tone: "danger" },
  ],
  CDT_APPROVED: [
    { action: "KBNN_SUBMIT", label: "Gửi KBNN", tone: "primary" },
    { action: "MARK_PAID", label: "Đã thu (vốn DN)", tone: "neutral" },
  ],
  KBNN_SUBMITTED: [
    { action: "MARK_PAID", label: "KBNN đã chi", tone: "primary" },
  ],
  PAID: [],
  REJECTED: [],
};

export function RowActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const actions = NEXT_ACTIONS[state] ?? [];
  if (actions.length === 0) return <span className="text-[10px] text-slate-400">—</span>;

  async function go(action: string) {
    setBusy(action);
    setErr(null);
    const body: Record<string, unknown> = { action };
    if (action === "REJECT") {
      const note = window.prompt("Lý do từ chối / hủy:");
      if (!note) { setBusy(null); return; }
      body.rejectionNote = note;
    }
    if (action === "KBNN_SUBMIT") {
      const tx = window.prompt("Mã giao dịch KBNN (optional):") ?? undefined;
      if (tx) body.kbnnTxId = tx;
    }
    const res = await fetch(`/api/paymentrail/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Lỗi chuyển trạng thái");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button
          key={a.action}
          onClick={() => go(a.action)}
          disabled={busy === a.action}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${
            a.tone === "danger" ? "bg-rose-100 text-rose-800 hover:bg-rose-200" :
            a.tone === "primary" ? "bg-blue-600 text-white hover:bg-blue-700" :
            "bg-slate-100 text-slate-800 hover:bg-slate-200"
          } disabled:opacity-50`}
          data-testid={`action-${a.action}`}
        >
          {busy === a.action ? "…" : a.label}
        </button>
      ))}
      {err && <span className="text-[10px] text-rose-700">{err}</span>}
    </div>
  );
}
