"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

export function CreateForm({
  orgs,
  parents,
}: {
  orgs: Array<{ id: string; name: string }>;
  parents: Array<{ id: string; code: string; name: string; orgId: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [province, setProvince] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const r = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId, code, name,
        description: description || undefined,
        parentId: parentId || undefined,
        province: province || undefined,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không thể tạo đơn vị");
      return;
    }
    setOpen(false);
    setCode(""); setName(""); setDescription(""); setParentId(""); setProvince("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700">
        + Thêm đơn vị
      </button>
    );
  }

  const eligibleParents = parents.filter((p) => p.orgId === orgId);

  return (
    <Card>
      <CardHeader><CardTitle>Thêm đơn vị mới</CardTitle></CardHeader>
      <CardBody>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3" data-testid="create-unit-form">
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Tổ chức</span>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} required className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Mã đơn vị</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="BCH-HN" pattern="[A-Za-z0-9\-_.]+" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Địa bàn</span>
            <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Hà Nội" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs md:col-span-3"><span className="block text-[rgb(var(--muted))]">Tên đầy đủ</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ban điều hành Hà Nội" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs md:col-span-2"><span className="block text-[rgb(var(--muted))]">Mô tả</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Phụ trách các dự án khu vực phía Bắc" className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs" />
          </label>
          <label className="text-xs"><span className="block text-[rgb(var(--muted))]">Cấp trên (tuỳ chọn)</span>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="mt-1 w-full rounded border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs">
              <option value="">— Cấp trên cùng —</option>
              {eligibleParents.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
            </select>
          </label>
          {err && <div className="md:col-span-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-unit-error">{err}</div>}
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded border border-[rgb(var(--line-2))] px-3 py-1 text-xs">Huỷ</button>
            <button type="submit" disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-[rgb(var(--inverse-ink))] disabled:opacity-50" data-testid="create-unit-save">{busy ? "…" : "Lưu"}</button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
