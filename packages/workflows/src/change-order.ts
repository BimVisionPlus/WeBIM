/**
 * Change Order — Lệnh thay đổi.
 * Anchor: NĐ 10/2021 quản lý chi phí + Luật Đấu thầu 2023 (điều khoản phụ lục hợp đồng).
 *
 *   DRAFT → ESTIMATING → SUBMITTED → CDT_REVIEW ─┬─→ APPROVED → IMPLEMENTED → CLOSED
 *                                                 └─→ REJECTED                → CLOSED
 */

import type { Workflow } from "./types";

export type ChangeOrderState =
  | "DRAFT"
  | "ESTIMATING"
  | "SUBMITTED"
  | "CDT_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "IMPLEMENTED"
  | "CLOSED";

export const changeOrderWorkflow: Workflow<ChangeOrderState> = {
  name: "ChangeOrder",
  initial: "DRAFT",
  terminal: ["CLOSED"],
  transitions: [
    {
      from: "DRAFT",
      to: "ESTIMATING",
      action: "Bắt đầu ước tính",
      allowedRoles: ["NHA_THAU_CHINH"],
    },
    {
      from: "ESTIMATING",
      to: "SUBMITTED",
      action: "Nộp lên CĐT",
      allowedRoles: ["NHA_THAU_CHINH"],
      guard: (_actor, payload: any) =>
        typeof payload?.costDeltaVnd === "bigint" || typeof payload?.costDeltaVnd === "number"
          ? true
          : "Bắt buộc có ước tính chi phí (VND)",
    },
    {
      from: "SUBMITTED",
      to: "CDT_REVIEW",
      action: "CĐT tiếp nhận",
      allowedRoles: ["CHU_DAU_TU"],
    },
    {
      from: "CDT_REVIEW",
      to: "APPROVED",
      action: "Phê duyệt",
      allowedRoles: ["CHU_DAU_TU"],
      ref: "NĐ 10/2021",
    },
    {
      from: "CDT_REVIEW",
      to: "REJECTED",
      action: "Từ chối",
      allowedRoles: ["CHU_DAU_TU"],
    },
    {
      from: "CDT_REVIEW",
      to: "ESTIMATING",
      action: "Yêu cầu ước tính lại",
      allowedRoles: ["CHU_DAU_TU"],
    },
    {
      from: "APPROVED",
      to: "IMPLEMENTED",
      action: "Thi công xong",
      allowedRoles: ["NHA_THAU_CHINH"],
    },
    {
      from: "IMPLEMENTED",
      to: "CLOSED",
      action: "Đóng (đã ký phụ lục HĐ)",
      allowedRoles: ["CHU_DAU_TU", "NHA_THAU_CHINH"],
    },
    {
      from: "REJECTED",
      to: "CLOSED",
      action: "Đóng",
      allowedRoles: ["NHA_THAU_CHINH"],
    },
  ],
};
