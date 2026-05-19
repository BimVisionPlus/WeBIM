/**
 * Progress Payment — Thanh toán giai đoạn.
 * Anchor: NĐ 10/2021 quản lý chi phí đầu tư xây dựng,
 *         TT 10/2020/TT-BTC hướng dẫn quyết toán dự án hoàn thành.
 *
 *   DRAFT → SUBMITTED → CDT_REVIEW ─┬─→ APPROVED → PAID
 *                                    └─→ RETURNED  → DRAFT
 */

import type { Workflow } from "./types";

export type PaymentState =
  | "DRAFT"
  | "SUBMITTED"
  | "CDT_REVIEW"
  | "APPROVED"
  | "PAID"
  | "RETURNED";

export const paymentWorkflow: Workflow<PaymentState> = {
  name: "ProgressPayment",
  initial: "DRAFT",
  terminal: ["PAID"],
  transitions: [
    {
      from: "DRAFT",
      to: "SUBMITTED",
      action: "Gửi hồ sơ thanh toán",
      allowedRoles: ["NHA_THAU_CHINH"],
      guard: (_actor, payload: any) => {
        if (!payload?.workDoneVnd) return "Bắt buộc có giá trị khối lượng hoàn thành";
        if (payload.workDoneVnd <= 0) return "Giá trị khối lượng phải > 0";
        return true;
      },
    },
    {
      from: "SUBMITTED",
      to: "CDT_REVIEW",
      action: "CĐT tiếp nhận hồ sơ",
      allowedRoles: ["CHU_DAU_TU", "TU_VAN_GIAM_SAT"],
    },
    {
      from: "CDT_REVIEW",
      to: "APPROVED",
      action: "Phê duyệt thanh toán",
      allowedRoles: ["CHU_DAU_TU"],
    },
    {
      from: "CDT_REVIEW",
      to: "RETURNED",
      action: "Trả lại hồ sơ — yêu cầu bổ sung",
      allowedRoles: ["CHU_DAU_TU", "TU_VAN_GIAM_SAT"],
    },
    {
      from: "RETURNED",
      to: "DRAFT",
      action: "Bổ sung & nộp lại",
      allowedRoles: ["NHA_THAU_CHINH"],
    },
    {
      from: "APPROVED",
      to: "PAID",
      action: "Đã chuyển tiền",
      allowedRoles: ["CHU_DAU_TU"],
    },
  ],
};
