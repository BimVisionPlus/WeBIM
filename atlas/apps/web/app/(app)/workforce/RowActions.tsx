"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ id, hasAttendance }: { id: string; hasAttendance: boolean }) {
  return <DeleteAction url={`/api/workforce/${id}/manage`} label="NLĐ" testId={`delete-${id}`} soft={hasAttendance} />;
}
