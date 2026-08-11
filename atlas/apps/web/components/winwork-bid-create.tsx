"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Org = { id: string; name: string };
type Opportunity = { id: string; title: string; budgetVnd: string | null; closingAt: string | null };

export function BidCreateButton({ orgs, opportunities }: { orgs: Org[]; opportunities: Opportunity[] }) {
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
    if (body.marginPct) body.marginPct = Number(body.marginPct);
    if (body.contingencyPct) body.contingencyPct = Number(body.contingencyPct);
    try {
      const r = await fetch("/api/winwork/bids", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(typeof j?.error === "string" ? j.error : "Tạo HSDT thất bại");
      }
      const data = await r.json();
      setOpen(false);
      router.push(`/winwork/bids/${data.bid.id}`);
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
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-[rgb(var(--inverse-ink))] hover:bg-blue-700"
      >
        + Tạo HSDT
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(var(--inverse-bg))]/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-lg bg-[rgb(var(--surface))] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Tạo hồ sơ dự thầu</h3>
            <form className="mt-4 space-y-3" onSubmit={onSubmit}>
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Tổ chức đứng tên dự thầu *</span>
                <select
                  name="orgId"
                  required
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Gắn vào cơ hội đấu thầu (tùy chọn)</span>
                <select
                  name="opportunityId"
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                >
                  <option value="">— Không gắn —</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title.slice(0, 80)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Tên gói thầu *</span>
                <input
                  name="title"
                  required
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Giá dự toán nội bộ (VND)</span>
                  <input
                    name="estimatedValueVnd"
                    type="number"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Giá dự thầu (VND)</span>
                  <input
                    name="proposedValueVnd"
                    type="number"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Margin %</span>
                  <input
                    name="marginPct"
                    type="number"
                    step="0.1"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Contingency %</span>
                  <input
                    name="contingencyPct"
                    type="number"
                    step="0.1"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-2.5 py-1.5 text-sm"
                  />
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
                  {busy ? "Đang lưu…" : "Tạo & mở"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
