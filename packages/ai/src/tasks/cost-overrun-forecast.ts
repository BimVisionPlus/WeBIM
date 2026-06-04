/**
 * Cost overrun forecaster — Atlas Cost module 03.
 *
 * Inputs:
 *   - BoQ contract value (BAC = Budget At Completion)
 *   - BoQ lines with qtyCompleted vs total qty (EV = Earned Value)
 *   - ProgressPayments paid to date (AC = Actual Cost)
 *   - ScheduleTask aggregate progress (SPI baseline)
 *
 * Pipeline:
 *   1. Deterministic EVM computation (BAC/EV/AC/CPI/SPI/EAC/VAC).
 *      EAC = BAC / CPI (assumes future will track current cost-perf).
 *      EAC_t = AC + (BAC - EV) / (CPI × SPI) (time-and-cost-adjusted).
 *   2. LLM combines numbers with category breakdown + writes VN
 *      explanation + 2-3 risk drivers + recommended action.
 *   3. Returns {bac, ev, ac, cpi, spi, eac, eacTimeAdjusted, vac, vacPct,
 *      severity, explanation, drivers, action, source, baseline}.
 *
 * Threshold logic (deterministic baseline always returns):
 *   - CPI < 0.95 → WATCH
 *   - CPI < 0.90 → ELEVATED
 *   - CPI < 0.85 → CRITICAL
 *   - VAC > 5% of BAC → at least WATCH regardless of CPI bucket
 */

import { chat } from "../llm";
import type { AiResult } from "../types";

export type EvmInputs = {
  bac: number; // VND
  boqLines: Array<{ category: string; totalVnd: number; doneVnd: number }>;
  acVnd: number; // sum of paid progress payments
  scheduleProgressPct: number; // 0..100 (avg or weighted)
  expectedScheduleProgressPct: number; // 0..100 by today vs plan
};

export type CostOverrunOutput = {
  bac: number;
  ev: number;
  ac: number;
  cpi: number;
  spi: number;
  eac: number;
  eacTimeAdjusted: number;
  vac: number;
  vacPct: number; // signed; negative = overrun
  severity: "ON_TRACK" | "WATCH" | "ELEVATED" | "CRITICAL";
  topCategories: Array<{ category: string; donePct: number; valueVnd: number }>;
  drivers: string[]; // VN, short
  explanation: string; // VN paragraph
  action: string; // VN recommended action
  source: "ai" | "fallback";
  model?: string;
  latencyMs?: number;
};

export function baselineEvm(i: EvmInputs): {
  bac: number;
  ev: number;
  ac: number;
  cpi: number;
  spi: number;
  eac: number;
  eacTimeAdjusted: number;
  vac: number;
  vacPct: number;
  severity: CostOverrunOutput["severity"];
  topCategories: CostOverrunOutput["topCategories"];
} {
  const bac = Math.max(0, i.bac);
  const ev = i.boqLines.reduce((s, l) => s + Math.max(0, l.doneVnd), 0);
  const ac = Math.max(0, i.acVnd);
  // Avoid /0; treat <1k VND as 0
  const cpi = ac < 1000 ? 1 : ev / ac;
  const pv = bac * (i.expectedScheduleProgressPct / 100);
  const spi = pv < 1000 ? 1 : ev / pv;
  const eac = cpi < 0.01 ? bac : bac / cpi;
  const eacTimeAdjusted = cpi * spi < 0.01 ? bac : ac + (bac - ev) / (cpi * spi);
  const vac = bac - eac;
  const vacPct = bac < 1000 ? 0 : (vac / bac) * 100;

  let severity: CostOverrunOutput["severity"] = "ON_TRACK";
  if (cpi < 0.85 || vacPct < -10) severity = "CRITICAL";
  else if (cpi < 0.9 || vacPct < -5) severity = "ELEVATED";
  else if (cpi < 0.95 || vacPct < -2) severity = "WATCH";

  // Top 3 categories by remaining value
  const byCat = new Map<string, { donePct: number; valueVnd: number }>();
  for (const l of i.boqLines) {
    const cur = byCat.get(l.category) ?? { donePct: 0, valueVnd: 0 };
    cur.valueVnd += l.totalVnd;
    byCat.set(l.category, cur);
  }
  for (const [cat, cur] of byCat) {
    const lines = i.boqLines.filter((l) => l.category === cat);
    const total = lines.reduce((s, l) => s + l.totalVnd, 0);
    const done = lines.reduce((s, l) => s + l.doneVnd, 0);
    cur.donePct = total < 1 ? 0 : (done / total) * 100;
    byCat.set(cat, cur);
  }
  const topCategories = Array.from(byCat.entries())
    .sort((a, b) => b[1].valueVnd - a[1].valueVnd)
    .slice(0, 5)
    .map(([category, v]) => ({ category, donePct: Math.round(v.donePct), valueVnd: v.valueVnd }));

  return { bac, ev, ac, cpi, spi, eac, eacTimeAdjusted, vac, vacPct, severity, topCategories };
}

export async function forecastCostOverrun(i: EvmInputs): Promise<AiResult<CostOverrunOutput>> {
  const b = baselineEvm(i);

  const sys = [
    "Bạn là chuyên viên Cost Control tại công trường XDDD VN.",
    "Phân tích chỉ số EVM của 1 dự án + dự báo cost overrun. JSON output.",
    "Schema: {\"drivers\":[\"bullet\",...],\"explanation\":\"đoạn ngắn\",\"action\":\"đề xuất\"}",
    "Quy tắc: drivers ≤ 3 bullet ≤ 18 từ. explanation 50-90 từ. action ≤ 40 từ.",
    "Không bịa số. Tiếng Việt. Nêu category cụ thể nếu thấy bất thường.",
    "Nếu CPI >= 0.95 và VAC% >= -2%, drivers chỉ ra 'Đang trong tầm kiểm soát' + action duy trì.",
  ].join(" ");

  const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));
  const ctx = [
    `Giá trị hợp đồng (BAC): ${fmt(b.bac)} VND`,
    `Giá trị đã thực hiện (EV): ${fmt(b.ev)} VND`,
    `Chi phí đã chi (AC, đã thanh toán): ${fmt(b.ac)} VND`,
    `CPI = EV/AC = ${b.cpi.toFixed(3)} ${b.cpi >= 1 ? "(tiết kiệm)" : "(vượt chi)"}`,
    `SPI = EV/PV = ${b.spi.toFixed(3)} ${b.spi >= 1 ? "(đúng/sớm tiến độ)" : "(chậm tiến độ)"}`,
    `EAC = BAC/CPI = ${fmt(b.eac)} VND (ước tính tổng chi phí khi hoàn thành)`,
    `EAC điều chỉnh thời gian = ${fmt(b.eacTimeAdjusted)} VND`,
    `VAC = BAC - EAC = ${fmt(b.vac)} VND (${b.vacPct.toFixed(1)}%)`,
    `Severity baseline: ${b.severity}`,
    "",
    `Top hạng mục theo giá trị BoQ:`,
    ...b.topCategories.map((c) => `  - ${c.category}: ${fmt(c.valueVnd)} VND, đã thực hiện ${c.donePct}%`),
  ].join("\n");

  const r = await chat([{ role: "system", content: sys }, { role: "user", content: ctx + "\n\nPhân tích, dự báo overrun, đề xuất hành động." }], {
    format: "json", temperature: 0.15, timeoutMs: 30_000,
  });

  if (!r.ok) {
    const explanation = b.severity === "ON_TRACK"
      ? `Dự án trong tầm kiểm soát chi phí. CPI=${b.cpi.toFixed(2)}, dự kiến tổng chi phí khi hoàn thành ≈ ${fmt(b.eac)} VND.`
      : `Dự án có dấu hiệu vượt chi: CPI=${b.cpi.toFixed(2)}, ước tính chi vượt ${fmt(-b.vac)} VND (${(-b.vacPct).toFixed(1)}%). Cần rà soát chi tiết các hạng mục có % thực hiện thấp + AC cao.`;
    return {
      ok: true,
      model: "fallback",
      latencyMs: r.latencyMs,
      data: {
        ...b,
        drivers: b.severity === "ON_TRACK" ? ["Trong tầm kiểm soát"] : [`CPI=${b.cpi.toFixed(2)} < 0.95`],
        explanation,
        action: b.severity === "ON_TRACK" ? "Duy trì kế hoạch hiện tại." : "Họp Ban điều hành rà soát từng hạng mục có vacPct âm.",
        source: "fallback",
        latencyMs: r.latencyMs,
      },
    };
  }

  try {
    const parsed = JSON.parse(r.data);
    const drivers = Array.isArray(parsed.drivers) ? parsed.drivers.slice(0, 4).map(String) : [];
    return {
      ok: true,
      model: r.model,
      latencyMs: r.latencyMs,
      data: {
        ...b,
        drivers,
        explanation: String(parsed.explanation ?? "").slice(0, 1000),
        action: String(parsed.action ?? "").slice(0, 500),
        source: "ai",
        model: r.model,
        latencyMs: r.latencyMs,
      },
    };
  } catch {
    return {
      ok: true,
      model: r.model,
      latencyMs: r.latencyMs,
      data: {
        ...b,
        drivers: ["AI trả về JSON không hợp lệ — dùng baseline"],
        explanation: "Dùng đánh giá baseline EVM. Vui lòng xem chỉ số CPI/SPI/VAC ở trên.",
        action: "Họp Ban điều hành rà soát chi tiết.",
        source: "fallback",
        latencyMs: r.latencyMs,
      },
    };
  }
}
