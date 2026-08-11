"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DEPT_LABELS: { value: string; label: string }[] = [
  { value: "CONG_VIEC", label: "Công việc" },
  { value: "DAU_THAU", label: "Đấu thầu" },
  { value: "HANH_CHINH", label: "Hành chính" },
  { value: "TAI_CHINH_KE_TOAN", label: "Tài chính kế toán" },
  { value: "PHAT_TRIEN_THI_TRUONG", label: "Phát triển thị trường" },
  { value: "CONG_VIEC_KHAC", label: "Công việc khác" },
];

export function DepartmentSelect({ projectId, value }: { projectId: string; value: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const prev = current;
    setCurrent(next); setBusy(true); setErr(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ department: next }),
    });
    setBusy(false);
    if (!res.ok) {
      setCurrent(prev);
      const j = await res.json().catch(() => ({}));
      setErr(typeof j.error === "string" ? j.error : "Không cập nhật được");
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-1" data-testid={`dept-select-${projectId}`}>
      <select
        value={current}
        onChange={onChange}
        disabled={busy}
        className="rounded border border-[rgb(var(--line-2))] bg-[rgb(var(--surface))] px-1.5 py-0.5 text-[11px] text-[rgb(var(--ink-2))] disabled:opacity-50"
        title="Đổi phòng phụ trách"
      >
        {DEPT_LABELS.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>
      {err && <span className="text-[10px] text-rose-600" title={err}>!</span>}
    </span>
  );
}
