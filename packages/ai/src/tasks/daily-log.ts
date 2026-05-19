// Daily-log AI tasks:
//   1. transcribeVoiceNote — STT for engineer's voice memo (VN)
//   2. structureDailyLog   — turn free-form transcript into {workDone, workforce, safetyNotes}
//
// Use case: site engineer presses 🎙 on mobile, talks for 30s about today's work,
// AI fills the form. Saves ~5 min/day per engineer.

import { z } from "zod";
import { transcribe } from "../stt";
import { chatJson } from "../llm";
import type { AiResult } from "../types";

export async function transcribeVoiceNote(audio: Blob | Uint8Array): Promise<AiResult<string>> {
  return transcribe({ audio, language: "vi" });
}

const StructuredLogSchema = z.object({
  workDone: z.string().min(2).max(5_000),
  workTomorrow: z.string().max(5_000).nullable(),
  safetyNotes: z.string().max(5_000).nullable(),
  workforce: z.array(z.object({
    trade: z.string().min(1).max(60),
    count: z.number().int().min(0).max(10_000),
  })).max(20),
  weather: z.string().max(120).nullable(),
});
export type StructuredDailyLog = z.infer<typeof StructuredLogSchema>;

const STRUCTURE_SYSTEM = `Bạn giúp chỉ huy trưởng công trình VN ghi nhật ký thi công theo NĐ 06/2021 Điều 10. Từ lời nói tự do, tách thành các trường có cấu trúc. Giữ nguyên thuật ngữ kỹ thuật. Trả về JSON.`;

export function structureDailyLog(transcript: string): Promise<AiResult<StructuredDailyLog>> {
  return chatJson<StructuredDailyLog>(
    [
      { role: "system", content: STRUCTURE_SYSTEM },
      {
        role: "user",
        content:
          `Lời thoại từ kỹ sư hiện trường:\n"""${transcript}"""\n\n` +
          `Trả về JSON: {` +
          `"workDone":"công việc hôm nay, gạch đầu dòng",` +
          `"workTomorrow":"kế hoạch ngày mai, hoặc null",` +
          `"safetyNotes":"vấn đề ATLĐ, hoặc null",` +
          `"workforce":[{"trade":"thợ sắt","count":12}],` +
          `"weather":"VD nắng 32°C, mưa to, hoặc null"}`,
      },
    ],
    (raw) => {
      const parsed = StructuredLogSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
    { temperature: 0.2 },
  );
}
