"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DeleteAction } from "@/components/delete-action";
import { GenericEditDrawer } from "@/components/generic-edit-drawer";

const statuses = [
  { value: "POTENTIAL", label: "Tiềm năng" },
  { value: "TRACKING", label: "Đang theo" },
  { value: "WON", label: "Đã trúng" },
  { value: "LOST", label: "Không trúng" },
  { value: "ARCHIVED", label: "Lưu trữ" },
];

export function RowActions({ id, status, initial }: { id: string; status: string; initial: { name: string; clientName: string | null; province: string | null; estValueVnd: string | null; source: string | null; nextActionAt: string | null; note: string | null } }) {
  const router = useRouter();
  const [v, setV] = useState(status);
  const [busy, setBusy] = useState(false);
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const prev = v; const next = e.target.value; setV(next); setBusy(true);
    const r = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    setBusy(false);
    if (!r.ok) { setV(prev); return; }
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2" data-testid={`row-actions-${id}`}>
      <select value={v} onChange={onChange} disabled={busy} className="rounded border border-[rgb(var(--line-2))] px-1 py-0.5 text-[10px]" data-testid={`lead-status-${id}`}>
        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <GenericEditDrawer
        url={`/api/leads/${id}`}
        title="Sửa cơ hội"
        fields={[
          { key: "name", label: "Tên dự án / gói thầu", type: "text", initial: initial.name, required: true, colSpan: 3 },
          { key: "clientName", label: "Khách hàng", type: "text", initial: initial.clientName ?? "", colSpan: 2 },
          { key: "province", label: "Tỉnh", type: "text", initial: initial.province ?? "" },
          { key: "estValueVnd", label: "Giá trị dự kiến", type: "money", initial: initial.estValueVnd ?? "" },
          { key: "source", label: "Nguồn", type: "text", initial: initial.source ?? "" },
          { key: "nextActionAt", label: "Hành động tiếp theo", type: "date", initial: initial.nextActionAt ?? "" },
          { key: "note", label: "Ghi chú", type: "textarea", initial: initial.note ?? "" },
        ]}
      />
      <DeleteAction url={`/api/leads/${id}`} label="cơ hội" testId={`delete-${id}`} />
    </span>
  );
}
