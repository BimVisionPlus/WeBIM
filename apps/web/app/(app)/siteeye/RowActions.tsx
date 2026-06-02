"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";

export function RowActions({ id, severity, closedAt }: { id: string; severity: string; closedAt: Date | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isClosed = !!closedAt;
  async function toggleClose() {
    setBusy(true);
    const r = await fetch(`/api/siteeye/incidents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ closedAt: isClosed ? null : new Date().toISOString() }) });
    setBusy(false);
    if (r.ok) router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2" data-testid={`row-actions-${id}`}>
      <button onClick={toggleClose} disabled={busy} className={`text-[10px] ${isClosed ? "text-amber-700" : "text-emerald-700"} hover:underline disabled:opacity-50`}>{busy ? "…" : (isClosed ? "Mở lại" : "Đóng")}</button>
      <DeleteAction url={`/api/siteeye/incidents/${id}`} label="sự cố" testId={`delete-${id}`} />
    </span>
  );
}
