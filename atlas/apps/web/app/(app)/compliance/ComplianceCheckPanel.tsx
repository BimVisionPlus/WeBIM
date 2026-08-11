"use client";
import { useState } from "react";

const statusMeta: Record<string, { label: string; cls: string }> = {
  COMPLIANT: { label: "Tuân thủ", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  PARTIAL: { label: "Một phần", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  NON_COMPLIANT: { label: "Không tuân thủ", cls: "bg-rose-100 text-rose-800 border-rose-300" },
  NO_DATA: { label: "Thiếu dữ liệu", cls: "bg-[rgb(var(--raised))] text-[rgb(var(--ink-2))] border-[rgb(var(--line-2))]" },
};

export function ComplianceCheckPanel({ projects }: { projects: Array<{ id: string; key: string; name: string }> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function run() {
    if (!projectId) return;
    setBusy(true); setErr(null); setResult(null);
    const r = await fetch("/api/ai/compliance/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Không chạy được"); return; }
    setResult(j);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs flex-1 min-w-[280px]"><span className="block text-[rgb(var(--muted))]">Dự án</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
          </select>
        </label>
        <button onClick={run} disabled={busy || !projectId} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50">{busy ? "AI đang đánh giá…" : "Chạy AI compliance check"}</button>
      </div>

      {err && <div className="rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800">{err}</div>}

      {result && (
        <div className="space-y-3">
          <div className={`rounded border p-4 ${statusMeta[result.overallStatus]?.cls ?? "bg-[rgb(var(--raised))]"}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide">Đánh giá tổng thể</div>
                <div className="mt-1 text-3xl font-bold">{result.overallScore}<span className="text-base font-normal opacity-70">/100</span></div>
                <div className="mt-1 text-xs">{statusMeta[result.overallStatus]?.label ?? result.overallStatus}</div>
              </div>
              <div className="text-right text-xs"><div>Nguồn: {result.source}</div><div className="text-[10px] opacity-70">{result.model ?? ""}</div></div>
            </div>
            <p className="mt-2 text-sm">{result.summary}</p>
          </div>

          <div className="overflow-hidden rounded border border-[rgb(var(--line))]">
            <table className="w-full text-sm">
              <thead className="bg-[rgb(var(--raised))] text-xs uppercase text-[rgb(var(--muted))]">
                <tr><th className="p-2 text-left">Tiêu chuẩn</th><th className="p-2 text-right">Điểm</th><th className="p-2 text-left">Trạng thái</th><th className="p-2 text-left">Phát hiện</th><th className="p-2 text-left">Đề xuất</th></tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--line))]">
                {result.standards.map((s: any) => {
                  const m = statusMeta[s.status] ?? statusMeta.NO_DATA!;
                  return (
                    <tr key={s.code} className="align-top">
                      <td className="p-2 text-xs"><div className="font-mono font-medium">{s.code}</div><div className="text-[10px] text-[rgb(var(--muted))]">{s.title}</div></td>
                      <td className="p-2 text-right text-sm font-bold">{s.score}</td>
                      <td className="p-2"><span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${m.cls}`}>{m.label}</span></td>
                      <td className="p-2 text-[11px]"><ul className="list-disc pl-4 space-y-0.5">{(s.findings ?? []).map((f: string, i: number) => <li key={i}>{f}</li>)}</ul></td>
                      <td className="p-2 text-[11px]"><ul className="list-disc pl-4 space-y-0.5">{(s.recommendations ?? []).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
