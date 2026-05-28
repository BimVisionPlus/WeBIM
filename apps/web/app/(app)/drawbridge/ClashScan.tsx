"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

export function ClashScan({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!projectId) return;
    setBusy(true); setErr(null); setMsg(null);
    const res = await fetch("/api/drawbridge/clashes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(typeof j.error === "string" ? j.error : "Không chạy được dò xung đột — cần có mô hình BIM đã nạp phần tử"); return; }
    const n = typeof j.clashes === "number" ? j.clashes : (Array.isArray(j.clashes) ? j.clashes.length : undefined);
    setMsg(n !== undefined ? `Đã dò xong: phát hiện ${n} xung đột.` : "Đã chạy dò xung đột.");
    router.refresh();
  }

  if (projects.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" data-testid="clash-scan">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-slate-600">Kiểm tra xung đột giữa các bộ môn (kết cấu · MEP · kiến trúc)</span>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs" data-testid="clash-scan-project">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}
        </select>
        <button onClick={run} disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50" data-testid="clash-scan-run">{busy ? "Đang dò…" : "Kiểm tra xung đột"}</button>
        {msg && <span className="text-xs text-emerald-700" data-testid="clash-scan-msg">{msg}</span>}
        {err && <span className="text-xs text-rose-700" data-testid="clash-scan-err">{err}</span>}
      </div>
    </div>
  );
}
