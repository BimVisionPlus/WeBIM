"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ issueId, approved }: { issueId: string; approved: boolean }) {
  if (approved) return <span className="text-[10px] text-emerald-700">Đã duyệt</span>;
  return <DeleteAction url={`/api/change-orders/${issueId}`} label="lệnh thay đổi" testId={`delete-${issueId}`} />;
}
