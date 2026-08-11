"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";

export function OverrunForecastPanel({ projects }: { projects: Array<{ id: string; key: string; name: string; bacVnd: string | null }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [persist, setPersist] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    if (!projectId) return;
    setBusy(true); setErr(null); setResult(null);
    const r = await fetch("/api/ai/cost-overrun/forecast", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, persist }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Không chạy được"); return; }
    setResult(j);
    if (persist) router.refresh();
  }

  const sev = result?.forecast?.severity;
  const sevClass =
    sev === "CRITICAL" ? "bg-rose-50 border-rose-300 text-rose-900" :
    sev === "ELEVATED" ? "bg-amber-50 border-amber-300 text-amber-900" :
    sev === "WATCH" ? "bg-yellow-50 border-yellow-300 text-yellow-900" :
    "bg-emerald-50 border-emerald-300 text-emerald-900";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs flex-1 min-w-[280px]"><span className="block text-[rgb(var(--muted))]">Dự án</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name} {p.bacVnd ? `(BAC ${fmt(Number(p.bacVnd))})` : "(no BoQ)"}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-[rgb(var(--ink-2))]"><input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} /> Lưu cảnh báo</label>
        <button onClick={run} disabled={busy || !projectId} className="rounded bg-rose-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50">{busy ? "AI đang phân tích…" : "Chạy AI forecast"}</button>
      </div>

      {err && <div className="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">{err}</div>}

      {result?.forecast && (
        <div className={`rounded border ${sevClass} p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide">Mức độ: {sev}</div>
              <div className="mt-0.5 text-lg font-bold">{result.forecast.explanation}</div>
            </div>
            <div className="text-right text-xs">
              <div>CPI {result.forecast.cpi.toFixed(2)}</div>
              <div>SPI {result.forecast.spi.toFixed(2)}</div>
              <div className="text-[10px] text-[rgb(var(--muted))]">nguồn: {result.forecast.source}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
            <div className="rounded bg-[rgb(var(--surface))]/70 p-2"><div className="text-[rgb(var(--muted))]">BAC</div><div className="font-medium">{fmt(result.forecast.bac)}</div></div>
            <div className="rounded bg-[rgb(var(--surface))]/70 p-2"><div className="text-[rgb(var(--muted))]">EV</div><div className="font-medium">{fmt(result.forecast.ev)}</div></div>
            <div className="rounded bg-[rgb(var(--surface))]/70 p-2"><div className="text-[rgb(var(--muted))]">AC</div><div className="font-medium">{fmt(result.forecast.ac)}</div></div>
            <div className="rounded bg-[rgb(var(--surface))]/70 p-2"><div className="text-[rgb(var(--muted))]">EAC (dự kiến)</div><div className="font-medium">{fmt(result.forecast.eacTimeAdjusted)}</div></div>
          </div>

          {result.forecast.drivers?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium">Nguyên nhân chính:</div>
              <ul className="mt-1 list-disc pl-5 text-xs">{result.forecast.drivers.map((d: string, i: number) => <li key={i}>{d}</li>)}</ul>
            </div>
          )}
          {result.forecast.action && (
            <div className="mt-3 text-xs"><span className="font-medium">Đề xuất hành động:</span> {result.forecast.action}</div>
          )}
          {result.forecast.topCategories?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium">Top hạng mục:</div>
              <table className="mt-1 w-full text-xs">
                <tbody>{result.forecast.topCategories.map((c: any) => (
                  <tr key={c.category}>
                    <td className="py-0.5 pr-2 text-[rgb(var(--muted))]">{c.category}</td>
                    <td className="py-0.5 pr-2 text-right">{fmt(c.valueVnd)}</td>
                    <td className="py-0.5 text-right">{c.donePct}% xong</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {result.signalId && <div className="mt-2 text-[10px] text-[rgb(var(--muted))]">Đã lưu signal {result.signalId.slice(-8)}.</div>}
        </div>
      )}
    </div>
  );
}
