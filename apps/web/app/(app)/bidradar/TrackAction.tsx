"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TrackAction({ opportunityId, orgId }: { opportunityId: string; orgId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/bidradar/track", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunityId, orgId }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setDone(true);
    router.refresh();
  }

  if (done) return <span className="text-[10px] text-emerald-700">✓ Đã thêm</span>;
  return (
    <button onClick={run} disabled={busy} className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50" data-testid={`track-${opportunityId}`} title="Thêm vào pipeline PTTT">
      {busy ? "…" : "+ Theo dõi"}
    </button>
  );
}
