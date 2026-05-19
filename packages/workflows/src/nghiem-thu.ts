/**
 * Nghiệm thu — Statutory acceptance per NĐ 06/2021/NĐ-CP.
 *
 *   Ba cấp:
 *     • CONG_VIEC   — Nghiệm thu công việc xây dựng       (Điều 21)
 *     • GIAI_DOAN   — Nghiệm thu giai đoạn / bộ phận       (Điều 22)
 *     • HOAN_THANH  — Nghiệm thu hoàn thành công trình     (Điều 23)
 *
 *   Đường đi (cùng dùng cho cả 3 cấp):
 *
 *     DRAFT → SCHEDULED → IN_PROGRESS ─┬─→ SIGNED → FINALIZED
 *                                       └─→ REJECTED → REWORK → SCHEDULED
 *
 *   Guard quan trọng: chuyển sang SIGNED yêu cầu đủ chữ ký của CĐT + TVGS + NT
 *   (NĐ 06 yêu cầu tối thiểu các bên này). Với nghiệm thu HOÀN_THÀNH cấp 3
 *   (Điều 23) còn cần TV_THIET_KE.
 */

import type { Workflow } from "./types";

export type AcceptanceState =
  | "DRAFT"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "SIGNED"
  | "FINALIZED"
  | "REJECTED"
  | "REWORK";

type AcceptanceLevel = "CONG_VIEC" | "GIAI_DOAN" | "HOAN_THANH";

type SignoffSummary = {
  level: AcceptanceLevel;
  signed: Array<"CHU_DAU_TU" | "TU_VAN_GIAM_SAT" | "TU_VAN_THIET_KE" | "NHA_THAU_CHINH">;
};

function requiredSignoffsFor(level: AcceptanceLevel) {
  switch (level) {
    case "CONG_VIEC":
      return ["TU_VAN_GIAM_SAT", "NHA_THAU_CHINH"] as const;
    case "GIAI_DOAN":
      return ["CHU_DAU_TU", "TU_VAN_GIAM_SAT", "NHA_THAU_CHINH"] as const;
    case "HOAN_THANH":
      return ["CHU_DAU_TU", "TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE", "NHA_THAU_CHINH"] as const;
  }
}

export const acceptanceWorkflow: Workflow<AcceptanceState> = {
  name: "Acceptance",
  initial: "DRAFT",
  terminal: ["FINALIZED"],
  transitions: [
    {
      from: "DRAFT",
      to: "SCHEDULED",
      action: "Đặt lịch nghiệm thu",
      allowedRoles: ["NHA_THAU_CHINH", "TU_VAN_GIAM_SAT"],
      guard: (_actor, payload: any) =>
        payload?.scheduledAt ? true : "Bắt buộc có ngày giờ nghiệm thu",
      ref: "NĐ 06/2021 Điều 21–23",
    },
    {
      from: "SCHEDULED",
      to: "IN_PROGRESS",
      action: "Bắt đầu nghiệm thu hiện trường",
      allowedRoles: ["TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
    },
    {
      from: "IN_PROGRESS",
      to: "SIGNED",
      action: "Hoàn tất ký",
      allowedRoles: ["TU_VAN_GIAM_SAT", "CHU_DAU_TU", "NHA_THAU_CHINH"],
      guard: (_actor, payload: any) => {
        const summary = payload as SignoffSummary | undefined;
        if (!summary) return "Thiếu thông tin chữ ký";
        const required = requiredSignoffsFor(summary.level);
        const missing = required.filter((r) => !summary.signed.includes(r as any));
        if (missing.length === 0) return true;
        return `Thiếu chữ ký của: ${missing.join(", ")}`;
      },
    },
    {
      from: "IN_PROGRESS",
      to: "REJECTED",
      action: "Không đạt — từ chối",
      allowedRoles: ["TU_VAN_GIAM_SAT", "CHU_DAU_TU"],
      guard: (_actor, payload: any) =>
        (payload?.rejectionNote && payload.rejectionNote.trim().length > 0) ||
        "Bắt buộc có biên bản lý do không đạt",
    },
    {
      from: "REJECTED",
      to: "REWORK",
      action: "Nhà thầu khắc phục",
      allowedRoles: ["NHA_THAU_CHINH"],
    },
    {
      from: "REWORK",
      to: "SCHEDULED",
      action: "Đặt lại lịch nghiệm thu",
      allowedRoles: ["NHA_THAU_CHINH"],
    },
    {
      from: "SIGNED",
      to: "FINALIZED",
      action: "Hoàn tất hồ sơ (lưu vào hồ sơ hoàn công)",
      allowedRoles: ["CHU_DAU_TU"],
      ref: "NĐ 06/2021 Điều 24 — lưu trữ hồ sơ",
    },
  ],
};

export { requiredSignoffsFor };
export type { AcceptanceLevel, SignoffSummary };
