"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Bid = { id: string; key: string; title: string };

export function BondCreateButton({ bids }: { bids: Bid[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const body: any = {};
    fd.forEach((v, k) => {
      if (typeof v === "string" && v) body[k] = v;
    });
    try {
      const r = await fetch("/api/winwork/bonds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(typeof j?.error === "string" ? j.error : "Tạo BL thất bại");
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
        disabled={bids.length === 0}
        title={bids.length === 0 ? "Tạo HSDT trước" : undefined}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700 disabled:opacity-50"
      >
        + Thêm bảo lãnh
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(var(--inverse-bg))]/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-lg bg-[rgb(var(--surface))] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Thêm bảo lãnh</h3>
            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">HSDT *</span>
                <select
                  name="bidId"
                  required
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                >
                  {bids.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.key} — {b.title.slice(0, 60)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Loại bảo lãnh *</span>
                <select
                  name="type"
                  required
                  defaultValue="BAO_LANH_DU_THAU"
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                >
                  <option value="BAO_LANH_DU_THAU">BL dự thầu (Điều 14)</option>
                  <option value="BAO_LANH_THUC_HIEN">BL thực hiện HĐ (Điều 75)</option>
                  <option value="BAO_LANH_TAM_UNG">BL tạm ứng</option>
                  <option value="BAO_LANH_BAO_HANH">BL bảo hành</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Ngân hàng *</span>
                  <input name="issuerBank" required className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm" placeholder="Vietcombank" />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Số BL *</span>
                  <input name="bondNumber" required className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm" placeholder="BL/2026/0001" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Mệnh giá (VND) *</span>
                  <input name="amountVnd" type="number" required className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm" />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Phí BL (VND)</span>
                  <input name="feeVnd" type="number" className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Ngày phát hành *</span>
                  <input name="issuedAt" type="date" required className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm" />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Hết hạn *</span>
                  <input name="expiresAt" type="date" required className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm" />
                </label>
              </div>
              {err && <div className="rounded bg-rose-50 p-2 text-xs text-rose-700">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-[rgb(var(--line-2))] px-3 py-1.5 text-sm hover:bg-[rgb(var(--raised))]"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy ? "Đang lưu…" : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
