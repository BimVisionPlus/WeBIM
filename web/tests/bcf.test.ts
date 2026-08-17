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

describe("BCF round-trip (import)", () => {
  it("xuất rồi đọc lại: topics giữ nguyên guid/title/status, escape đảo đúng", async () => {
    const { parseBcf } = await import("../src/application/bcf");
    const bytes = clashesToBcf([CLASH], { createdAt: "2026-08-17T00:00:00Z", author: "sophie" });
    const topics = await parseBcf(bytes);
    expect(topics).toHaveLength(1);
    expect(topics[0].title).toContain('Wall "W1" <KT>'); // escape đảo lại
    expect(topics[0].title).toContain("& mong");
    expect(topics[0].status).toBe("Open");
    expect(topics[0].author).toBe("sophie");
    expect(topics[0].guid).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ZIP nén DEFLATE (từ tool khác) cũng đọc được", async () => {
    const { parseBcf, unzip } = await import("../src/application/bcf");
    // Tạo zip deflate bằng chính node:zlib — mô phỏng file từ Revit
    const { deflateRawSync } = await import("node:zlib");
    const xml = `<?xml version="1.0"?><Markup><Topic Guid="abc-123" TopicStatus="Closed"><Title>Tu Revit</Title><CreationAuthor>rvt</CreationAuthor></Topic></Markup>`;
    const raw = new TextEncoder().encode(xml);
    const compressed = new Uint8Array(deflateRawSync(raw));
    // Dựng zip 1 entry method=8 bằng tay
    const name = new TextEncoder().encode("t1/markup.bcf");
    const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
    const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
    const { crc32: crc } = await import("../src/application/bcf");
    const c = crc(raw);
    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0),
      ...u32(c), ...u32(compressed.length), ...u32(raw.length),
      ...u16(name.length), ...u16(0), ...name, ...compressed,
    ];
    const central = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0),
      ...u32(c), ...u32(compressed.length), ...u32(raw.length),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0),
      ...name,
    ];
    const eocd = [
      ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(1), ...u16(1),
      ...u32(central.length), ...u32(local.length), ...u16(0),
    ];
    const zip = new Uint8Array([...local, ...central, ...eocd]);
    const files = await unzip(zip);
    expect(files.has("t1/markup.bcf")).toBe(true);
    const topics = await parseBcf(zip);
    expect(topics[0].title).toBe("Tu Revit");
    expect(topics[0].status).toBe("Closed");
  });

  it("file không phải zip → lỗi có lời, không treo", async () => {
    const { parseBcf } = await import("../src/application/bcf");
    await expect(parseBcf(new TextEncoder().encode("khong phai zip"))).rejects.toThrow(/ZIP/);
  });
});
