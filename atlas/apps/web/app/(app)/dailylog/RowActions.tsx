"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ id, signed }: { id: string; signed: boolean }) {
  if (signed) return <span className="text-[10px] text-emerald-700">Đã ký</span>;
  return <DeleteAction url={`/api/daily-log/${id}`} label="nhật ký" testId={`delete-${id}`} />;
}
