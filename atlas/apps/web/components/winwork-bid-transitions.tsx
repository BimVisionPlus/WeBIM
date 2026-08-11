"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type T = { to: string; action: string; ref: string | null };

export function BidTransitionButtons({
  bidId,
  currentState,
  transitions,
}: {
  bidId: string;
  currentState: string;
  transitions: T[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function go(to: string) {
    setBusy(to);
    setErr(null);
    try {
      const r = await fetch(`/api/winwork/bids/${bidId}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(typeof j?.error === "string" ? j.error : "Không chuyển được trạng thái");
      }
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi");
    } finally {
      setBusy(null);
    }
  }

  if (transitions.length === 0) {
    return (
      <div className="rounded-md bg-[rgb(var(--raised))] px-3 py-2 text-xs text-[rgb(var(--muted))]">
        Trạng thái <span className="font-mono">{currentState}</span> là cuối — không có chuyển tiếp.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {transitions.map((t) => (
        <button
          key={t.to}
          onClick={() => go(t.to)}
          disabled={busy !== null}
          title={t.ref ?? undefined}
          className="rounded-md bg-[rgb(var(--surface))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--ink-2))] ring-1 ring-[rgb(var(--line-2))] transition hover:bg-[rgb(var(--raised))] disabled:opacity-50"
        >
          {busy === t.to ? "…" : t.action}
          <span className="ml-1 text-[10px] text-[rgb(var(--muted-2))]">→ {t.to}</span>
        </button>
      ))}
      {err && <span className="text-xs text-rose-700">{err}</span>}
    </div>
  );
}
