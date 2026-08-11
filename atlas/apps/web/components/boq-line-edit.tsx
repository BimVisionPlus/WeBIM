/**
 * Inline editor for a single BoQ line — the hot field is `qtyCompleted`
 * (drives EV in EVM), but operators occasionally need to fix qty/price
 * after a change order. Tradeoff:
 *
 *   - Editing qty/price RECOMPUTES totalVnd on the server, which moves
 *     the BAC + EAC numbers on next refresh. Good for honesty (BAC reflects
 *     reality), but historical snapshots from `driftSnapshot` may diverge —
 *     that's expected behavior (drift detection is the whole point of that
 *     table).
 *   - qtyCompleted edits are scoped to "what % is built today" and don't
 *     touch totalVnd. The hot path.
 *
 * This component renders a button in the % column. Click → drawer with
 * all editable fields. Closes on save/cancel.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@atlas/ui";

export type BoQLineLite = {
  id: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  qtyCompleted: number;
  unitPriceVnd: string; // BigInt serialized
  category: string | null;
};

export function BoQLineEdit({ line }: { line: BoQLineLite }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [qtyCompleted, setQtyCompleted] = useState(line.qtyCompleted);
  const [qty, setQty] = useState(line.qty);
  const [unitPriceVnd, setUnitPriceVnd] = useState(Number(line.unitPriceVnd));
  const [description, setDescription] = useState(line.description);
  const [unit, setUnit] = useState(line.unit);
  const [category, setCategory] = useState(line.category ?? "");

  async function save() {
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = {};
    if (qtyCompleted !== line.qtyCompleted) body.qtyCompleted = qtyCompleted;
    if (qty !== line.qty) body.qty = qty;
    if (unitPriceVnd !== Number(line.unitPriceVnd)) body.unitPriceVnd = unitPriceVnd;
    if (description !== line.description) body.description = description;
    if (unit !== line.unit) body.unit = unit;
    if (category !== (line.category ?? "")) body.category = category || null;

    if (Object.keys(body).length === 0) {
      setOpen(false);
      setBusy(false);
      return;
    }
    const r = await fetch(`/api/costpulse/boq/lines/${line.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Lưu không thành công");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Sửa
      </Button>
    );
  }

  return (
    <div className="absolute right-3 z-20 mt-1 w-80 rounded-md border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3 text-left shadow-lg">
      <div className="mb-2 text-xs font-mono text-[rgb(var(--muted))]">
        {line.code} · sửa dòng
      </div>
      <div className="space-y-2">
        <Field label="Mô tả">
          <textarea
            rows={2}
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Đơn vị">
            <input
              className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </Field>
          <Field label="Nhóm">
            <input
              className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Phần thân"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="KL hợp đồng (qty)">
            <input
              type="number"
              step="0.01"
              min={0}
              className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
          </Field>
          <Field label="KL đã thực hiện">
            <input
              type="number"
              step="0.01"
              min={0}
              className="w-full rounded-md border border-emerald-400 bg-emerald-50 px-2 py-1.5 text-xs font-semibold"
              value={qtyCompleted}
              onChange={(e) => setQtyCompleted(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Đơn giá (VND)">
          <input
            type="number"
            min={0}
            step="1000"
            className="w-full rounded-md border border-[rgb(var(--line-2))] px-2 py-1.5 text-xs"
            value={unitPriceVnd}
            onChange={(e) => setUnitPriceVnd(Number(e.target.value))}
          />
        </Field>
      </div>
      {err && (
        <div className="mt-2 rounded bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">{err}</div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Hủy
        </Button>
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "…" : "Lưu"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--muted))]">{label}</span>
      {children}
    </label>
  );
}
