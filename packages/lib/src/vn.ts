/**
 * Vietnam-specific helpers used across Atlas AEC.
 */

const VND = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function formatVnd(amount: number | bigint | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return VND.format(typeof amount === "bigint" ? Number(amount) : amount);
}

/** Short form: 1.850.000.000.000 → "1,85 tỉ" / "48,7 tỉ" / "324,5 tỉ" */
export function formatVndShort(amount: number | bigint | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "bigint" ? Number(amount) : amount;
  if (n >= 1e12) return `${(n / 1e12).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} nghìn tỉ`;
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỉ`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} k`;
  return n.toLocaleString("vi-VN");
}

/** Validate Vietnamese MST (Mã số thuế). 10 digits, or 10-3 for branches. */
export function isValidMst(mst: string): boolean {
  return /^\d{10}(-\d{3})?$/.test(mst.trim());
}

/** Vietnamese-friendly date formatting. */
export function formatDateVn(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTimeVn(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Hôm qua", "Hôm nay", "Ngày mai", or absolute date. */
export function relativeDateVn(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === -1) return "Hôm qua";
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff > 1 && diff <= 7) return `Trong ${diff} ngày`;
  if (diff < -1 && diff >= -7) return `${-diff} ngày trước`;
  return formatDateVn(date);
}

/** Org type → Vietnamese display label. */
export const orgTypeLabel: Record<string, string> = {
  CHU_DAU_TU: "Chủ đầu tư",
  TU_VAN_GIAM_SAT: "Tư vấn giám sát",
  TU_VAN_THIET_KE: "Tư vấn thiết kế",
  NHA_THAU_CHINH: "Nhà thầu chính",
  NHA_THAU_PHU: "Nhà thầu phụ",
  NHA_CUNG_CAP: "Nhà cung cấp",
  CO_QUAN_NHA_NUOC: "Cơ quan nhà nước",
};

/** Discipline → Vietnamese display label. */
export const disciplineLabel: Record<string, string> = {
  KIEN_TRUC: "Kiến trúc",
  KET_CAU: "Kết cấu",
  CO_DIEN_M: "Cơ điện (M)",
  CO_DIEN_E: "Cơ điện (E)",
  CO_DIEN_P: "Cơ điện (P)",
  PCCC: "PCCC",
  CANH_QUAN: "Cảnh quan",
  HA_TANG: "Hạ tầng",
  NOI_THAT: "Nội thất",
};

/** Issue type → Vietnamese display label + Atlas key prefix. */
export const issueTypeMeta: Record<string, { label: string; prefix: string; color: string }> = {
  TASK: { label: "Công việc", prefix: "TASK", color: "#64748b" },
  RFI: { label: "RFI — Yêu cầu làm rõ", prefix: "RFI", color: "#3b82f6" },
  SUBMITTAL: { label: "Submittal — Đệ trình vật liệu", prefix: "SUB", color: "#8b5cf6" },
  NCR: { label: "NCR — Phiếu sai khác", prefix: "NCR", color: "#ef4444" },
  PUNCH: { label: "Punch — Lỗi tồn đọng", prefix: "PUNCH", color: "#f59e0b" },
  CHANGE_ORDER: { label: "Lệnh thay đổi", prefix: "CO", color: "#10b981" },
  SAFETY: { label: "ATLĐ — An toàn lao động", prefix: "SAFE", color: "#dc2626" },
};

/**
 * Compute VAT + retention for a progress-payment claim.
 * NĐ 10/2021 + practice: VAT 8% (giảm tạm theo NQ Quốc hội) hoặc 10%,
 * giữ lại 5% bảo hành (thông lệ), TNDN tạm thu 1% không tính ở đây.
 */
export function computePayment(workDoneVnd: bigint, vatRate = 8, retentionPct = 5) {
  const vat = (workDoneVnd * BigInt(vatRate)) / 100n;
  const retention = (workDoneVnd * BigInt(retentionPct)) / 100n;
  const net = workDoneVnd + vat - retention;
  return { vat, retention, net };
}
