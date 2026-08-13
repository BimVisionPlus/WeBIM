// ÁP ĐƠN GIÁ — nhân khối lượng với đơn giá để ra con số sơ bộ.
//
// Đây là *ước tính sơ bộ theo khối lượng mô hình*, không phải dự toán. Khoảng
// cách giữa hai thứ đó không nhỏ và không thu hẹp được bằng cách nhập đơn giá
// kỹ hơn:
//
//   - Khối lượng lấy từ hình học đã mô hình hoá. Thứ chưa mô hình thì không có
//     trong bảng, và một mô hình phương án thiếu rất nhiều: móng, cốt thép,
//     MEP, hoàn thiện, phá dỡ, đất đắp.
//   - Đơn giá ở đây là đơn giá tổng hợp người dùng tự nhập. Dự toán Việt Nam
//     đi theo định mức (TT 12/2021/TT-BXD và bộ đơn giá địa phương), tách vật
//     liệu / nhân công / máy, rồi cộng trực tiếp phí, chung, thu nhập chịu
//     thuế tính trước, thuế và dự phòng.
//
// Nên module này trả về cả `covered` lẫn `uncovered`: dòng khối lượng nào chưa
// có đơn giá phải hiện ra, chứ không được lặng lẽ tính bằng 0. Một tổng tiền
// đang giấu mười dòng chưa có giá thì tệ hơn là không có tổng nào.

import type { NativeBimProject } from "../domain/project";
import { qtoRows, qtoSummary, type QtoRow } from "./qto";

/** Đơn giá theo cặp (category, material, unit) — đúng khoá của qtoSummary. */
export interface RateKey {
  category: string;
  material: string;
  unit: string;
}

export type RateBook = Record<string, number>;

export function rateKey(row: RateKey): string {
  return `${row.category}|${row.material}|${row.unit}`;
}

export interface PricedRow extends QtoRow {
  key: string;
  /** VND trên một đơn vị. null = chưa nhập. */
  rate: number | null;
  /** VND. null khi chưa có đơn giá — khác hẳn với 0 đồng. */
  amount: number | null;
}

export interface PricingResult {
  rows: PricedRow[];
  /** Tổng của những dòng ĐÃ có đơn giá. */
  subtotal: number;
  /** Số dòng chưa có đơn giá, và khối lượng của chúng. */
  uncovered: PricedRow[];
  /** Tỉ lệ dòng đã áp giá, 0–1. */
  coverage: number;
}

export function priceProject(
  project: NativeBimProject,
  rates: RateBook,
): PricingResult {
  const rows: PricedRow[] = qtoSummary(qtoRows(project)).map((row) => {
    const key = rateKey(row);
    const rate = typeof rates[key] === "number" && rates[key] > 0 ? rates[key] : null;
    return {
      ...row,
      key,
      rate,
      amount: rate === null ? null : rate * row.quantity,
    };
  });
  const uncovered = rows.filter((row) => row.amount === null);
  return {
    rows,
    subtotal: rows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
    uncovered,
    coverage: rows.length === 0 ? 0 : (rows.length - uncovered.length) / rows.length,
  };
}

/**
 * Các khoản cộng thêm sau chi phí trực tiếp, theo cách dự toán VN vẫn cộng.
 * Đây là *cấu trúc*, không phải tỉ lệ pháp định: tỉ lệ do người dùng nhập, vì
 * chúng đổi theo loại công trình và theo văn bản từng thời kỳ.
 */
export interface Markups {
  /** Chi phí chung, % chi phí trực tiếp. */
  overheadPct: number;
  /** Thu nhập chịu thuế tính trước, % (trực tiếp + chung). */
  profitPct: number;
  /** Thuế GTGT, %. */
  vatPct: number;
  /** Dự phòng, % giá trị sau thuế. */
  contingencyPct: number;
}

export const DEFAULT_MARKUPS: Markups = {
  overheadPct: 0,
  profitPct: 0,
  vatPct: 8,
  contingencyPct: 10,
};

export interface Estimate {
  direct: number;
  overhead: number;
  profit: number;
  beforeVat: number;
  vat: number;
  contingency: number;
  total: number;
}

export function estimate(direct: number, markups: Markups): Estimate {
  const overhead = direct * (markups.overheadPct / 100);
  const profit = (direct + overhead) * (markups.profitPct / 100);
  const beforeVat = direct + overhead + profit;
  const vat = beforeVat * (markups.vatPct / 100);
  const contingency = (beforeVat + vat) * (markups.contingencyPct / 100);
  return {
    direct,
    overhead,
    profit,
    beforeVat,
    vat,
    contingency,
    total: beforeVat + vat + contingency,
  };
}

export function pricingCsv(result: PricingResult, markups: Markups): string {
  const lines = ["category,material,unit,quantity,rate_vnd,amount_vnd"];
  for (const row of result.rows) {
    lines.push(
      [
        row.category,
        row.material,
        row.unit,
        row.quantity.toFixed(4),
        row.rate ?? "",
        row.amount?.toFixed(0) ?? "",
      ].join(","),
    );
  }
  const sums = estimate(result.subtotal, markups);
  lines.push("");
  lines.push(`Chi phi truc tiep,,,,,${sums.direct.toFixed(0)}`);
  lines.push(`Chi phi chung ${markups.overheadPct}%,,,,,${sums.overhead.toFixed(0)}`);
  lines.push(`Thu nhap chiu thue ${markups.profitPct}%,,,,,${sums.profit.toFixed(0)}`);
  lines.push(`VAT ${markups.vatPct}%,,,,,${sums.vat.toFixed(0)}`);
  lines.push(`Du phong ${markups.contingencyPct}%,,,,,${sums.contingency.toFixed(0)}`);
  lines.push(`TONG,,,,,${sums.total.toFixed(0)}`);
  if (result.uncovered.length > 0) {
    lines.push("");
    lines.push(`CHUA CO DON GIA,${result.uncovered.length} dong,,,,`);
    for (const row of result.uncovered) {
      lines.push(`,${row.category},${row.material},${row.unit},${row.quantity.toFixed(4)},`);
    }
  }
  return lines.join("\n");
}
