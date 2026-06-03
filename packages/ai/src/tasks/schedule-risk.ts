/**
 * Schedule slip risk predictor.
 *
 * Inputs: a single ScheduleTask, recent DailyLog data for the project,
 *         (optional) weather forecast for the project locale.
 * Output: { riskPct: 0..100, factors: string[], explanation: string }
 *
 * Implementation:
 *   1. Pure-code feature engineering: time elapsed vs % complete,
 *      days-remaining vs work-remaining, critical-path flag, slip days.
 *   2. LLM (Groq Llama-3.3) is asked to combine factors + weather +
 *      daily-log context into a probability + 2-3 risk factors + a
 *      Vietnamese 1-paragraph explanation.
 *   3. JSON-mode output; on parse-fail or AI disabled, returns the
 *      feature-only deterministic baseline so the UI always works.
 */

import { chat } from "../llm";
import type { AiResult } from "../types";

export type ScheduleRiskInput = {
  task: {
    code: string;
    name: string;
    discipline: string | null;
    zone: string | null;
    plannedStart: Date;
    plannedEnd: Date;
    actualStart: Date | null;
    pctComplete: number;
    state: string;
    isCritical: boolean;
  };
  recentDailyLogs?: Array<{ date: Date; workforce: any; safetyNotes: string | null }>;
  weatherForecastNext7d?: string | null; // free-form summary, e.g. "Mưa lớn 3 ngày, nắng nóng 4 ngày"
};

export type ScheduleRiskOutput = {
  riskPct: number;          // 0..100
  factors: string[];        // 2-4 short Vietnamese bullets
  explanation: string;      // 1 paragraph Vietnamese
  baseline: number;         // deterministic baseline for sanity check
  source: "ai" | "fallback";
  model?: string;
  latencyMs?: number;
};

// Deterministic risk baseline using only schedule math.
export function baselineRisk(t: ScheduleRiskInput["task"]): { score: number; factors: string[] } {
  const factors: string[] = [];
  const now = Date.now();
  const totalMs = t.plannedEnd.getTime() - t.plannedStart.getTime();
  const elapsedMs = Math.max(0, now - t.plannedStart.getTime());
  const expectedPct = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;
  const lagPct = expectedPct - t.pctComplete;
  let score = 0;

  // Already overdue?
  if (now > t.plannedEnd.getTime() && t.state !== "DONE" && t.state !== "CANCELLED") {
    const overdueDays = Math.ceil((now - t.plannedEnd.getTime()) / 86400000);
    score += Math.min(60, 30 + overdueDays * 3);
    factors.push(`Đã quá hạn ${overdueDays} ngày so với kế hoạch`);
  } else if (lagPct > 5) {
    score += Math.min(50, lagPct * 2);
    factors.push(`Tiến độ thực tế chậm ${Math.round(lagPct)}% so với mốc dự kiến`);
  } else if (lagPct < -5) {
    factors.push(`Tiến độ thực tế vượt ${Math.round(-lagPct)}% so với mốc dự kiến`);
  }

  // Critical path multiplier
  if (t.isCritical) {
    score = Math.min(100, score * 1.25);
    if (lagPct > 0) factors.push("Nằm trên đường găng — chậm 1 ngày = dự án chậm 1 ngày");
  }

  // State-based
  if (t.state === "ON_HOLD") {
    score = Math.max(score, 70);
    factors.push("Đang tạm dừng (ON_HOLD)");
  }
  if (t.state === "PLANNED" && now > t.plannedStart.getTime()) {
    const lateDays = Math.ceil((now - t.plannedStart.getTime()) / 86400000);
    score = Math.max(score, 40 + lateDays * 2);
    factors.push(`Đáng lẽ bắt đầu ${lateDays} ngày trước — chưa khởi công`);
  }

  return { score: Math.round(Math.min(100, Math.max(0, score))), factors };
}

export async function assessScheduleRisk(input: ScheduleRiskInput): Promise<AiResult<ScheduleRiskOutput>> {
  const baseline = baselineRisk(input.task);

  // Build a compact LLM prompt
  const sys = [
    "Bạn là chuyên viên kế hoạch tiến độ xây dựng (planner) tại VN.",
    "Phân tích rủi ro chậm tiến độ của 1 task. Trả về JSON đúng schema, tiếng Việt.",
    "Schema: {\"riskPct\":<0-100>,\"factors\":[\"bullet ngắn\",...],\"explanation\":\"1 đoạn\"}",
    "Quy tắc: factors ≤ 4 bullet, mỗi bullet ≤ 18 từ. explanation ≤ 80 từ.",
    "Không bịa số liệu — chỉ dùng dữ liệu đầu vào.",
  ].join(" ");

  const t = input.task;
  const ctx = [
    `Task: ${t.code} — ${t.name}`,
    `Discipline/Zone: ${t.discipline ?? "?"} / ${t.zone ?? "?"}`,
    `Plan: ${t.plannedStart.toISOString().slice(0, 10)} → ${t.plannedEnd.toISOString().slice(0, 10)}`,
    `Actual start: ${t.actualStart ? t.actualStart.toISOString().slice(0, 10) : "chưa bắt đầu"}`,
    `Tiến độ hiện tại: ${Math.round(t.pctComplete)}% — trạng thái ${t.state}`,
    `Critical path: ${t.isCritical ? "CÓ — quyết định tổng tiến độ" : "không"}`,
    `Risk baseline (chỉ tính toán): ${baseline.score}/100`,
    baseline.factors.length ? `Factors baseline: ${baseline.factors.join("; ")}` : "",
  ].filter(Boolean).join("\n");

  const logs = input.recentDailyLogs && input.recentDailyLogs.length
    ? input.recentDailyLogs.slice(0, 7).map((l) => {
        const wf = Array.isArray(l.workforce) ? l.workforce.map((w: any) => `${w.trade}:${w.count}`).join(",") : "?";
        return `  ${l.date.toISOString().slice(0, 10)} workforce=${wf}${l.safetyNotes ? " safety=⚠" : ""}`;
      }).join("\n")
    : "  (không có daily log gần đây)";

  const weather = input.weatherForecastNext7d ?? "(không có dữ liệu thời tiết)";

  const user = `${ctx}\n\nDaily logs 7 ngày gần đây:\n${logs}\n\nThời tiết 7 ngày tới: ${weather}\n\nĐánh giá rủi ro chậm tiến độ.`;

  const r = await chat([{ role: "system", content: sys }, { role: "user", content: user }], {
    format: "json",
    temperature: 0.1,
    timeoutMs: 30_000,
  });

  if (!r.ok) {
    return {
      ok: true,
      data: {
        riskPct: baseline.score,
        factors: baseline.factors.length ? baseline.factors : ["Không đủ dữ liệu để đánh giá"],
        explanation: baseline.factors.length
          ? `Đánh giá theo công thức cơ bản: ${baseline.factors.join(". ")}.`
          : "Chưa đủ dữ liệu để đánh giá rủi ro. Cần ít nhất daily log hoặc dự báo thời tiết.",
        baseline: baseline.score,
        source: "fallback",
      },
      model: "fallback",
      latencyMs: r.latencyMs,
    };
  }

  try {
    const parsed = JSON.parse(r.data);
    const riskPct = Math.max(0, Math.min(100, Math.round(Number(parsed.riskPct ?? baseline.score))));
    const factors = Array.isArray(parsed.factors) ? parsed.factors.slice(0, 4).map(String) : [];
    const explanation = String(parsed.explanation ?? "").slice(0, 1000);
    return {
      ok: true,
      data: { riskPct, factors, explanation, baseline: baseline.score, source: "ai", model: r.model, latencyMs: r.latencyMs },
      model: r.model,
      latencyMs: r.latencyMs,
    };
  } catch {
    return {
      ok: true,
      data: {
        riskPct: baseline.score,
        factors: baseline.factors.length ? baseline.factors : ["AI trả về dữ liệu không hợp lệ — dùng baseline"],
        explanation: "Hệ thống tạm dùng đánh giá baseline do AI trả về JSON không hợp lệ.",
        baseline: baseline.score,
        source: "fallback",
      },
      model: r.model,
      latencyMs: r.latencyMs,
    };
  }
}
