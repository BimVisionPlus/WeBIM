"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ClashDetectButton({ projectId, disabled }: { projectId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; totalHits: number } | null>(null);

  async function go() {
    setBusy(true);
    try {
      const r = await fetch(`/api/drawbridge/clashes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (r.ok) {
        setResult(await r.json());
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {result && (
        <span className="text-xs text-[rgb(var(--muted))]">
          Tìm thấy {result.totalHits} clash · tạo mới {result.created}
        </span>
      )}
      <button
        type="button"
        onClick={go}
        disabled={busy || disabled}
        className="rounded-md border border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--ink-2))] hover:bg-[rgb(var(--raised))] disabled:opacity-50"
      >
        {busy ? "Đang chạy…" : "↻ Chạy clash"}
      </button>
    </div>
  );
}
