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
      className="rounded-md border border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs font-medium text-[rgb(var(--ink-2))] hover:bg-[rgb(var(--raised))] disabled:opacity-50"
    >
      {busy ? "Đang kiểm…" : "↻ Chạy kiểm tra"}
    </button>
  );
}
