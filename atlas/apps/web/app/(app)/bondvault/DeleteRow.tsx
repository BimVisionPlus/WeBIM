"use client";
import { DeleteAction } from "@/components/delete-action";
export function DeleteRow({ id }: { id: string }) {
  return <DeleteAction url={`/api/bondvault/${id}`} label="bản ghi" testId={`delete-${id}`} />;
}
