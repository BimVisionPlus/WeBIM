"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ id, state }: { id: string; state: string }) {
  if (["VERIFIED", "CLOSED"].includes(state)) return <span className="text-[10px] text-[rgb(var(--muted))]">Đã đóng</span>;
  return <DeleteAction url={`/api/handover/${id}/manage`} label="ticket bảo hành" testId={`delete-${id}`} />;
}
