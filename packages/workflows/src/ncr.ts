/**
 * NCR — Non-Conformance Report (Phiếu sai khác chất lượng).
 * Anchor: NĐ 06/2021 Điều 12 — quản lý chất lượng thi công xây dựng.
 *         TVGS phát hành NCR khi phát hiện sai khác với TKBVTC/QCVN/TCVN.
 *
 *   DRAFT → OPEN → ROOT_CAUSE → CAR_PROPOSED → CAR_APPROVED
 *                                                      ↓
 *                                                  RECTIFIED → VERIFIED → CLOSED
 *                              (REJECTED branch from CAR_PROPOSED)
 */

import type { Workflow } from "./types";

export type NcrState =
  | "DRAFT"
  | "OPEN"
  | "ROOT_CAUSE"
  | "CAR_PROPOSED"
  | "CAR_APPROVED"
  | "RECTIFIED"
  | "VERIFIED"
  | "CLOSED"
  | "REJECTED";

export const ncrWorkflow: Workflow<NcrState> = {
  name: "NCR",
  initial: "DRAFT",
  terminal: ["CLOSED", "REJECTED"],
  transitions: [
    {
      from: "DRAFT",
      to: "OPEN",
      action: "Phát hành NCR",
      allowedRoles: ["TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
      ref: "NĐ 06/2021 Điều 12",
    },
    {
      from: "OPEN",
      to: "ROOT_CAUSE",
      action: "Nhà thầu xác nhận điều tra nguyên nhân",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "ROOT_CAUSE",
      to: "CAR_PROPOSED",
      action: "Đề xuất biện pháp khắc phục (CAR)",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
      guard: (_actor, payload: any) =>
        (payload?.correctiveAction && payload.correctiveAction.trim().length > 0) ||
        "Biện pháp khắc phục là bắt buộc",
    },
    {
      from: "CAR_PROPOSED",
      to: "CAR_APPROVED",
      action: "TVGS chấp thuận biện pháp",
      allowedRoles: ["TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
    },
    {
      from: "CAR_PROPOSED",
      to: "ROOT_CAUSE",
      action: "Yêu cầu sửa lại biện pháp",
      allowedRoles: ["TU_VAN_GIAM_SAT"],
    },
    {
      from: "CAR_APPROVED",
      to: "RECTIFIED",
      action: "Khắc phục xong, sẵn sàng nghiệm thu lại",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
      guard: (_actor, payload: any) =>
        Array.isArray(payload?.photoEvidence) && payload.photoEvidence.length > 0
          ? true
          : "Bắt buộc kèm ảnh hiện trạng sau khắc phục",
    },
    {
      from: "RECTIFIED",
      to: "VERIFIED",
      action: "TVGS kiểm tra & xác nhận",
      allowedRoles: ["TU_VAN_GIAM_SAT"],
    },
    {
      from: "RECTIFIED",
      to: "CAR_APPROVED",
      action: "Khắc phục chưa đạt — làm lại",
      allowedRoles: ["TU_VAN_GIAM_SAT"],
    },
    {
      from: "VERIFIED",
      to: "CLOSED",
      action: "Đóng NCR",
      allowedRoles: ["TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
    },
    {
      from: "OPEN",
      to: "REJECTED",
      action: "Bác bỏ NCR (không có cơ sở)",
      allowedRoles: ["CHU_DAU_TU"],
      guard: (_actor, payload: any) =>
        (payload?.reason && payload.reason.trim().length > 0) ||
        "Phải nêu lý do bác bỏ",
    },
  ],
};
