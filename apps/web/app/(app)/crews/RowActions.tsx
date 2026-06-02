"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ id, hasAssignments }: { id: string; hasAssignments: boolean }) {
  return <DeleteAction url={`/api/crews/${id}`} label="tổ đội" testId={`delete-${id}`} soft={hasAssignments} />;
}
