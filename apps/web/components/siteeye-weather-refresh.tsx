"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * For the demo we hard-code lat/lng to TP. HCM city centre (10.776, 106.700)
 * when no coordinate is wired. Production reads Project.lat/lng (geocoded
 * once from Project.address on save).
 */
const FALLBACK = { lat: 10.776, lng: 106.7 };

export function WeatherRefreshButton({ projectId, address }: { projectId: string; address: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setAlert(null);
    try {
      const r = await fetch(
        `/api/siteeye/weather?projectId=${projectId}&lat=${FALLBACK.lat}&lng=${FALLBACK.lng}`,
      );
      if (r.ok) {
        const j = await r.json();
        if (j.alert) setAlert(`${j.alert.level.toUpperCase()}: ${j.alert.reason} — ${j.alert.action}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {alert && <span className="text-xs text-amber-700">{alert}</span>}
      <button
        type="button"
        onClick={go}
        disabled={busy}
        title={address || undefined}
        className="rounded-md border border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--ink-2))] hover:bg-[rgb(var(--raised))] disabled:opacity-50"
      >
        {busy ? "Đang lấy…" : "↻ Cập nhật"}
      </button>
    </div>
  );
}
