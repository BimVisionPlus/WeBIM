/**
 * Compliance auto-checker — Atlas Compliance module 04.
 *
 * Given a project + a list of standards (TCVN/QCVN) + the project's
 * known artifacts (NCR descriptions, recent submittals, daily-log notes),
 * AI assesses how well the project complies with each standard.
 *
 * Output per standard:
 *   - score (0..100)
 *   - status: COMPLIANT | PARTIAL | NON_COMPLIANT | NO_DATA
 *   - findings: 0-4 short bullets pointing to specific clauses
 *   - recommendations: 1-2 actionable items
 */

import { chat } from "../llm";
import type { AiResult } from "../types";

export type ComplianceCheckInput = {
  projectKey: string;
  projectName: string;
  standards: Array<{
    code: string; // "QCVN 06:2022/BXD"
    title: string;
    rules: Array<{ clauseRef: string; title: string; severity: string }>;
  }>;
  artifacts: {
    ncrs: Array<{ title: string; qcvnRef: string | null; severity: string; rectified: boolean }>;
    submittals: Array<{ specSection: string | null; materialName: string; decision: string | null }>;
    incidents: Array<{ category: string; severity: string; description: string }>;
    pcccPrepsCompleted: number;
    sxdPrepsCompleted: number;
    openAuditPreps: number;
  };
};

export type StandardScore = {
  code: string;
  title: string;
  score: number; // 0-100
  status: "COMPLIANT" | "PARTIAL" | "NON_COMPLIANT" | "NO_DATA";
  findings: string[];
  recommendations: string[];
};

export type ComplianceCheckOutput = {
  overallScore: number;
  overallStatus: StandardScore["status"];
  standards: StandardScore[];
  summary: string; // VN paragraph
  source: "ai" | "fallback";
  model?: string;
  latencyMs?: number;
};

export async function checkCompliance(input: ComplianceCheckInput): Promise<AiResult<ComplianceCheckOutput>> {
  // Baseline: deterministic score per standard based on artifact counts.
  const baselineScores: StandardScore[] = input.standards.map((s) => {
    const refRegex = new RegExp(s.code.replace(/[^A-Za-z0-9]/g, "[\\s-/]?"), "i");
    const linkedNcrs = input.artifacts.ncrs.filter((n) => n.qcvnRef && refRegex.test(n.qcvnRef));
    const unresolved = linkedNcrs.filter((n) => !n.rectified).length;
    let score = 100;
    let status: StandardScore["status"] = "COMPLIANT";
    if (linkedNcrs.length === 0 && input.artifacts.ncrs.length > 0) {
      score = 75;
      status = "PARTIAL";
    } else if (unresolved >= 3) {
      score = 40;
      status = "NON_COMPLIANT";
    } else if (unresolved >= 1) {
      score = 70;
      status = "PARTIAL";
    }
    const findings = linkedNcrs.length
      ? [`${linkedNcrs.length} NCR liên quan đến ${s.code} (${unresolved} chưa xử lý)`]
      : ["Chưa có NCR ghi nhận với tiêu chuẩn này"];
    return {
      code: s.code, title: s.title, score, status,
      findings,
      recommendations: status === "NON_COMPLIANT" ? ["Họp BĐH rà soát + lập kế hoạch khắc phục"] : ["Duy trì kiểm tra định kỳ"],
    };
  });

  const sys = [
    "Bạn là chuyên viên compliance xây dựng tại VN.",
    "Đánh giá mức tuân thủ tiêu chuẩn TCVN/QCVN của 1 dự án dựa trên dữ liệu artifacts.",
    "Output JSON: {\"summary\":\"đoạn ngắn\",\"standards\":[{\"code\":\"\",\"score\":0-100,\"status\":\"COMPLIANT|PARTIAL|NON_COMPLIANT|NO_DATA\",\"findings\":[\"\"],\"recommendations\":[\"\"]}]}",
    "Quy tắc: findings ≤ 3, recommendations ≤ 2, summary 60-100 từ.",
    "Không bịa số liệu — chỉ dùng artifacts được cung cấp.",
    "Status COMPLIANT khi score ≥ 85; PARTIAL khi 60-84; NON_COMPLIANT khi < 60; NO_DATA khi không đủ artifacts.",
  ].join(" ");

  const stdList = input.standards.map((s) =>
    `- ${s.code} (${s.title}); ${s.rules.length} điều khoản chính: ${s.rules.slice(0, 3).map((r) => r.clauseRef).join(", ")}`
  ).join("\n");

  const ncrList = input.artifacts.ncrs.slice(0, 10).map((n) =>
    `  - ${n.title}; QCVN ref: ${n.qcvnRef ?? "—"}; sev: ${n.severity}; ${n.rectified ? "đã xử lý" : "chưa xử lý"}`
  ).join("\n") || "  (không có NCR)";

  const userCtx = [
    `Dự án: ${input.projectKey} — ${input.projectName}`,
    "",
    `Tiêu chuẩn áp dụng (${input.standards.length}):`,
    stdList,
    "",
    `Artifacts:`,
    `- Tổng NCR: ${input.artifacts.ncrs.length}`,
    ncrList,
    `- Submittal: ${input.artifacts.submittals.length} đã trình duyệt`,
    `- Sự cố ATLĐ: ${input.artifacts.incidents.length}`,
    `- PC07 prep hoàn thành: ${input.artifacts.pcccPrepsCompleted}`,
    `- Sở XD prep hoàn thành: ${input.artifacts.sxdPrepsCompleted}`,
    `- Audit prep đang mở: ${input.artifacts.openAuditPreps}`,
    "",
    "Đánh giá tuân thủ từng tiêu chuẩn + summary tổng.",
  ].join("\n");

  const r = await chat([{ role: "system", content: sys }, { role: "user", content: userCtx }], {
    format: "json", temperature: 0.15, timeoutMs: 35_000,
  });

  if (!r.ok) {
    const overall = baselineScores.length
      ? Math.round(baselineScores.reduce((s, st) => s + st.score, 0) / baselineScores.length)
      : 0;
    return {
      ok: true, model: "fallback", latencyMs: r.latencyMs,
      data: {
        overallScore: overall,
        overallStatus: overall >= 85 ? "COMPLIANT" : overall >= 60 ? "PARTIAL" : overall > 0 ? "NON_COMPLIANT" : "NO_DATA",
        standards: baselineScores,
        summary: `Đánh giá baseline: ${baselineScores.length} tiêu chuẩn áp dụng, điểm trung bình ${overall}/100. AI đang ngoại tuyến — đây là kết quả tính toán cơ bản.`,
        source: "fallback",
        latencyMs: r.latencyMs,
      },
    };
  }

  try {
    const parsed = JSON.parse(r.data);
    const validStatuses: StandardScore["status"][] = ["COMPLIANT", "PARTIAL", "NON_COMPLIANT", "NO_DATA"];
    const standards: StandardScore[] = (Array.isArray(parsed.standards) ? parsed.standards : []).map((s: any): StandardScore => ({
      code: String(s.code ?? ""),
      title: input.standards.find((x) => x.code === s.code)?.title ?? String(s.title ?? ""),
      score: Math.max(0, Math.min(100, Number(s.score ?? 0))),
      status: validStatuses.includes(s.status) ? s.status : "NO_DATA",
      findings: Array.isArray(s.findings) ? s.findings.slice(0, 4).map(String) : [],
      recommendations: Array.isArray(s.recommendations) ? s.recommendations.slice(0, 3).map(String) : [],
    }));
    const overall = standards.length
      ? Math.round(standards.reduce((s, st) => s + st.score, 0) / standards.length)
      : 0;
    const overallStatus = overall >= 85 ? "COMPLIANT" : overall >= 60 ? "PARTIAL" : overall > 0 ? "NON_COMPLIANT" : "NO_DATA";

    return {
      ok: true, model: r.model, latencyMs: r.latencyMs,
      data: {
        overallScore: overall,
        overallStatus,
        standards: standards.length ? standards : baselineScores,
        summary: String(parsed.summary ?? "").slice(0, 1000),
        source: "ai",
        model: r.model,
        latencyMs: r.latencyMs,
      },
    };
  } catch {
    return {
      ok: true, model: r.model, latencyMs: r.latencyMs,
      data: {
        overallScore: 0, overallStatus: "NO_DATA",
        standards: baselineScores,
        summary: "AI trả về JSON không hợp lệ — dùng baseline.",
        source: "fallback",
        latencyMs: r.latencyMs,
      },
    };
  }
}
