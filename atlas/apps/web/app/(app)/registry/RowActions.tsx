"use client";
import { DeleteAction } from "@/components/delete-action";
export function RowActions({ id }: { id: string }) {
  return <DeleteAction url={`/api/registry/${id}/manage`} label="hồ sơ năng lực" testId={`delete-${id}`} />;
}
