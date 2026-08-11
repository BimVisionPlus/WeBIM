/**
 * RFI — Request for Information.
 * Anchor: NĐ 06/2021 Điều 19 — Nhà thầu yêu cầu CĐT/TVTK làm rõ thiết kế.
 *
 *   DRAFT → OPEN ─┬─→ ANSWERED → CLOSED
 *                 └─→ REJECTED            (e.g. duplicate, out-of-scope)
 */

import type { Workflow } from "./types";

export type RfiState =
  | "DRAFT"
  | "OPEN"
  | "ANSWERED"
  | "REJECTED"
  | "CLOSED";

export const rfiWorkflow: Workflow<RfiState> = {
  name: "RFI",
  initial: "DRAFT",
  terminal: ["CLOSED", "REJECTED"],
  transitions: [
    {
      from: "DRAFT",
      to: "OPEN",
      action: "Gửi yêu cầu",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
      ref: "NĐ 06/2021 Điều 19",
    },
    {
      from: "OPEN",
      to: "ANSWERED",
      action: "Trả lời",
      allowedRoles: ["TU_VAN_THIET_KE", "TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
      guard: (_actor, payload: any) =>
        (payload?.answer && payload.answer.trim().length > 0) ||
        "Câu trả lời không được để trống",
    },
    {
      from: "OPEN",
      to: "REJECTED",
      action: "Bác bỏ",
      allowedRoles: ["TU_VAN_THIET_KE", "TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
      guard: (_actor, payload: any) =>
        (payload?.reason && payload.reason.trim().length > 0) ||
        "Lý do bác bỏ là bắt buộc",
    },
    {
      from: "ANSWERED",
      to: "CLOSED",
      action: "Đóng RFI",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "ANSWERED",
      to: "OPEN",
      action: "Yêu cầu làm rõ thêm",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
  ],
};
