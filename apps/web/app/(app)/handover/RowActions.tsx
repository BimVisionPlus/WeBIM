"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ id, state }: { id: string; state: string }) {
  if (["VERIFIED", "CLOSED"].includes(state)) return <span className="text-[10px] text-slate-500">Đã đóng</span>;
  return <DeleteAction url={`/api/handover/${id}/manage`} label="ticket bảo hành" testId={`delete-${id}`} />;
}
