"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardBody, CardHeader, CardTitle } from "@atlas/ui";

function CreateProjectInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const orgId = sp.get("orgId");
  const [form, setForm] = useState({
    key: "",
    name: "",
    province: "TP. HCM",
    district: "",
    address: "",
    contractValueVnd: "",
    startDate: "",
    endDate: "",
    permitNumber: "",
    warrantyMonths: 24,
    department: "CONG_VIEC",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) {
      setErr("Thiếu orgId");
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerOrgId: orgId,
        key: form.key.toUpperCase(),
        name: form.name,
        province: form.province,
        district: form.district,
        address: form.address,
        contractValueVnd: form.contractValueVnd || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        permitNumber: form.permitNumber || undefined,
        warrantyMonths: form.warrantyMonths,
        department: form.department,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(j.error ?? "Không tạo được dự án");
      return;
    }
    const j = await r.json();
    router.push(`/projects/${j.project.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tạo dự án đầu tiên</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Mã dự án (PROJECT-KEY)</span>
            <input
              required
              maxLength={20}
              placeholder="VHGP-S9"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value.toUpperCase() })}
            />
            <span className="mt-1 block text-[11px] text-slate-500">Dùng làm tiền tố cho issue: {form.key || "VHGP-S9"}-RFI-001</span>
          </label>
          <label className="block md:col-span-1">
            <span className="block text-xs font-medium text-slate-700">Tên dự án</span>
            <input
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Vinhomes Grand Park — Lô S9"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Tỉnh/Thành</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Quận/Huyện</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
            />
          </label>
          <label className="block md:col-span-2">
            <span className="block text-xs font-medium text-slate-700">Địa chỉ công trình</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Giá trị hợp đồng (VND)</span>
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.contractValueVnd}
              onChange={(e) => setForm({ ...form, contractValueVnd: e.target.value })}
              placeholder="1850000000000"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Số GPXD</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.permitNumber}
              onChange={(e) => setForm({ ...form, permitNumber: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Phòng phụ trách</span>
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              <option value="CONG_VIEC">Công việc</option>
              <option value="DAU_THAU">Đấu thầu</option>
              <option value="HANH_CHINH">Hành chính</option>
              <option value="TAI_CHINH_KE_TOAN">Tài chính kế toán</option>
              <option value="PHAT_TRIEN_THI_TRUONG">Phát triển thị trường</option>
              <option value="CONG_VIEC_KHAC">Công việc khác</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Ngày khởi công</span>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-700">Ngày hoàn thành dự kiến</span>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </label>
          {err && <div className="md:col-span-2 rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy || !orgId}>
              {busy ? "Đang tạo…" : "Tạo dự án"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function CreateProjectPage() {
  return (
    <Suspense fallback={null}>
      <CreateProjectInner />
    </Suspense>
  );
}
