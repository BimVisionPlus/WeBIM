"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Generic delete button used across CRUD lists.
 *   <DeleteAction url={`/api/internaldocs/${id}`} label="Văn bản" />
 * Confirms via dialog, calls DELETE, refreshes router on success.
 */
export function DeleteAction({ url, label = "mục này", testId, soft }: { url: string; label?: string; testId?: string; soft?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!confirm(`${soft ? "Vô hiệu hoá" : "Xoá"} ${label}? Không thể hoàn tác qua UI.`)) return;
    setBusy(true); setErr(null);
    const res = await fetch(url, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button onClick={run} disabled={busy} className="text-xs text-rose-600 hover:text-rose-800 disabled:opacity-50" data-testid={testId ?? "row-delete"} title={soft ? "Vô hiệu hoá" : "Xoá"}>
        {busy ? "…" : (soft ? "Vô hiệu" : "Xoá")}
      </button>
      {err && <span className="text-[10px] text-rose-600" title={err}>!</span>}
    </span>
  );
}
