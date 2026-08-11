/**
 * Hồ sơ hoàn công narrative auto-draft.
 *
 * Given a project's completion data — BoQ executed, NCRs resolved,
 * acceptance records, daily log span — draft narrative text for each
 * required section of the Hồ sơ hoàn công per NĐ 06/2021 + TT 04/2017.
 *
 * Sections (Phụ lục VIIIb NĐ 06/2021):
 *   1. Hồ sơ pháp lý đầu tư
 *   2. Khảo sát & thiết kế
 *   3. Quy chuẩn / tiêu chuẩn áp dụng
 *   4. Quá trình thi công + biện pháp thi công
 *   5. Vật liệu, cấu kiện sử dụng
 *   6. Quản lý chất lượng + kết quả kiểm tra (NCR/QA/QC)
 *   7. Khối lượng hoàn thành (BoQ)
 *   8. Sự cố/sự kiện bất thường (nếu có)
 *   9. Nghiệm thu giai đoạn + bàn giao
 *  10. An toàn lao động & VSMT
 *  11. PCCC
 *  12. Tài liệu nhà thầu phụ + thầu cung cấp
 *  13. Kết luận, đánh giá tổng thể + kiến nghị
 *
 * One AI call per section (so failures isolate to one section); callers
 * can request all or just specific seqs.
 */

import { chat } from "../llm";
import type { AiResult } from "../types";

export const HOAN_CONG_SECTIONS: Array<{ seq: number; code: string; title: string; required: boolean; angle: string }> = [
  { seq: 1, code: "VIIIb.1", title: "Hồ sơ pháp lý đầu tư", required: true, angle: "Liệt kê quyết định đầu tư, GPXD, các văn bản pháp lý của dự án." },
  { seq: 2, code: "VIIIb.2", title: "Khảo sát & thiết kế", required: true, angle: "Tóm tắt hồ sơ khảo sát địa chất, thiết kế cơ sở/bản vẽ thi công, đơn vị thực hiện." },
  { seq: 3, code: "VIIIb.3", title: "Quy chuẩn / tiêu chuẩn áp dụng", required: true, angle: "Liệt kê QCVN/TCVN áp dụng cho công trình theo nhóm: kết cấu, MEP, hoàn thiện, ATLĐ, PCCC." },
  { seq: 4, code: "VIIIb.4", title: "Quá trình thi công + biện pháp thi công", required: true, angle: "Mô tả tổng quan quá trình thi công theo trình tự kết cấu → MEP → hoàn thiện. Đề cập biện pháp thi công chính đã duyệt." },
  { seq: 5, code: "VIIIb.5", title: "Vật liệu, cấu kiện sử dụng", required: true, angle: "Liệt kê các vật liệu chính: bê tông, thép, gạch, sơn, MEP. Nêu nguồn cung và chứng nhận xuất xứ." },
  { seq: 6, code: "VIIIb.6", title: "Quản lý chất lượng + kết quả kiểm tra", required: true, angle: "Tóm tắt hoạt động QA/QC, số NCR phát hiện và đã xử lý, biên bản nghiệm thu vật liệu." },
  { seq: 7, code: "VIIIb.7", title: "Khối lượng hoàn thành", required: true, angle: "Tóm tắt khối lượng thi công theo BoQ — không chi tiết từng dòng, chỉ nhóm theo hạng mục chính." },
  { seq: 8, code: "VIIIb.8", title: "Sự cố/sự kiện bất thường", required: false, angle: "Liệt kê các sự cố ATLĐ hoặc bất thường nếu có; nếu không có thì ghi rõ 'Không có sự cố trong quá trình thi công'." },
  { seq: 9, code: "VIIIb.9", title: "Nghiệm thu giai đoạn + bàn giao", required: true, angle: "Tóm tắt các đợt nghiệm thu (NTHM, NTGD, NTHM tổng thể) và các bên tham gia." },
  { seq: 10, code: "VIIIb.10", title: "An toàn lao động & vệ sinh môi trường", required: true, angle: "Tổng kết công tác ATLĐ-VSMT: số ngày công, sự cố, kế hoạch ứng phó, đào tạo." },
  { seq: 11, code: "VIIIb.11", title: "PCCC", required: true, angle: "Hệ thống PCCC đã lắp đặt, biên bản nghiệm thu của Cảnh sát PCCC." },
  { seq: 12, code: "VIIIb.12", title: "Tài liệu nhà thầu phụ + thầu cung cấp", required: false, angle: "Liệt kê các nhà thầu phụ + nhà cung cấp chính và phạm vi công việc của mỗi bên." },
  { seq: 13, code: "VIIIb.13", title: "Kết luận, đánh giá tổng thể + kiến nghị", required: true, angle: "Đánh giá tổng thể chất lượng công trình, đề xuất chế độ bảo hành và kiến nghị nếu có." },
];

export type HoanCongContext = {
  projectKey: string;
  projectName: string;
  ownerOrgName: string;
  contractValueVnd: string;       // human-formatted
  warrantyMonths: number;
  // Optional rich context — when missing, AI generates with placeholders.
  boqLineCount?: number;
  boqTopCategories?: Array<{ category: string; valueVnd: string }>;
  taskCount?: number;
  doneTaskCount?: number;
  ncrCount?: number;
  ncrResolvedCount?: number;
  dailyLogCount?: number;
  acceptanceCount?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  stakeholderRoles?: Array<{ role: string; orgName: string }>;
  notableIncidentCount?: number;
};

export type SectionDraft = {
  seq: number;
  code: string;
  title: string;
  body: string;            // Vietnamese markdown
  model?: string;
  latencyMs?: number;
  source: "ai" | "fallback";
};

export async function draftHoanCongSection(
  ctx: HoanCongContext,
  seq: number,
): Promise<AiResult<SectionDraft>> {
  const meta = HOAN_CONG_SECTIONS.find((s) => s.seq === seq);
  if (!meta) return { ok: false, reason: "disabled", latencyMs: 0, error: `seq ${seq} not in 1..13` };

  const sys = [
    "Bạn là chuyên viên lập hồ sơ hoàn công công trình xây dựng tại Việt Nam.",
    "Soạn 1 mục của Hồ sơ hoàn công theo Phụ lục VIIIb Nghị định 06/2021/NĐ-CP.",
    "Khi tham chiếu quản lý chi phí ĐTXD, dùng tên 'Văn bản hợp nhất 06/VBHN-BXD' (hợp nhất NĐ 10/2021/NĐ-CP + sửa đổi), KHÔNG dùng 'NĐ 10/2021' đơn lẻ.",
    "Văn phong: trang trọng, ngôi xưng 'Đơn vị thi công', tránh bullet thẳng, ưu tiên đoạn văn.",
    "Độ dài: 120-250 từ. Chỉ tiếng Việt. Không bịa số liệu không có trong dữ liệu.",
    "Tham chiếu QCVN/TCVN cụ thể khi phù hợp.",
  ].join(" ");

  const lines: string[] = [
    `=== Mục ${meta.code}: ${meta.title} ===`,
    `Hướng dẫn nội dung mục này: ${meta.angle}`,
    "",
    "Dữ liệu dự án:",
    `- Mã: ${ctx.projectKey}`,
    `- Tên: ${ctx.projectName}`,
    `- Chủ đầu tư: ${ctx.ownerOrgName}`,
    `- Giá trị hợp đồng: ${ctx.contractValueVnd}`,
    `- Thời gian bảo hành: ${ctx.warrantyMonths} tháng`,
  ];
  if (ctx.startDate) lines.push(`- Khởi công: ${ctx.startDate}`);
  if (ctx.endDate) lines.push(`- Hoàn thành: ${ctx.endDate}`);
  if (ctx.boqLineCount != null) lines.push(`- BoQ: ${ctx.boqLineCount} dòng khối lượng`);
  if (ctx.boqTopCategories?.length) {
    lines.push(`- Hạng mục chính: ${ctx.boqTopCategories.map((c) => `${c.category} (${c.valueVnd})`).join("; ")}`);
  }
  if (ctx.taskCount != null) lines.push(`- Số công việc: ${ctx.taskCount} (đã hoàn thành ${ctx.doneTaskCount ?? 0})`);
  if (ctx.ncrCount != null) lines.push(`- NCR: ${ctx.ncrCount} (đã xử lý ${ctx.ncrResolvedCount ?? 0})`);
  if (ctx.dailyLogCount != null) lines.push(`- Số ngày nhật ký: ${ctx.dailyLogCount}`);
  if (ctx.acceptanceCount != null) lines.push(`- Số đợt nghiệm thu: ${ctx.acceptanceCount}`);
  if (ctx.notableIncidentCount != null) lines.push(`- Sự cố ATLĐ ghi nhận: ${ctx.notableIncidentCount}`);
  if (ctx.stakeholderRoles?.length) {
    lines.push(`- Các bên: ${ctx.stakeholderRoles.map((s) => `${s.role}=${s.orgName}`).join("; ")}`);
  }

  const user = lines.join("\n");

  const r = await chat([{ role: "system", content: sys }, { role: "user", content: user }], {
    temperature: 0.3,
    timeoutMs: 45_000,
  });

  if (!r.ok) {
    // Fallback: structured template, lifeless but at least non-empty.
    const fallback = [
      `Mục ${meta.code} — ${meta.title}`,
      "",
      `${meta.angle}`,
      "",
      "Đơn vị thi công sẽ bổ sung nội dung chi tiết của mục này theo Phụ lục VIIIb",
      "Nghị định 06/2021/NĐ-CP. (AI tạm thời ngoại tuyến — vui lòng soạn thủ công hoặc thử lại.)",
    ].join("\n");
    return {
      ok: true,
      data: { seq: meta.seq, code: meta.code, title: meta.title, body: fallback, source: "fallback", latencyMs: r.latencyMs },
      model: "fallback",
      latencyMs: r.latencyMs,
    };
  }

  return {
    ok: true,
    model: r.model,
    data: {
      seq: meta.seq,
      code: meta.code,
      title: meta.title,
      body: r.data.trim(),
      model: r.model,
      latencyMs: r.latencyMs,
      source: "ai",
    },
    latencyMs: r.latencyMs,
  };
}
