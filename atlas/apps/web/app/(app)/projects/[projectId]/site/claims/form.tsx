"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";
import { CLAIM_TYPE_LABEL, CLAIM_DIRECTION_LABEL } from "./labels";

export function ClaimForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "EOT",
    direction: "CONTRACTOR_TO_OWNER",
    counterparty: "",
    contractRef: "",
    amountVnd: "",
    eotDays: "",
    periodStart: "",
    periodEnd: "",
    noticeDeadlineAt: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title: form.title,
        description: form.description || undefined,
        type: form.type,
        direction: form.direction,
        counterparty: form.counterparty || undefined,
        contractRef: form.contractRef || undefined,
        amountVnd: form.amountVnd ? form.amountVnd.replace(/\D/g, "") : undefined,
        eotDays: form.eotDays ? parseInt(form.eotDays, 10) : undefined,
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
        noticeDeadlineAt: form.noticeDeadlineAt || undefined,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không tạo được hồ sơ");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ Lập hồ sơ khiếu nại</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--inverse-bg))]/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-[rgb(var(--surface))] shadow-xl">
            <header className="flex items-center justify-between border-b border-[rgb(var(--line))] px-4 py-3">
              <h2 className="text-sm font-semibold">Lập hồ sơ khiếu nại / EOT</h2>
              <button onClick={() => setOpen(false)} className="text-[rgb(var(--muted-2))] hover:text-[rgb(var(--ink-2))]">✕</button>
            </header>
            <form onSubmit={submit} className="space-y-3 px-4 py-4">
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Tiêu đề</span>
                <input
                  required
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                  placeholder="VD: Chậm bàn giao mặt bằng Zone B — yêu cầu EOT"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Loại khiếu nại</span>
                  <select
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {Object.entries(CLAIM_TYPE_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Hướng khiếu nại</span>
                  <select
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value })}
                  >
                    {Object.entries(CLAIM_DIRECTION_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Mô tả sự việc</span>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Bên bị khiếu nại</span>
                  <input
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    placeholder="VD: CĐT Vinhomes"
                    value={form.counterparty}
                    onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Điều khoản HĐ</span>
                  <input
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    placeholder="Điều 12.3, HĐ 05/2025/HĐXD"
                    value={form.contractRef}
                    onChange={(e) => setForm({ ...form, contractRef: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Giá trị yêu cầu (VND)</span>
                  <input
                    inputMode="numeric"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    placeholder="1250000000"
                    value={form.amountVnd}
                    onChange={(e) => setForm({ ...form, amountVnd: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Số ngày EOT</span>
                  <input
                    inputMode="numeric"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    placeholder="45"
                    value={form.eotDays}
                    onChange={(e) => setForm({ ...form, eotDays: e.target.value })}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Sự kiện từ</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    value={form.periodStart}
                    onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">đến</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    value={form.periodEnd}
                    onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-[rgb(var(--ink-2))]">Hạn thông báo</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-[rgb(var(--line-2))] px-3 py-2 text-sm"
                    value={form.noticeDeadlineAt}
                    onChange={(e) => setForm({ ...form, noticeDeadlineAt: e.target.value })}
                  />
                </label>
              </div>
              <p className="text-[11px] text-[rgb(var(--muted))]">
                Hạn thông báo: kiểm tra điều khoản khiếu nại trong hợp đồng — thông lệ 28–56 ngày kể từ
                khi phát sinh sự kiện. Quá hạn có thể mất quyền khiếu nại.
              </p>
              {err && <div className="rounded bg-rose-50 px-3 py-2 text-xs text-rose-700">{err}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Huỷ</Button>
                <Button type="submit" disabled={busy}>{busy ? "Đang tạo…" : "Tạo hồ sơ"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
