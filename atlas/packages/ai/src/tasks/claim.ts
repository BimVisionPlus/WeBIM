// Claims (hồ sơ khiếu nại / EOT) AI tasks:
//   1. suggestLegalBasis    — gợi ý căn cứ pháp lý từ corpus Regulation đã seed.
//                             Chỉ được trích từ danh sách văn bản cung cấp —
//                             không tự bịa số hiệu văn bản / điều khoản.
//   2. draftClaimStatement  — soạn nháp văn bản khiếu nại (markdown) từ
//                             timeline sự kiện + chứng cứ + căn cứ đã duyệt.
//
// Cả hai trả AiResult — caller lưu vào AiSuggestion (+ AiCitation cho căn cứ).
// Engineer-in-loop: pháp chế / chỉ huy trưởng duyệt từng căn cứ trước khi
// đưa vào hồ sơ. AI không bao giờ tự kết luận đúng/sai về pháp lý.

import { z } from "zod";
import { chatJson } from "../llm";
import type { AiResult } from "../types";

// ─── 1. Suggest legal basis ─────────────────────────────────────────────────

export type RegulationCandidate = {
  code: string; // "NĐ 37/2015/NĐ-CP"
  kind: string; // NGHI_DINH | LUAT | TCVN | …
  title: string;
  summary?: string | null; // Regulation.body (tóm tắt các điều liên quan)
};

const LegalBasisSchema = z.object({
  bases: z
    .array(
      z.object({
        regulationCode: z.string().min(2).max(60),
        articleRef: z.string().min(2).max(80), // "Điều 44 khoản 1"
        argument: z.string().min(10).max(1_200), // lập luận áp dụng
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(8),
  gapsNote: z.string().max(800).nullable(), // điểm yếu pháp lý / cần bổ sung
});
export type LegalBasisSuggestion = z.infer<typeof LegalBasisSchema>;

const BASIS_SYSTEM = `Bạn là chuyên gia pháp lý hợp đồng xây dựng Việt Nam (NĐ 37/2015/NĐ-CP, NĐ 50/2021/NĐ-CP, Luật Xây dựng 2014 sửa đổi 2020, NĐ 06/2021/NĐ-CP).
QUY TẮC BẮT BUỘC:
1. CHỈ viện dẫn văn bản có trong danh sách "VĂN BẢN ĐƯỢC PHÉP TRÍCH DẪN". Không bịa số hiệu văn bản khác.
2. articleRef phải nêu điều/khoản cụ thể; nếu không chắc số điều, ghi "cần tra cứu điều khoản" và hạ confidence xuống dưới 0.5.
3. Lập luận phải gắn với tình tiết vụ việc, không chép lại luật chung chung.
4. Đây là gợi ý cho kỹ sư/pháp chế duyệt — không phải tư vấn pháp lý cuối cùng.
Trả về JSON đúng schema, tiếng Việt.`;

export function suggestLegalBasis(args: {
  claimType: string; // EOT | COST | PRICE_ESCALATION | …
  title: string;
  description?: string | null;
  contractRef?: string | null;
  periodStart?: string | null; // ISO
  periodEnd?: string | null;
  eventsSummary?: string; // vài dòng timeline chính
  regulations: RegulationCandidate[];
}): Promise<AiResult<LegalBasisSuggestion>> {
  // Giữ prompt gọn cho CPU inference (qwen 7B, ctx 4k): tối đa 12 văn bản,
  // tóm tắt cắt 600 ký tự — văn bản có summary (thư viện claims) xếp trước.
  const corpus = [...args.regulations]
    .sort((a, b) => (b.summary ? 1 : 0) - (a.summary ? 1 : 0))
    .slice(0, 12)
    .map((r) => `- ${r.code} (${r.kind}): ${r.title}${r.summary ? `\n  Tóm tắt: ${r.summary.slice(0, 600)}` : ""}`)
    .join("\n");

  const ctx = [
    `Loại khiếu nại: ${args.claimType}`,
    `Tiêu đề: ${args.title}`,
    args.description && `Mô tả: ${args.description}`,
    args.contractRef && `Điều khoản HĐ viện dẫn: ${args.contractRef}`,
    args.periodStart && `Thời gian sự kiện: ${args.periodStart} → ${args.periodEnd ?? "nay"}`,
    args.eventsSummary && `Diễn biến chính:\n${args.eventsSummary}`,
  ]
    .filter(Boolean)
    .join("\n");

  return chatJson<LegalBasisSuggestion>(
    [
      { role: "system", content: BASIS_SYSTEM },
      {
        role: "user",
        content:
          `VỤ VIỆC:\n${ctx}\n\n` +
          `VĂN BẢN ĐƯỢC PHÉP TRÍCH DẪN:\n${corpus}\n\n` +
          `Trả về JSON (TỐI ĐA 4 căn cứ, chọn căn cứ mạnh nhất): ` +
          `{"bases":[{"regulationCode":"đúng code trong danh sách",` +
          `"articleRef":"Điều X khoản Y","argument":"lập luận áp dụng vào vụ việc, 2-3 câu",` +
          `"confidence":0.0-1.0}],"gapsNote":"điểm yếu pháp lý hoặc chứng cứ cần bổ sung, hoặc null"}`,
      },
    ],
    (raw) => {
      const parsed = LegalBasisSchema.safeParse(raw);
      if (!parsed.success) return null;
      // Hard guard: drop any basis citing a regulation outside the provided corpus.
      const allowed = new Set(args.regulations.map((r) => r.code));
      const bases = parsed.data.bases.filter((b) => allowed.has(b.regulationCode));
      return { ...parsed.data, bases };
    },
    { temperature: 0.1, timeoutMs: 120_000 },
  );
}

// ─── 2. Draft claim statement ───────────────────────────────────────────────

const StatementSchema = z.object({
  statementMd: z.string().min(100).max(20_000), // văn bản khiếu nại, markdown
  missingItems: z.array(z.string().max(300)).max(10), // chứng cứ / thông tin còn thiếu
  strength: z.enum(["weak", "medium", "strong"]),
  caveats: z.string().max(800).nullable(),
});
export type ClaimStatementDraft = z.infer<typeof StatementSchema>;

const STATEMENT_SYSTEM = `Bạn là kỹ sư hợp đồng (contract engineer) công trường Việt Nam, soạn văn bản khiếu nại theo thông lệ NĐ 37/2015/NĐ-CP.
QUY TẮC:
1. Cấu trúc bắt buộc: I. Thông tin chung; II. Tóm tắt yêu cầu; III. Diễn biến sự việc (theo trình tự thời gian, mỗi mục dẫn chứng cứ [CC-n]); IV. Căn cứ pháp lý và hợp đồng (chỉ dùng căn cứ được cung cấp); V. Yêu cầu cụ thể; VI. Danh mục chứng cứ kèm theo.
2. Mỗi luận điểm ở mục III phải trỏ tới ít nhất một chứng cứ [CC-n] trong danh sách. KHÔNG bịa thêm sự kiện hay chứng cứ.
3. Số liệu (VND, số ngày) lấy nguyên văn từ dữ liệu — không tự tính lại.
4. Giọng văn: trang trọng, khách quan, không cảm tính.
Trả về JSON đúng schema, statementMd là markdown tiếng Việt.`;

export function draftClaimStatement(args: {
  projectName: string;
  claim: {
    key: string;
    title: string;
    type: string;
    direction: string;
    counterparty?: string | null;
    contractRef?: string | null;
    amountVnd?: string | null; // pre-formatted "1.250.000.000 VND"
    eotDays?: number | null;
    description?: string | null;
  };
  events: Array<{ occurredAt: string; kind: string; title: string; detail?: string | null }>;
  evidence: Array<{ idx: number; kind: string; title: string; capturedAt?: string | null; note?: string | null }>;
  legalBases: Array<{ regulationCode: string; regulationTitle: string; articleRef: string; argument: string }>;
}): Promise<AiResult<ClaimStatementDraft>> {
  const eventLines = args.events
    .map((e) => `- ${e.occurredAt} [${e.kind}] ${e.title}${e.detail ? ` — ${e.detail}` : ""}`)
    .join("\n");
  const evidenceLines = args.evidence
    .map((ev) => `[CC-${ev.idx}] (${ev.kind}${ev.capturedAt ? `, ${ev.capturedAt}` : ""}) ${ev.title}${ev.note ? ` — ${ev.note}` : ""}`)
    .join("\n");
  const basisLines = args.legalBases
    .map((b) => `- ${b.regulationCode} ${b.articleRef} (${b.regulationTitle}): ${b.argument}`)
    .join("\n");

  return chatJson<ClaimStatementDraft>(
    [
      { role: "system", content: STATEMENT_SYSTEM },
      {
        role: "user",
        content:
          `DỰ ÁN: ${args.projectName}\n` +
          `HỒ SƠ: ${args.claim.key} — ${args.claim.title}\n` +
          `Loại: ${args.claim.type} | Hướng: ${args.claim.direction}` +
          (args.claim.counterparty ? ` | Bên bị khiếu nại: ${args.claim.counterparty}` : "") +
          "\n" +
          (args.claim.contractRef ? `Điều khoản HĐ: ${args.claim.contractRef}\n` : "") +
          (args.claim.amountVnd ? `Giá trị yêu cầu: ${args.claim.amountVnd}\n` : "") +
          (args.claim.eotDays != null ? `Số ngày EOT yêu cầu: ${args.claim.eotDays} ngày\n` : "") +
          (args.claim.description ? `Mô tả: ${args.claim.description}\n` : "") +
          `\nDIỄN BIẾN SỰ VIỆC:\n${eventLines || "(chưa có)"}\n` +
          `\nDANH MỤC CHỨNG CỨ:\n${evidenceLines || "(chưa có)"}\n` +
          `\nCĂN CỨ PHÁP LÝ ĐÃ DUYỆT:\n${basisLines || "(chưa có)"}\n\n` +
          `Trả về JSON: {"statementMd":"văn bản khiếu nại markdown đầy đủ 6 mục",` +
          `"missingItems":["chứng cứ/thông tin còn thiếu"],` +
          `"strength":"weak|medium|strong","caveats":"lưu ý trước khi gửi, hoặc null"}`,
      },
    ],
    (raw) => {
      const parsed = StatementSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
    { temperature: 0.2, timeoutMs: 120_000 },
  );
}
