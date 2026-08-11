"use client";

import { useState } from "react";

export function ShareButton({ sheetId }: { sheetId: string }) {
  const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function create() {
    setBusy(true); setError("");
    const response = await fetch("/api/canvas/shares", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sheetId, role: "COMMENT", label: "Gửi duyệt bản vẽ" }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) { setError(data.error ?? "Không thể tạo liên kết"); return; }
    const absolute = new URL(data.url, window.location.origin).toString(); setUrl(absolute); await navigator.clipboard?.writeText(absolute).catch(() => undefined);
  }
  return <div className="flex items-center gap-2"><button onClick={create} disabled={busy} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-500 disabled:opacity-50">{busy ? "Đang tạo…" : "Chia sẻ để duyệt"}</button>{url && <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="w-80 rounded-lg border border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] px-3 py-2 text-xs" />}{url && <span className="text-xs text-emerald-600">Đã sao chép</span>}{error && <span className="text-xs text-red-600">{error}</span>}</div>;
}
