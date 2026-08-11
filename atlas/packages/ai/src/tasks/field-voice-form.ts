/**
 * Atlas Field voice-to-form — module 05.
 *
 * Given transcript of a field worker's voice memo (Vietnamese), the LLM:
 *   1. Classifies the intent into one of 5 types
 *   2. Extracts structured fields per intent type
 *
 * Intents:
 *   - DAILY_LOG   — báo cáo công việc cuối ca
 *   - INCIDENT    — tai nạn / sự cố ATLĐ
 *   - NCR         — phát hiện sai sót chất lượng
 *   - PPE_REPORT  — báo cáo PPE / phát hiện vi phạm
 *   - PROGRESS    — báo tiến độ 1 hạng mục cụ thể
 */

import { chat } from "../llm";
import type { AiResult } from "../types";

export type FieldIntent = "DAILY_LOG" | "INCIDENT" | "NCR" | "PPE_REPORT" | "PROGRESS" | "UNKNOWN";

export type FieldVoiceForm = {
  intent: FieldIntent;
  confidence: number; // 0..1
  // Intent-specific fields (union of all possible)
  zone?: string;
  workDone?: string;
  workforce?: string;
  safetyNotes?: string;
  // INCIDENT
  category?: string;          // ATLĐ / điện / rơi ngã / cháy nổ
  severity?: "MINOR" | "MAJOR" | "CRITICAL" | "NEAR_MISS";
  injured?: number;
  immediateAction?: string;
  // NCR
  ncrTitle?: string;
  qcvnRef?: string;
  rootCause?: string;
  // PPE
  ppeMissing?: string[];
  workerCount?: number;
  // PROGRESS
  taskCode?: string;
  taskName?: string;
  pctComplete?: number;
};

export type FieldVoiceFormOutput = {
  transcript: string;
  form: FieldVoiceForm;
  source: "ai" | "fallback";
  model?: string;
  latencyMs?: number;
};

export async function structureFieldVoice(transcript: string): Promise<AiResult<FieldVoiceFormOutput>> {
  const t = transcript.trim();
  if (t.length < 5) {
    return {
      ok: true, model: "fallback", latencyMs: 0,
      data: {
        transcript: t,
        form: { intent: "UNKNOWN", confidence: 0 },
        source: "fallback",
      },
    };
  }

  const sys = [
    "Bạn là AI phân loại + rút gọn báo cáo của công nhân hiện trường xây dựng VN.",
    "Input: 1 đoạn lời nói (đã chuyển thành chữ). Output JSON đúng schema.",
    "Schema: {\"intent\":\"DAILY_LOG|INCIDENT|NCR|PPE_REPORT|PROGRESS|UNKNOWN\",\"confidence\":0..1,\"zone\":\"\",\"workDone\":\"\",\"workforce\":\"\",\"safetyNotes\":\"\",\"category\":\"\",\"severity\":\"MINOR|MAJOR|CRITICAL|NEAR_MISS\",\"injured\":0,\"immediateAction\":\"\",\"ncrTitle\":\"\",\"qcvnRef\":\"\",\"rootCause\":\"\",\"ppeMissing\":[],\"workerCount\":0,\"taskCode\":\"\",\"taskName\":\"\",\"pctComplete\":0}",
    "Quy tắc:",
    "- Chỉ điền field thuộc về intent đã chọn; field không liên quan để rỗng/0.",
    "- Tiếng Việt. Không bịa.",
    "- INCIDENT: severity=NEAR_MISS nếu không có thương tích.",
    "- PPE_REPORT: ppeMissing có thể chứa 'mũ bảo hộ', 'áo phản quang', 'giày bảo hộ', 'dây an toàn', 'mặt nạ'.",
    "- PROGRESS: pctComplete 0-100; lấy số % từ lời nói.",
    "- confidence cao (>0.8) chỉ khi intent rất rõ ràng.",
  ].join("\n");

  const r = await chat([{ role: "system", content: sys }, { role: "user", content: `Báo cáo của công nhân:\n"${t}"\n\nPhân loại + rút trích.` }], {
    format: "json", temperature: 0.1, timeoutMs: 25_000,
  });

  if (!r.ok) {
    return {
      ok: true, model: "fallback", latencyMs: r.latencyMs,
      data: { transcript: t, form: { intent: "UNKNOWN", confidence: 0 }, source: "fallback" },
    };
  }

  try {
    const p = JSON.parse(r.data);
    const validIntents: FieldIntent[] = ["DAILY_LOG", "INCIDENT", "NCR", "PPE_REPORT", "PROGRESS", "UNKNOWN"];
    const validSev = ["MINOR", "MAJOR", "CRITICAL", "NEAR_MISS"];
    const f: FieldVoiceForm = {
      intent: validIntents.includes(p.intent) ? p.intent : "UNKNOWN",
      confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0))),
      zone: p.zone || undefined,
      workDone: p.workDone || undefined,
      workforce: p.workforce || undefined,
      safetyNotes: p.safetyNotes || undefined,
      category: p.category || undefined,
      severity: validSev.includes(p.severity) ? p.severity : undefined,
      injured: typeof p.injured === "number" ? p.injured : undefined,
      immediateAction: p.immediateAction || undefined,
      ncrTitle: p.ncrTitle || undefined,
      qcvnRef: p.qcvnRef || undefined,
      rootCause: p.rootCause || undefined,
      ppeMissing: Array.isArray(p.ppeMissing) && p.ppeMissing.length ? p.ppeMissing.slice(0, 5).map(String) : undefined,
      workerCount: typeof p.workerCount === "number" && p.workerCount > 0 ? p.workerCount : undefined,
      taskCode: p.taskCode || undefined,
      taskName: p.taskName || undefined,
      pctComplete: typeof p.pctComplete === "number" ? Math.max(0, Math.min(100, p.pctComplete)) : undefined,
    };
    return {
      ok: true, model: r.model, latencyMs: r.latencyMs,
      data: { transcript: t, form: f, source: "ai", model: r.model, latencyMs: r.latencyMs },
    };
  } catch {
    return {
      ok: true, model: r.model, latencyMs: r.latencyMs,
      data: { transcript: t, form: { intent: "UNKNOWN", confidence: 0 }, source: "fallback" },
    };
  }
}
