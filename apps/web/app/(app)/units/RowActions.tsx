"use client";
import { GenericEditDrawer } from "@/components/generic-edit-drawer";
import { DeleteAction } from "@/components/delete-action";

export function RowActions({
  id,
  initial,
}: {
  id: string;
  initial: { code: string; name: string; description: string | null; province: string | null; active: boolean };
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <GenericEditDrawer
        url={`/api/units/${id}`}
        title="Sửa đơn vị"
        triggerLabel="Sửa"
        fields={[
          { key: "code", label: "Mã", type: "text", initial: initial.code, colSpan: 1 },
          { key: "name", label: "Tên đơn vị", type: "text", initial: initial.name, colSpan: 2 },
          { key: "description", label: "Mô tả", type: "textarea", initial: initial.description ?? "", colSpan: 3 },
          { key: "province", label: "Địa bàn", type: "text", initial: initial.province ?? "", colSpan: 1 },
          { key: "active", label: "Trạng thái", type: "select", initial: initial.active ? "true" : "false", options: [{ value: "true", label: "Đang hoạt động" }, { value: "false", label: "Đã ngừng" }], colSpan: 1 },
        ]}
      />
      <DeleteAction url={`/api/units/${id}`} label="đơn vị" soft={!initial.active} />
    </span>
  );
}
