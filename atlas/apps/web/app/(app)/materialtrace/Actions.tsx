"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

const ACTIONS: Record<string, { action: string; label: string; tone: "primary" | "danger" | "neutral" }[]> = {
  RECEIVED: [{ action: "TEST", label: "Bắt đầu thí nghiệm", tone: "neutral" }, { action: "ACCEPT", label: "Chấp thuận", tone: "primary" }, { action: "REJECT", label: "Trả NCC", tone: "danger" }],
  TESTING: [{ action: "ACCEPT", label: "Chấp thuận", tone: "primary" }, { action: "REJECT", label: "Trả NCC", tone: "danger" }],
  ACCEPTED: [{ action: "USE_PARTIAL", label: "Dùng dở", tone: "neutral" }, { action: "USE_UP", label: "Dùng hết", tone: "neutral" }],
  PARTIAL_USED: [{ action: "USE_UP", label: "Hết", tone: "neutral" }],
  REJECTED: [], USED_UP: [],
};

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ projectId: projects[0]?.id ?? "", lotCode: "", materialName: "", category: "THEP", manufacturer: "", origin: "Việt Nam", quantity: "", unit: "tấn", crCertNo: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const payload = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
    const res = await fetch("/api/materialtrace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi"); return; }
    setOpen(false); setF({ ...f, lotCode: "", materialName: "", manufacturer: "", quantity: "" }); router.refresh();
  }

  if (!open) return <button onClick={() => setOpen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))]" data-testid="open-create-form">+ Nhận lô VL</button>;

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="materialtrace-create-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Lô vật liệu mới</h3><button type="button" onClick={() => setOpen(false)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Dự án</span><select required value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="projectId">{projects.map((p) => <option key={p.id} value={p.id}>{p.key}</option>)}</select></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã lot</span><input required value={f.lotCode} onChange={(e) => setF({ ...f, lotCode: e.target.value })} placeholder="LOT-XXX-001" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 font-mono" name="lotCode" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Loại</span><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="category"><option value="XI_MANG">Xi măng</option><option value="THEP">Thép</option><option value="KINH">Kính</option><option value="GACH">Gạch</option><option value="BE_TONG_TUOI">BT thương phẩm</option><option value="SON">Sơn</option><option value="PHU_GIA">Phụ gia</option><option value="OTHER">Khác</option></select></label>
        <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Tên VL</span><input required value={f.materialName} onChange={(e) => setF({ ...f, materialName: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="materialName" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">NSX</span><input required value={f.manufacturer} onChange={(e) => setF({ ...f, manufacturer: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="manufacturer" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số lượng</span><input required value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} pattern="\d+(\.\d+)?" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="quantity" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Đơn vị</span><input required value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="unit" /></label>
        <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Số CR hợp quy</span><input value={f.crCertNo} onChange={(e) => setF({ ...f, crCertNo: e.target.value })} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5" name="crCertNo" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Nhận"}</button></div>
    </form>
  );
}

export function RowActions({ id, state }: { id: string; state: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const actions = ACTIONS[state] ?? [];
  if (actions.length === 0) return <span className="text-[10px] text-[rgb(var(--muted-2))]">—</span>;

  async function go(action: string) {
    setBusy(action);
    const body: Record<string, unknown> = { action };
    if (action === "REJECT") { const n = window.prompt("Lý do trả NCC:"); if (!n) { setBusy(null); return; } body.reason = n; }
    const res = await fetch(`/api/materialtrace/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1" data-testid={`actions-${id}`}>
      {actions.map((a) => (
        <button key={a.action} onClick={() => go(a.action)} disabled={busy === a.action}
          className={`rounded px-2 py-0.5 text-[10px] font-medium ${a.tone === "danger" ? "bg-rose-100 text-rose-800" : a.tone === "primary" ? "bg-blue-600 text-[rgb(var(--inverse-ink))]" : "bg-[rgb(var(--raised))] text-[rgb(var(--ink-2))]"} disabled:opacity-50`}
          data-testid={`action-${a.action}`}>{busy === a.action ? "…" : a.label}</button>
      ))}
    </div>
  );
}
