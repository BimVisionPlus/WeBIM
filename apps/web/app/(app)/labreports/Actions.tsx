"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", sampleCode: "", sampleType: "BE_TONG", testMethod: "Nén mẫu BT 150x150x150", tcvnRef: "TCVN 3118:1993", labCode: "LAS-XD 0421", labOrgName: "TT Kiểm định CL XDDD Phía Nam", sampledBy: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/labreports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, sampleCode: "", sampledBy: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Lấy mẫu thí nghiệm</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="labreports-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Mẫu thí nghiệm mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã mẫu</span><input required value={f.sampleCode} onChange={(e) => setF({ ...f, sampleCode: e.target.value })} placeholder="LAB-XXX-001" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 font-mono" name="sampleCode" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại</span><select value={f.sampleType} onChange={(e) => setF({ ...f, sampleType: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="sampleType"><option value="BE_TONG">Bê tông</option><option value="THEP">Thép</option><option value="XI_MANG">Xi măng</option><option value="CAT_DA">Cát đá</option><option value="DAT_NEN">Đất nền</option><option value="COC_NEN">Thử tải cọc</option><option value="KHAC">Khác</option></select></label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Phương pháp</span><input required value={f.testMethod} onChange={(e) => setF({ ...f, testMethod: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="testMethod" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">TCVN</span><input required value={f.tcvnRef} onChange={(e) => setF({ ...f, tcvnRef: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="tcvnRef" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã LAS-XD</span><input required value={f.labCode} onChange={(e) => setF({ ...f, labCode: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="labCode" /></label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Tên phòng LAS</span><input value={f.labOrgName} onChange={(e) => setF({ ...f, labOrgName: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="labOrgName" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Tạo"}</button></div>
    </form>
  );
}

export function ResultActions({ id, result }: { id: string; result: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (result !== "PENDING") return <span className="text-[10px] text-[rgb(var(--muted-2))]">—</span>;

  async function go(r: string) {
    setBusy(r);
    const body: Record<string, unknown> = { result: r };
    if (r === "FAIL") { const n = window.prompt("Mô tả lỗi (sẽ tạo NCR):"); if (!n) { setBusy(null); return; } body.notes = n; }
    const res = await fetch(`/api/labreports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`result-actions-${id}`}>
      <button onClick={() => go("PASS")} disabled={busy === "PASS"} className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="action-PASS">{busy === "PASS" ? "…" : "Pass"}</button>
      <button onClick={() => go("FAIL")} disabled={busy === "FAIL"} className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="action-FAIL">{busy === "FAIL" ? "…" : "Fail → NCR"}</button>
      <button onClick={() => go("CONDITIONAL")} disabled={busy === "CONDITIONAL"} className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="action-CONDITIONAL">{busy === "CONDITIONAL" ? "…" : "ĐKĐK"}</button>
    </div>
  );
}
