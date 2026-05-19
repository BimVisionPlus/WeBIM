/**
 * Punch list — danh mục lỗi tồn đọng trước khi bàn giao.
 *
 *   OPEN → IN_PROGRESS → READY_FOR_INSPECTION ─┬─→ ACCEPTED → CLOSED
 *                                              └─→ REJECTED → IN_PROGRESS
 */

import type { Workflow } from "./types";

export type PunchState =
  | "OPEN"
  | "IN_PROGRESS"
  | "READY_FOR_INSPECTION"
  | "ACCEPTED"
  | "REJECTED"
  | "CLOSED";

export const punchWorkflow: Workflow<PunchState> = {
  name: "Punch",
  initial: "OPEN",
  terminal: ["CLOSED"],
  transitions: [
    {
      from: "OPEN",
      to: "IN_PROGRESS",
      action: "Bắt đầu sửa",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "IN_PROGRESS",
      to: "READY_FOR_INSPECTION",
      action: "Sẵn sàng kiểm tra lại",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
      guard: (_actor, payload: any) =>
        payload?.photoAfterUrl ? true : "Bắt buộc kèm ảnh sau khi sửa",
    },
    {
      from: "READY_FOR_INSPECTION",
      to: "ACCEPTED",
      action: "Chấp nhận",
      allowedRoles: ["TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
    },
    {
      from: "READY_FOR_INSPECTION",
      to: "REJECTED",
      action: "Không chấp nhận",
      allowedRoles: ["TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
    },
    {
      from: "REJECTED",
      to: "IN_PROGRESS",
      action: "Sửa lại",
      allowedRoles: ["NHA_THAU_CHINH", "NHA_THAU_PHU"],
    },
    {
      from: "ACCEPTED",
      to: "CLOSED",
      action: "Đóng",
      allowedRoles: ["CHU_DAU_TU", "TU_VAN_GIAM_SAT"],
    },
  ],
};
