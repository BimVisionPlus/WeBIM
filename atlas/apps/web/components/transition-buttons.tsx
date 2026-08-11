"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

type Move = { from: string; to: string; action: string; allowedRoles: string[]; ref?: string };

export function TransitionButtons({ issueKey, moves }: { issueKey: string; moves: Move[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(to: string) {
    setBusy(to);
    setErr(null);
    const r = await fetch("/api/issues/transition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueKey, toState: to }),
    });
    setBusy(null);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không chuyển được trạng thái");
      return;
    }
    router.refresh();
  }

  if (moves.length === 0) {
    return <div className="text-xs text-[rgb(var(--muted-2))]">Không có chuyển trạng thái nào khả dụng.</div>;
  }

  return (
    <div className="space-y-2">
      {moves.map((m) => (
        <Button
          key={`${m.from}-${m.to}`}
          variant="outline"
          size="sm"
          className="w-full justify-between"
          disabled={busy !== null}
          onClick={() => run(m.to)}
        >
          <span>{busy === m.to ? "Đang xử lý…" : m.action}</span>
          <span className="text-[10px] text-[rgb(var(--muted))]">→ {m.to}</span>
        </Button>
      ))}
      {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
    </div>
  );
}
