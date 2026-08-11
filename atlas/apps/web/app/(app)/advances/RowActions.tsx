"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
import { GenericEditDrawer } from "@/components/generic-edit-drawer";

const statuses = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "SETTLED", label: "Đã quyết toán" },
  { value: "CANCELLED", label: "Huỷ" },
];

export function RowActions({ id, status, initial }: { id: string; status: string; initial: { txnNo: string | null; payeeName: string; amountVnd: string; purpose: string; txnDate: string; note: string | null } }) {
  const router = useRouter();
  const [v, setV] = useState(status);
  const [busy, setBusy] = useState(false);
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const prev = v; const next = e.target.value; setV(next); setBusy(true);
    const r = await fetch(`/api/advances/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    setBusy(false);
    if (!r.ok) { setV(prev); return; }
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2" data-testid={`row-actions-${id}`}>
      <select value={v} onChange={onChange} disabled={busy} className="rounded border border-[rgb(var(--line-2))] px-1 py-0.5 text-[10px]">
        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <GenericEditDrawer
        url={`/api/advances/${id}`}
        title="Sửa giao dịch tài chính"
        fields={[
          { key: "txnNo", label: "Số phiếu", type: "text", initial: initial.txnNo ?? "" },
          { key: "payeeName", label: "Người/ĐV nhận", type: "text", initial: initial.payeeName, required: true, colSpan: 2 },
          { key: "amountVnd", label: "Số tiền", type: "money", initial: initial.amountVnd, required: true },
          { key: "txnDate", label: "Ngày phát sinh", type: "date", initial: initial.txnDate, required: true },
          { key: "purpose", label: "Mục đích", type: "textarea", initial: initial.purpose, required: true, colSpan: 3 },
          { key: "note", label: "Ghi chú", type: "textarea", initial: initial.note ?? "" },
        ]}
      />
      <DeleteAction url={`/api/advances/${id}`} label="giao dịch" testId={`delete-${id}`} />
    </span>
  );
}
