"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IncidentCreateButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const body: any = { projectId };
    fd.forEach((v, k) => {
      if (typeof v === "string" && v) body[k] = v;
    });
    try {
      const r = await fetch("/api/siteeye/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(typeof j?.error === "string" ? j.error : "Báo cáo thất bại");
      }
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700"
      >
        🚨 Báo sự cố
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-rose-700">Báo cáo sự cố ATLĐ</h3>
            <p className="mt-1 text-xs text-slate-500">
              Luật ATVSLĐ 84/2015 Điều 39: mọi sự cố/tai nạn LĐ phải báo ngay cho người sử dụng LĐ.
            </p>
            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Thời điểm xảy ra *</span>
                <input
                  name="occurredAt"
                  type="datetime-local"
                  required
                  defaultValue={new Date().toISOString().slice(0, 16)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-slate-700">Loại *</span>
                  <select
                    name="category"
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                  >
                    <option value="AN_TOAN_LAO_DONG">Tai nạn lao động</option>
                    <option value="CHAY_NO">Cháy nổ</option>
                    <option value="SUP_DO">Sụp đổ kết cấu</option>
                    <option value="ROI_NGA">Rơi/Ngã từ cao</option>
                    <option value="DIEN_GIAT">Điện giật</option>
                    <option value="HOA_CHAT">Hoá chất</option>
                    <option value="MOI_TRUONG">Môi trường</option>
                    <option value="KHAC">Khác</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-slate-700">Mức độ *</span>
                  <select
                    name="severity"
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                  >
                    <option value="NEAR_MISS">NEAR_MISS — suýt xảy ra</option>
                    <option value="MINOR">MINOR — nhẹ</option>
                    <option value="MAJOR">MAJOR — nặng</option>
                    <option value="CRITICAL">CRITICAL — tử vong/rất nặng</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Vị trí</span>
                <input
                  name="location"
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                  placeholder="Tầng 5 — Khu B"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Số người bị thương</span>
                <input
                  name="injured"
                  type="number"
                  defaultValue={0}
                  min={0}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Mô tả sự cố *</span>
                <textarea
                  name="description"
                  required
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-slate-700">Biện pháp xử lý ngay</span>
                <textarea
                  name="immediateAction"
                  rows={2}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
              </label>
              {err && <div className="rounded bg-rose-50 p-2 text-xs text-rose-700">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {busy ? "Đang gửi…" : "Gửi báo cáo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
