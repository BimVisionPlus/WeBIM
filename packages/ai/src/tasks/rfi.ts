// RFI-specific AI tasks:
//   1. classifyRfi  — discipline + priority + cost/schedule risk hint
//   2. draftRfiAnswer — 2–4 sentence VN draft, with QCVN/TCVN references when relevant
//
// Both return AiResult — caller stores into AiSuggestion + surfaces in UI.
// Designer-of-record always has the final say (engineer-in-loop).

import { z } from "zod";
import { chatJson } from "../llm";
import type { AiResult } from "../types";

// ─── 1. Classify ────────────────────────────────────────────────────────────

const RfiClassifySchema = z.object({
  category: z.enum(["Kiến trúc", "Kết cấu", "MEP", "Hoàn thiện", "Hạ tầng", "ATLĐ", "Khác"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  reason: z.string().min(2).max(400),
  costRiskVnd: z.number().int().nonnegative().nullable(),
  scheduleRiskDays: z.number().int().nonnegative().nullable(),
});
export type RfiClassification = z.infer<typeof RfiClassifySchema>;

const CLASSIFY_SYSTEM = `Bạn là kỹ sư trưởng dự án xây dựng tại Việt Nam, am hiểu NĐ 06/2021/NĐ-CP, QCVN, TCVN. Phân loại RFI (Request for Information) từ nhà thầu. Trả về JSON đúng schema, viết tiếng Việt.`;

export function classifyRfi(args: {
  title: string;
  question: string;
  projectName?: string;
  locationZone?: string;
}): Promise<AiResult<RfiClassification>> {
  const ctx = [
    args.projectName && `Dự án: ${args.projectName}`,
    args.locationZone && `Vị trí: ${args.locationZone}`,
    `Tiêu đề: ${args.title}`,
    `Câu hỏi: ${args.question}`,
  ].filter(Boolean).join("\n");

  return chatJson<RfiClassification>(
    [
      { role: "system", content: CLASSIFY_SYSTEM },
      {
        role: "user",
        content:
          `${ctx}\n\n` +
          `Trả về JSON: {"category":"Kiến trúc|Kết cấu|MEP|Hoàn thiện|Hạ tầng|ATLĐ|Khác",` +
          `"priority":"LOW|MEDIUM|HIGH|CRITICAL",` +
          `"reason":"giải thích ngắn 1-2 câu",` +
          `"costRiskVnd": null hoặc số VND ước tính,` +
          `"scheduleRiskDays": null hoặc số ngày}`,
      },
    ],
    (raw) => {
      const parsed = RfiClassifySchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
    { temperature: 0.1 },
  );
}

// ─── 2. Draft answer ────────────────────────────────────────────────────────

const RfiDraftSchema = z.object({
  draftAnswer: z.string().min(10).max(2_000),
  references: z.array(z.string()).max(8),
  confidence: z.enum(["low", "medium", "high"]),
  caveats: z.string().max(500).nullable(),
});
export type RfiDraft = z.infer<typeof RfiDraftSchema>;

const DRAFT_SYSTEM = `Bạn là chuyên gia tư vấn thiết kế xây dựng VN. Soạn nháp câu trả lời RFI: ngắn gọn, kỹ thuật, viện dẫn QCVN/TCVN/Nghị định khi phù hợp. Luôn nhắc cần xác nhận của thiết kế. Trả về JSON theo schema.`;

export function draftRfiAnswer(args: {
  title: string;
  question: string;
  category?: string | null;
  projectName?: string;
  specContext?: string;          // optional snippet from SpecPage RAG (TODO wire later)
}): Promise<AiResult<RfiDraft>> {
  const ctx = [
    args.projectName && `Dự án: ${args.projectName}`,
    args.category && `Phân loại: ${args.category}`,
    `RFI: ${args.title}`,
    `Câu hỏi: ${args.question}`,
    args.specContext && `\n--- Trích spec dự án ---\n${args.specContext}`,
  ].filter(Boolean).join("\n");

  return chatJson<RfiDraft>(
    [
      { role: "system", content: DRAFT_SYSTEM },
      {
        role: "user",
        content:
          `${ctx}\n\n` +
          `Trả về JSON: {"draftAnswer":"câu trả lời nháp 2-4 câu, tiếng Việt",` +
          `"references":["QCVN 06:2022/BXD §...", "TCVN 5574:2018 §..."],` +
          `"confidence":"low|medium|high",` +
          `"caveats":"điều cần kiểm tra thêm, hoặc null"}`,
      },
    ],
    (raw) => {
      const parsed = RfiDraftSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
    { temperature: 0.3 },
  );
}
