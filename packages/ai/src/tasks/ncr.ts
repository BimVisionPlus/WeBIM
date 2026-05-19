// NCR vision task — assess severity from photo evidence.
// VLM (Qwen2.5-VL) looks at on-site photo of a defect and proposes:
//   - severity (MINOR/MAJOR/CRITICAL per NĐ 06/2021 Điều 12)
//   - probable root cause
//   - corrective action (CAR)
//   - QCVN/TCVN reference if obvious
//
// Suggestion only — TVGS (supervisor) must confirm before workflow advance.

import { z } from "zod";
import { describeImage } from "../vision";
import type { AiResult } from "../types";

const NcrAssessmentSchema = z.object({
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL"]),
  defectDescription: z.string().min(5).max(500),
  rootCauseHypothesis: z.string().max(500).nullable(),
  correctiveActionDraft: z.string().max(500).nullable(),
  qcvnRef: z.string().max(120).nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});
export type NcrAssessment = z.infer<typeof NcrAssessmentSchema>;

const SYSTEM = `Bạn là TVGS (tư vấn giám sát) xây dựng VN, đánh giá ảnh hiện trường theo NĐ 06/2021. Phân loại sai khác chất lượng. Trả về JSON. Mức độ: MINOR (không ảnh hưởng cấu trúc), MAJOR (sửa tại chỗ), CRITICAL (phải tháo dỡ).`;

export function assessNcrPhoto(args: {
  imageBase64: string;
  context?: string;            // optional: "Cốt thép tầng 12 trục A-F"
}): Promise<AiResult<NcrAssessment>> {
  return describeImage<NcrAssessment>({
    imageBase64: args.imageBase64,
    systemPrompt: SYSTEM,
    prompt:
      (args.context ? `Bối cảnh: ${args.context}\n\n` : "") +
      `Quan sát ảnh và trả về JSON: {` +
      `"severity":"MINOR|MAJOR|CRITICAL",` +
      `"defectDescription":"mô tả lỗi quan sát được",` +
      `"rootCauseHypothesis":"giả thuyết nguyên nhân hoặc null",` +
      `"correctiveActionDraft":"đề xuất CAR hoặc null",` +
      `"qcvnRef":"VD QCVN 06:2022/BXD §3.2 hoặc null",` +
      `"confidence":"low|medium|high"}`,
    parse: (raw) => {
      const parsed = NcrAssessmentSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
  });
}
