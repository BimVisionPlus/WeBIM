"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type ProjectOpt = { id: string; key: string; name: string };

export function CreateForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    projectId: projects[0]?.id ?? "",
    code: "",
    period: new Date().toISOString().slice(0, 7),
    paymentType: "GIAI_DOAN",
    fundSource: "NGAN_SACH",
    contractRef: "",
    workDoneVnd: "",
    cumulativeWorkVnd: "",
    advanceDeductionVnd: "0",
    retentionVnd: "0",
    vatRate: 8,
    notes: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/paymentrail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Tạo hồ sơ thất bại");
      return;
    }
    setOpen(false);
    setForm({ ...form, code: "", workDoneVnd: "", cumulativeWorkVnd: "" });
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        data-testid="open-create-form"
      >
        + Tạo hồ sơ thanh toán
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4" data-testid="paymentrail-create-form">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Hồ sơ thanh toán mới</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-600 hover:text-slate-900">Hủy</button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs">
          <span className="block text-slate-600">Dự án</span>
          <select required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="projectId">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.key} — {p.name}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-slate-600">Mã hồ sơ</span>
          <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="TT-VHGP-S9-2026-06-001" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-mono" name="code" />
        </label>
        <label className="text-xs">
          <span className="block text-slate-600">Kỳ (YYYY-MM)</span>
          <input required value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} pattern="\d{4}-\d{2}" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="period" />
        </label>

        <label className="text-xs">
          <span className="block text-slate-600">Loại</span>
          <select value={form.paymentType} onChange={(e) => setForm({ ...form, paymentType: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="paymentType">
            <option value="TAM_UNG">Tạm ứng</option>
            <option value="GIAI_DOAN">Giai đoạn</option>
            <option value="HOAN_THANH">Hoàn thành</option>
            <option value="QUYET_TOAN">Quyết toán</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-slate-600">Nguồn vốn</span>
          <select value={form.fundSource} onChange={(e) => setForm({ ...form, fundSource: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="fundSource">
            <option value="NGAN_SACH">Ngân sách</option>
            <option value="DOANH_NGHIEP">Doanh nghiệp</option>
            <option value="FDI">FDI</option>
            <option value="HON_HOP">Hỗn hợp</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-slate-600">Số HĐ kinh tế</span>
          <input value={form.contractRef} onChange={(e) => setForm({ ...form, contractRef: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="contractRef" />
        </label>

        <label className="text-xs">
          <span className="block text-slate-600">KL hoàn thành kỳ này (VND)</span>
          <input required value={form.workDoneVnd} onChange={(e) => setForm({ ...form, workDoneVnd: e.target.value })} pattern="\d+" placeholder="22750000000" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="workDoneVnd" />
        </label>
        <label className="text-xs">
          <span className="block text-slate-600">Luỹ kế KL (VND)</span>
          <input required value={form.cumulativeWorkVnd} onChange={(e) => setForm({ ...form, cumulativeWorkVnd: e.target.value })} pattern="\d+" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="cumulativeWorkVnd" />
        </label>
        <label className="text-xs">
          <span className="block text-slate-600">VAT (%)</span>
          <input type="number" min={0} max={20} value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="vatRate" />
        </label>

        <label className="text-xs">
          <span className="block text-slate-600">Khấu trừ tạm ứng (VND)</span>
          <input value={form.advanceDeductionVnd} onChange={(e) => setForm({ ...form, advanceDeductionVnd: e.target.value })} pattern="\d+" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="advanceDeductionVnd" />
        </label>
        <label className="text-xs">
          <span className="block text-slate-600">Bảo lưu (VND)</span>
          <input value={form.retentionVnd} onChange={(e) => setForm({ ...form, retentionVnd: e.target.value })} pattern="\d+" className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="retentionVnd" />
        </label>
        <label className="text-xs md:col-span-1">
          <span className="block text-slate-600">Ghi chú</span>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" name="notes" />
        </label>
      </div>

      {err && <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-800" data-testid="create-error">{err}</div>}

      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50" data-testid="submit-create">
          {busy ? "Đang tạo…" : "Tạo hồ sơ"}
        </button>
      </div>
    </form>
  );
}
