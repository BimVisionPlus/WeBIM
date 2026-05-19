// SiteEye vision tasks — PPE detection, worker counting.
//
// PPE detection: in production we use YOLOv8 weights trained on hard-hat /
// safety-vest datasets, served by a small Python sidecar. As a fallback /
// MVP we use the same Qwen2.5-VL describeImage() pipeline already wired up,
// which produces a structured JSON we can persist as VisionEvent.

import { z } from "zod";
import { describeImage } from "../vision";
import type { AiResult } from "../types";

const PpeFindingSchema = z.object({
  workersDetected: z.number().int().min(0).max(100),
  violations: z.array(
    z.object({
      label: z.enum(["hard_hat_missing", "safety_vest_missing", "harness_missing", "boots_missing", "glasses_missing"]),
      confidence: z.number().min(0).max(1),
      note: z.string().max(200).nullable(),
    }),
  ),
  overallRisk: z.enum(["low", "medium", "high"]),
});
export type PpeFinding = z.infer<typeof PpeFindingSchema>;

const SYSTEM = `Bạn là chuyên gia ATVSLĐ trên công trường xây dựng VN. Phân tích ảnh tổ đội thi công, đếm số người, phát hiện các vi phạm về Bảo hộ lao động (PPE) theo Luật ATVSLĐ 84/2015 + TCVN 5308:1991. Trả về JSON đúng schema.`;

export function detectPpeViolations(args: {
  imageBase64: string;
  context?: string;
}): Promise<AiResult<PpeFinding>> {
  return describeImage<PpeFinding>({
    imageBase64: args.imageBase64,
    systemPrompt: SYSTEM,
    prompt:
      (args.context ? `Bối cảnh: ${args.context}\n\n` : "") +
      `Quan sát ảnh và trả về JSON: {` +
      `"workersDetected": <số người>,` +
      `"violations":[{"label":"hard_hat_missing|safety_vest_missing|harness_missing|boots_missing|glasses_missing","confidence":0..1,"note":"…"}],` +
      `"overallRisk":"low|medium|high"}`,
    parse: (raw) => {
      const parsed = PpeFindingSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
  });
}
