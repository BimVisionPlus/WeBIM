"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ id, result }: { id: string; result: string }) {
  if (result === "PASS" || result === "FAIL") return <span className="text-[10px] text-[rgb(var(--muted))]">Đã có kết quả</span>;
  return <DeleteAction url={`/api/qaqc/${id}/manage`} label="lượt check" testId={`delete-${id}`} />;
}
