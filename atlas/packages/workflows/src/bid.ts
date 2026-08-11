/**
 * Bid workflow — WinWork module.
 *
 * Anchor: Luật Đấu thầu 22/2023, Điều 43 (quy trình lựa chọn nhà thầu),
 * Điều 14 (bảo đảm dự thầu), Điều 75 (bảo đảm thực hiện hợp đồng).
 *
 *   DRAFT → ESTIMATING → READY → SUBMITTED → OPENED → ─┬─→ AWARDED → CLOSED
 *                                                       ├─→ LOST     → CLOSED
 *                                                       └─→ CANCELLED → CLOSED
 *
 *   Side branches: WITHDRAWN (rút HSDT) from any pre-OPENED state.
 *
 * Transitions are guarded by org-role + compliance status. To move
 * READY → SUBMITTED, all BLOCKING BidComplianceCheck rows must be PASS.
 */

import type { Workflow } from "./types";

export type BidState =
  | "DRAFT"
  | "ESTIMATING"
  | "READY"
  | "SUBMITTED"
  | "OPENED"
  | "AWARDED"
  | "LOST"
  | "CANCELLED"
  | "WITHDRAWN"
  | "CLOSED";

export const bidWorkflow: Workflow<BidState> = {
  name: "BID",
  initial: "DRAFT",
  terminal: ["CLOSED"],
  transitions: [
    {
      from: "DRAFT",
      to: "ESTIMATING",
      action: "Bắt đầu lập dự toán",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "ESTIMATING",
      to: "READY",
      action: "Sẵn sàng nộp",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
      guard: (_actor, payload: any) =>
        (typeof payload?.proposedValueVnd === "number" && payload.proposedValueVnd > 0) ||
        "Phải có giá dự thầu trước khi đánh dấu sẵn sàng",
    },
    {
      from: "READY",
      to: "SUBMITTED",
      action: "Nộp hồ sơ dự thầu",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
      ref: "Luật ĐT 22/2023 Điều 43",
      guard: (_actor, payload: any) =>
        payload?.complianceClean === true ||
        "Còn quy định BLOCKING chưa đạt — không nộp được",
    },
    {
      from: "SUBMITTED",
      to: "OPENED",
      action: "Mở thầu",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "OPENED",
      to: "AWARDED",
      action: "Trúng thầu",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "OPENED",
      to: "LOST",
      action: "Trượt thầu",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "OPENED",
      to: "CANCELLED",
      action: "Huỷ thầu",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "AWARDED",
      to: "CLOSED",
      action: "Đóng hồ sơ",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "LOST",
      to: "CLOSED",
      action: "Đóng hồ sơ",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "CANCELLED",
      to: "CLOSED",
      action: "Đóng hồ sơ",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    // Withdraw branch — allowed before tender opening
    {
      from: "DRAFT",
      to: "WITHDRAWN",
      action: "Rút HSDT",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "ESTIMATING",
      to: "WITHDRAWN",
      action: "Rút HSDT",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "READY",
      to: "WITHDRAWN",
      action: "Rút HSDT",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "SUBMITTED",
      to: "WITHDRAWN",
      action: "Rút HSDT",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
      ref: "Luật ĐT 22/2023 Điều 14 khoản 5",
    },
    {
      from: "WITHDRAWN",
      to: "CLOSED",
      action: "Đóng hồ sơ",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
  ],
};
