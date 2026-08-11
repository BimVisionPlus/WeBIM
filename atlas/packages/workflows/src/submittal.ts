/**
 * Submittal — vật liệu / shop drawing approval.
 * Anchor: NĐ 06/2021 Điều 13 — kiểm soát vật liệu trước khi đưa vào sử dụng.
 *
 *   DRAFT → SUBMITTED → UNDER_REVIEW ─┬─→ APPROVED            → CLOSED
 *                                      ├─→ APPROVED_AS_NOTED   → CLOSED
 *                                      ├─→ REVISE_RESUBMIT     → DRAFT (revision++)
 *                                      └─→ REJECTED            → CLOSED
 */

import type { Workflow } from "./types";

export type SubmittalState =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "APPROVED_AS_NOTED"
  | "REVISE_RESUBMIT"
  | "REJECTED"
  | "CLOSED";

export const submittalWorkflow: Workflow<SubmittalState> = {
  name: "Submittal",
  initial: "DRAFT",
  terminal: ["CLOSED"],
  transitions: [
    {
      from: "DRAFT",
      to: "SUBMITTED",
      action: "Nộp lên TVGS",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
      ref: "NĐ 06/2021 Điều 13",
    },
    {
      from: "SUBMITTED",
      to: "UNDER_REVIEW",
      action: "Tiếp nhận xem xét",
      allowedRoles: ["TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE"],
    },
    {
      from: "UNDER_REVIEW",
      to: "APPROVED",
      action: "Chấp thuận",
      allowedRoles: ["TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE", "CHU_DAU_TU"],
    },
    {
      from: "UNDER_REVIEW",
      to: "APPROVED_AS_NOTED",
      action: "Chấp thuận có ghi chú",
      allowedRoles: ["TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE", "CHU_DAU_TU"],
      guard: (_actor, payload: any) =>
        (payload?.notes && payload.notes.trim().length > 0) ||
        "Ghi chú là bắt buộc khi chấp thuận có điều kiện",
    },
    {
      from: "UNDER_REVIEW",
      to: "REVISE_RESUBMIT",
      action: "Yêu cầu sửa & nộp lại",
      allowedRoles: ["TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE"],
      guard: (_actor, payload: any) =>
        (payload?.notes && payload.notes.trim().length > 0) ||
        "Phải nêu rõ nội dung cần sửa",
    },
    {
      from: "UNDER_REVIEW",
      to: "REJECTED",
      action: "Từ chối",
      allowedRoles: ["TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE", "CHU_DAU_TU"],
    },
    {
      from: "REVISE_RESUBMIT",
      to: "DRAFT",
      action: "Bắt đầu sửa",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    { from: "APPROVED", to: "CLOSED", action: "Đóng", allowedRoles: ["NHA_THAU_CHINH"] },
    { from: "APPROVED_AS_NOTED", to: "CLOSED", action: "Đóng", allowedRoles: ["NHA_THAU_CHINH"] },
    { from: "REJECTED", to: "CLOSED", action: "Đóng", allowedRoles: ["NHA_THAU_CHINH"] },
  ],
};
