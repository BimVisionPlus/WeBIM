"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PromoteAction({ leadId, orgId, suggestedKey }: { leadId: string; orgId: string; suggestedKey: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [projectKey, setProjectKey] = useState(suggestedKey);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch("/api/leads/promote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, ownerOrgId: orgId, projectKey: projectKey.toUpperCase() }),
    });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    const j = await res.json();
    router.push(`/projects/${j.project.id}/tinh-hinh`);
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-xs font-medium text-emerald-700 hover:underline" data-testid={`promote-${leadId}`}>→ Tạo dự án</button>;
  return (
    <form onSubmit={submit} className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input required value={projectKey} onChange={(e) => setProjectKey(e.target.value.toUpperCase())} placeholder="Mã DA" className="w-24 rounded border border-slate-300 px-1.5 py-0.5 text-xs" data-testid={`promote-key-${leadId}`} />
      <button type="submit" disabled={busy} className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white disabled:opacity-50" data-testid={`promote-submit-${leadId}`}>{busy ? "…" : "OK"}</button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500">×</button>
      {err && <span className="text-[10px] text-rose-600" title={err}>!</span>}
    </form>
  );
}
