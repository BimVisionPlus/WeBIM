"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ issueId, accepted }: { issueId: string; accepted: boolean }) {
  if (accepted) return <span className="text-[10px] text-emerald-700">Đã NT</span>;
  return <DeleteAction url={`/api/punch/${issueId}`} label="punch item" testId={`delete-${issueId}`} />;
}
