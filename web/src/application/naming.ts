// Quy tắc đặt tên tài liệu theo ISO của công ty (B2 trong bảng nhu cầu).
//
// ISO 19650-2 đặt tên tài liệu bằng một chuỗi các TRƯỜNG cố định nối bằng
// dấu gạch — mã dự án, đơn vị phát hành, khối, tầng, loại, bộ môn, số. Cái
// công ty cần không phải là đúng nguyên văn ISO mà là MỘT quy ước, được máy
// kiểm: hồ sơ đặt sai tên vẫn nộp được vào CDE ở mọi phần mềm, và người ta
// chỉ phát hiện ra lúc bàn giao, khi đổi tên nghĩa là đổi cả trăm tham chiếu.
//
// Engine này thuần dữ liệu — không import gì — để domain lẫn UI cùng dùng
// mà không tạo vòng phụ thuộc. Quy ước là dữ liệu của DỰ ÁN (đồng bộ qua
// meta), vì hai người cùng dự án mà khác quy ước thì kiểm còn hại hơn không.

export interface NamingSegment {
  /** Tên trường — "Mã dự án", "Bộ môn"… */
  name: string;
  /** LIST: đúng một trong values. PATTERN: khớp trọn regex. */
  kind: "LIST" | "PATTERN";
  values?: string[];
  pattern?: string;
  /** Gợi ý hiển thị cạnh ô nhập — ví dụ hợp lệ, nghĩa các mã. */
  hint?: string;
}

export interface NamingConvention {
  separator: string;
  segments: NamingSegment[];
}

/**
 * Quy ước mặc định — ISO 19650-2 rút gọn cho hồ sơ VN. Công ty sửa lại theo
 * sổ tay ISO của mình trong pane Quy tắc đặt tên; bản sửa lưu vào dự án.
 */
export const DEFAULT_CONVENTION: NamingConvention = {
  separator: "-",
  segments: [
    {
      name: "Mã dự án",
      kind: "PATTERN",
      pattern: "[A-Z0-9]{2,6}",
      hint: "2–6 chữ hoa/số, vd NPD12",
    },
    {
      name: "Đơn vị phát hành",
      kind: "PATTERN",
      pattern: "[A-Z]{2,4}",
      hint: "vd VSF, ACE",
    },
    {
      name: "Khối / hạng mục",
      kind: "PATTERN",
      pattern: "ZZ|[A-Z0-9]{1,4}",
      hint: "ZZ = chung toàn dự án",
    },
    {
      name: "Tầng / vị trí",
      kind: "PATTERN",
      pattern: "ZZ|XX|B[0-9]|M[0-9]|[0-9]{2}",
      hint: "ZZ = nhiều tầng, XX = không áp dụng, B1 = hầm, 03 = tầng 3",
    },
    {
      name: "Loại tài liệu",
      kind: "LIST",
      values: ["DR", "SK", "SP", "M3", "BQ", "RP", "PP", "CA"],
      hint: "DR bản vẽ · SK phác thảo · SP chỉ dẫn · M3 model · BQ khối lượng · RP báo cáo · PP biện pháp · CA tính toán",
    },
    {
      name: "Bộ môn",
      kind: "LIST",
      values: ["A", "S", "C", "E", "M", "P", "F", "X"],
      hint: "A kiến trúc · S kết cấu · C hạ tầng · E điện · M cơ · P nước · F PCCC · X khác",
    },
    {
      name: "Số thứ tự",
      kind: "PATTERN",
      pattern: "[0-9]{3,4}",
      hint: "001, 0001…",
    },
  ],
};

export interface CodeCheck {
  ok: boolean;
  /** Mỗi vấn đề một câu, đã chỉ rõ trường nào và mong đợi gì. */
  problems: string[];
}

function segmentExpectation(segment: NamingSegment): string {
  if (segment.kind === "LIST") {
    return `một trong: ${(segment.values ?? []).join(", ")}`;
  }
  return segment.hint ? `khớp «${segment.pattern}» (${segment.hint})` : `khớp «${segment.pattern}»`;
}

/** Kiểm một mã theo quy ước. Regex hỏng của người dùng = trường đó fail, có nói lý do. */
export function validateCode(code: string, convention: NamingConvention): CodeCheck {
  const problems: string[] = [];
  const trimmed = code.trim();
  if (trimmed === "") {
    return { ok: false, problems: ["Mã trống."] };
  }
  const parts = trimmed.split(convention.separator);
  if (parts.length !== convention.segments.length) {
    problems.push(
      `Có ${parts.length} trường, quy ước cần ${convention.segments.length} ` +
        `(${convention.segments.map((segment) => segment.name).join(" – ")}).`,
    );
    // Vẫn kiểm phần khớp được — người sửa muốn thấy hết lỗi một lần.
  }
  const upto = Math.min(parts.length, convention.segments.length);
  for (let index = 0; index < upto; index += 1) {
    const segment = convention.segments[index];
    const value = parts[index];
    if (segment.kind === "LIST") {
      if (!(segment.values ?? []).includes(value)) {
        problems.push(
          `Trường ${index + 1} (${segment.name}): "${value}" không nằm trong ${segmentExpectation(segment)}.`,
        );
      }
      continue;
    }
    let matched = false;
    try {
      matched = new RegExp(`^(?:${segment.pattern ?? ""})$`).test(value);
    } catch {
      problems.push(
        `Trường ${index + 1} (${segment.name}): mẫu regex «${segment.pattern}» không hợp lệ — sửa quy ước trước.`,
      );
      continue;
    }
    if (!matched) {
      problems.push(
        `Trường ${index + 1} (${segment.name}): "${value}" không ${segmentExpectation(segment)}.`,
      );
    }
  }
  return { ok: problems.length === 0, problems };
}

export interface NamingAuditRow {
  id: string;
  /** "Tài liệu CDE" | "Sheet" — chỗ mã này sống. */
  kind: string;
  code: string;
  title: string;
  check: CodeCheck;
}

/** Kiểm một danh sách mã; trả đủ mọi dòng — UI tự lọc dòng sai nếu muốn. */
export function auditCodes(
  rows: { id: string; kind: string; code: string; title: string }[],
  convention: NamingConvention,
): NamingAuditRow[] {
  return rows.map((row) => ({ ...row, check: validateCode(row.code, convention) }));
}

/** Quy ước người dùng lưu có thể thiếu trường (file tay, bản cũ) — vá về dạng dùng được. */
export function normalizeConvention(raw: unknown): NamingConvention | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as { separator?: unknown; segments?: unknown };
  if (typeof data.separator !== "string" || data.separator.length === 0) return null;
  if (!Array.isArray(data.segments) || data.segments.length === 0) return null;
  const segments: NamingSegment[] = [];
  for (const entry of data.segments) {
    if (typeof entry !== "object" || entry === null) return null;
    const seg = entry as Record<string, unknown>;
    if (typeof seg.name !== "string" || (seg.kind !== "LIST" && seg.kind !== "PATTERN")) {
      return null;
    }
    segments.push({
      name: seg.name,
      kind: seg.kind,
      ...(Array.isArray(seg.values)
        ? { values: seg.values.filter((value): value is string => typeof value === "string") }
        : {}),
      ...(typeof seg.pattern === "string" ? { pattern: seg.pattern } : {}),
      ...(typeof seg.hint === "string" ? { hint: seg.hint } : {}),
    });
  }
  return { separator: data.separator, segments };
}
