"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BidComplianceRunner({ bidId }: { bidId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await fetch(`/api/winwork/bids/${bidId}/compliance`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {busy ? "Đang kiểm…" : "↻ Chạy kiểm tra"}
    </button>
  );
}
