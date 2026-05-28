"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const categories: { value: string; label: string }[] = [
  { value: "BE_TONG", label: "Bê tông" },
  { value: "COT_THEP", label: "Cốt thép" },
  { value: "GACH_DA", label: "Gạch · đá" },
  { value: "XI_MANG_VOI", label: "Xi măng · vôi" },
  { value: "SON_PHU", label: "Sơn · phụ gia" },
  { value: "ME_HVAC", label: "M&E · HVAC" },
  { value: "ME_DIEN", label: "M&E · Điện" },
  { value: "ME_NUOC", label: "M&E · Nước" },
  { value: "PCCC", label: "PCCC" },
  { value: "CUA_KINH", label: "Cửa · kính · nhôm" },
  { value: "THIET_BI_THI_CONG", label: "Thiết bị thi công" },
  { value: "KHAC", label: "Khác" },
];

export function CreateForm() {
  const router = useRouter();
  const [open, setOpen] = useState<null | "item" | "supplier">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [item, setItem] = useState({ code: "", name: "", category: "BE_TONG", unit: "", spec: "", baselineUnitPriceVnd: "" });
  const [sup, setSup] = useState({ name: "", mst: "", phone: "", email: "", address: "" });

  async function post(url: string, payload: Record<string, unknown>, reset: () => void) {
    setBusy(true); setErr(null);
    const body = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== ""));
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(typeof j.error === "string" ? j.error : "Lỗi nhập liệu"); return; }
    reset(); setOpen(null); router.refresh();
  }

  if (!open) {
    return (
      <div className="flex gap-2">
        <button onClick={() => setOpen("item")} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white" data-testid="open-create-form">+ Thêm cấu kiện</button>
        <button onClick={() => setOpen("supplier")} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">+ Thêm nhà cung cấp</button>
      </div>
    );
  }

  if (open === "item") {
    return (
      <form onSubmit={(e) => { e.preventDefault(); post("/api/catalog/items", item, () => setItem({ code: "", name: "", category: "BE_TONG", unit: "", spec: "", baselineUnitPriceVnd: "" })); }} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="catalog-create-form">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Cấu kiện / vật tư mới</h3><button type="button" onClick={() => setOpen(null)} className="text-xs">Hủy</button></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-xs"><span className="block text-slate-600">Mã</span><input required value={item.code} onChange={(e) => setItem({ ...item, code: e.target.value })} placeholder="BT-C30" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="code" /></label>
          <label className="text-xs md:col-span-2"><span className="block text-slate-600">Tên</span><input required value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} placeholder="Bê tông thương phẩm C30" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="name" /></label>
          <label className="text-xs"><span className="block text-slate-600">Danh mục</span><select value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="category">{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
          <label className="text-xs"><span className="block text-slate-600">Đơn vị</span><input required value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} placeholder="m³" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="unit" /></label>
          <label className="text-xs"><span className="block text-slate-600">Đơn giá gốc (VND)</span><input value={item.baselineUnitPriceVnd} onChange={(e) => setItem({ ...item, baselineUnitPriceVnd: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="1450000" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="baselineUnitPriceVnd" /></label>
          <label className="text-xs md:col-span-3"><span className="block text-slate-600">Quy cách / tiêu chuẩn</span><input value={item.spec} onChange={(e) => setItem({ ...item, spec: e.target.value })} placeholder="TCVN 5574, độ sụt 12±2cm" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="spec" /></label>
        </div>
        {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
        <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Thêm cấu kiện"}</button></div>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); post("/api/catalog/suppliers", sup, () => setSup({ name: "", mst: "", phone: "", email: "", address: "" })); }} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="catalog-supplier-form">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Nhà cung cấp mới</h3><button type="button" onClick={() => setOpen(null)} className="text-xs">Hủy</button></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs md:col-span-2"><span className="block text-slate-600">Tên nhà cung cấp</span><input required value={sup.name} onChange={(e) => setSup({ ...sup, name: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="name" /></label>
        <label className="text-xs"><span className="block text-slate-600">MST</span><input value={sup.mst} onChange={(e) => setSup({ ...sup, mst: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="mst" /></label>
        <label className="text-xs"><span className="block text-slate-600">Điện thoại</span><input value={sup.phone} onChange={(e) => setSup({ ...sup, phone: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="phone" /></label>
        <label className="text-xs"><span className="block text-slate-600">Email</span><input type="email" value={sup.email} onChange={(e) => setSup({ ...sup, email: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="email" /></label>
        <label className="text-xs"><span className="block text-slate-600">Địa chỉ</span><input value={sup.address} onChange={(e) => setSup({ ...sup, address: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" name="address" /></label>
      </div>
      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}
      <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" data-testid="submit-create">{busy ? "…" : "Thêm nhà cung cấp"}</button></div>
    </form>
  );
}
