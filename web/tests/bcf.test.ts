// BCF 2.1 export — ZIP đúng spec, XML đúng escape, GUID xác định.

import { describe, expect, it } from "vitest";
import {
  buildZip,
  clashesToBcf,
  crc32,
  deterministicGuid,
  topicXml,
} from "../src/application/bcf";
import type { ClashItem } from "../src/application/clash";

const CLASH: ClashItem = {
  aId: "w1",
  aName: 'Wall "W1" <KT>',
  bId: "KC.ifc:g2",
  bName: "Dam KC & mong",
  kind: "IFC_IFC",
  depth: 0.123456,
};

describe("crc32", () => {
  it("khớp vector chuẩn IEEE", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("buildZip", () => {
  it("có local header, central directory và EOCD đếm đúng số entry", () => {
    const zip = buildZip([
      { name: "a.txt", data: new TextEncoder().encode("xin chao") },
      { name: "dir/b.txt", data: new TextEncoder().encode("hai") },
    ]);
    const hex = [...zip].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    expect(hex.startsWith("504b0304")).toBe(true); // PK\x03\x04
    expect(hex).toContain("504b0102"); // central
    expect(hex).toContain("504b0506"); // EOCD
    // EOCD: 2 entries (offset 10–11 từ chữ ký EOCD)
    const eocdAt = zip.length - 22;
    expect(zip[eocdAt + 10] + (zip[eocdAt + 11] << 8)).toBe(2);
  });
});

describe("BCF topics", () => {
  it("GUID xác định: cùng clash cùng GUID, khác clash khác GUID, đúng dạng uuid", () => {
    const first = deterministicGuid("a|b|K");
    expect(deterministicGuid("a|b|K")).toBe(first);
    expect(deterministicGuid("a|b|X")).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("XML escape tên có ký tự đặc biệt, mang đủ Title/Date/Author", () => {
    const { xml } = topicXml(CLASH, "2026-08-17T00:00:00Z", "sophie");
    expect(xml).toContain("&quot;W1&quot; &lt;KT&gt;");
    expect(xml).toContain("&amp; mong");
    expect(xml).toContain("<CreationAuthor>sophie</CreationAuthor>");
    expect(xml).toContain('TopicStatus="Open"');
  });

  it("file .bcf chứa bcf.version + một thư mục guid/markup.bcf mỗi clash", () => {
    const bytes = clashesToBcf([CLASH], { createdAt: "2026-08-17T00:00:00Z", author: "qa" });
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text).toContain("bcf.version");
    expect(text).toContain("/markup.bcf");
    expect(text).toContain('VersionId="2.1"');
  });
});
