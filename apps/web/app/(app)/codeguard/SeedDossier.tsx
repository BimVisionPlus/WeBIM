"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string };

export function SeedDossier({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!projectId) return;
    setBusy(true); setErr(null); setMsg(null);
    const res = await fetch(`/api/codeguard/dossier/${projectId}/seed`, { method: "POST" });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(typeof j.error === "string" ? j.error : "Không khởi tạo được hồ sơ"); return; }
    const created = typeof j.created === "number" ? j.created : 0;
    setMsg(created > 0 ? `Đã tạo ${created} mục hồ sơ chất lượng theo NĐ 15/2021.` : "Hồ sơ đã đầy đủ theo mẫu — không có mục mới.");
    router.refresh();
  }

  if (projects.length === 0) return null;

  return (
    <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--raised))] p-3" data-testid="seed-dossier">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-[rgb(var(--muted))]">Khởi tạo hồ sơ chất lượng (NĐ 15/2021 Phụ lục I) cho dự án</span>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded border border-[rgb(var(--line-2))] px-2 py-1 text-xs" data-testid="seed-dossier-project">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}
        </select>
        <button onClick={run} disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="seed-dossier-run">{busy ? "Đang tạo…" : "Khởi tạo hồ sơ"}</button>
        {msg && <span className="text-xs text-emerald-700" data-testid="seed-dossier-msg">{msg}</span>}
        {err && <span className="text-xs text-rose-700" data-testid="seed-dossier-err">{err}</span>}
      </div>
    </div>
  );
}
