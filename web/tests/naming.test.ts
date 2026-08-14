// Quy tắc đặt tên ISO — engine thuần + round-trip qua domain.

import { describe, expect, it } from "vitest";
import {
  auditCodes,
  DEFAULT_CONVENTION,
  normalizeConvention,
  validateCode,
  type NamingConvention,
} from "../src/application/naming";
import { NativeBimProject } from "../src/domain/project";

describe("validateCode — quy ước mặc định ISO 19650", () => {
  it("chấp nhận mã đúng chuẩn", () => {
    const check = validateCode("NPD12-VSF-ZZ-03-DR-A-001", DEFAULT_CONVENTION);
    expect(check.ok).toBe(true);
    expect(check.problems).toHaveLength(0);
  });

  it("chấp nhận các mã đặc biệt ZZ/XX/B1", () => {
    expect(validateCode("AB-XY-ZZ-XX-M3-S-0001", DEFAULT_CONVENTION).ok).toBe(true);
    expect(validateCode("AB-XY-K1-B2-BQ-F-123", DEFAULT_CONVENTION).ok).toBe(true);
  });

  it("báo đúng trường sai, kèm mong đợi", () => {
    const check = validateCode("NPD12-VSF-ZZ-03-QQ-A-001", DEFAULT_CONVENTION);
    expect(check.ok).toBe(false);
    expect(check.problems).toHaveLength(1);
    expect(check.problems[0]).toContain("Loại tài liệu");
    expect(check.problems[0]).toContain("QQ");
  });

  it("thiếu trường thì nói cần bao nhiêu và vẫn kiểm phần còn lại", () => {
    const check = validateCode("NPD12-VSF-ZZ", DEFAULT_CONVENTION);
    expect(check.ok).toBe(false);
    expect(check.problems[0]).toContain("cần 7");
  });

  it("mã trống là lỗi, không phải khớp rỗng", () => {
    expect(validateCode("  ", DEFAULT_CONVENTION).ok).toBe(false);
  });

  it("nhiều lỗi ra cùng lúc — người sửa thấy hết một lần", () => {
    const check = validateCode("np-1-ZZ-99x-QQ-A-01x", DEFAULT_CONVENTION);
    expect(check.ok).toBe(false);
    expect(check.problems.length).toBeGreaterThanOrEqual(3);
  });
});

describe("quy ước tuỳ chỉnh", () => {
  const custom: NamingConvention = {
    separator: "_",
    segments: [
      { name: "Dự án", kind: "PATTERN", pattern: "[A-Z]{3}" },
      { name: "Loại", kind: "LIST", values: ["BV", "TM"] },
    ],
  };

  it("dùng dấu nối và trường riêng", () => {
    expect(validateCode("ABC_BV", custom).ok).toBe(true);
    expect(validateCode("ABC-BV", custom).ok).toBe(false);
    expect(validateCode("ABC_XX", custom).ok).toBe(false);
  });

  it("regex hỏng của người dùng fail trường đó và nói lý do, không văng exception", () => {
    const broken: NamingConvention = {
      separator: "-",
      segments: [{ name: "X", kind: "PATTERN", pattern: "[oops" }],
    };
    const check = validateCode("ABC", broken);
    expect(check.ok).toBe(false);
    expect(check.problems[0]).toContain("regex");
  });
});

describe("auditCodes", () => {
  it("trả đủ mọi dòng với cờ ok từng dòng", () => {
    const rows = auditCodes(
      [
        { id: "1", kind: "Tài liệu CDE", code: "NPD12-VSF-ZZ-03-DR-A-001", title: "MB tầng 3" },
        { id: "2", kind: "Tài liệu CDE", code: "ban-ve-cu.dwg", title: "File cũ" },
      ],
      DEFAULT_CONVENTION,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].check.ok).toBe(true);
    expect(rows[1].check.ok).toBe(false);
  });
});

describe("domain round-trip", () => {
  it("null (mặc định) không ghi naming_rules vào JSON", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    expect("naming_rules" in project.toDict()).toBe(false);
  });

  it("quy ước riêng sống sót qua toDict → fromJson", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.namingConvention = {
      separator: "_",
      segments: [{ name: "Dự án", kind: "PATTERN", pattern: "[A-Z]{3}", hint: "vd ABC" }],
    };
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(reloaded.namingConvention).toEqual(project.namingConvention);
  });

  it("naming_rules hỏng trong file rơi về null thay vì nổ", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const dict = project.toDict();
    (dict as Record<string, unknown>).naming_rules = { separator: "-", segments: [{ bad: true }] };
    expect(NativeBimProject.fromJson(JSON.stringify(dict)).namingConvention).toBeNull();
  });
});

describe("normalizeConvention", () => {
  it("giữ lại đúng các trường hợp lệ", () => {
    expect(
      normalizeConvention({
        separator: "-",
        segments: [{ name: "A", kind: "LIST", values: ["X", 3, "Y"] }],
      }),
    ).toEqual({ separator: "-", segments: [{ name: "A", kind: "LIST", values: ["X", "Y"] }] });
  });

  it("từ chối dữ liệu không thành hình", () => {
    expect(normalizeConvention(null)).toBeNull();
    expect(normalizeConvention({ separator: "-", segments: [] })).toBeNull();
    expect(normalizeConvention({ segments: [{ name: "A", kind: "LIST" }] })).toBeNull();
  });
});
