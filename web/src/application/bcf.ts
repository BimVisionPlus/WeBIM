// Xuất BCF 2.1 (BIM Collaboration Format) từ báo cáo va chạm.
//
// BCF là chuẩn trao đổi ISSUE giữa các công cụ BIM: Revit, Navisworks,
// Solibri, BIMcollab… đều mở được. Xuất clash thành BCF nghĩa là phát hiện
// của WeBIM đi tiếp được vào quy trình của đội dùng công cụ khác — liên
// thông thật, không phải screenshot dán vào email.
//
// File .bcf là một ZIP: `bcf.version` + mỗi topic một thư mục
// `<guid>/markup.bcf`. Viewpoint là tuỳ chọn theo chuẩn — bản này chưa kèm
// (WeBIM chưa xuất camera), và đó là thiếu sót nói được chứ không phải lỗi.
//
// ZIP viết tay ở chế độ STORE (không nén) — vài chục topic XML thì nén
// không đáng một dependency; CRC32 chuẩn, cấu trúc local header + central
// directory + EOCD đúng spec để mọi unzip đều mở được.

import type { ClashItem } from "./clash";

// ── CRC32 (bảng chuẩn IEEE 802.3) ─────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── ZIP store-only ────────────────────────────────────────────────────────

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (value: number) => new Uint8Array([value & 0xff, (value >> 8) & 0xff]);
  const u32 = (value: number) =>
    new Uint8Array([
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff,
    ]);
  const concat = (...parts: Uint8Array[]) => {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  };

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const local = concat(
      u32(0x04034b50),
      u16(20), // version needed
      u16(0), // flags
      u16(0), // method: store
      u16(0), u16(0), // time, date
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0), // extra
      name,
      entry.data,
    );
    central.push(
      concat(
        u32(0x02014b50),
        u16(20), u16(20), u16(0), u16(0),
        u16(0), u16(0),
        u32(crc),
        u32(entry.data.length),
        u32(entry.data.length),
        u16(name.length),
        u16(0), u16(0), u16(0), u16(0),
        u32(0),
        u32(offset),
        name,
      ),
    );
    chunks.push(local);
    offset += local.length;
  }

  const centralBytes = concat(...central);
  const eocd = concat(
    u32(0x06054b50),
    u16(0), u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBytes.length),
    u32(offset),
    u16(0),
  );
  return concat(...chunks, centralBytes, eocd);
}

// ── BCF ───────────────────────────────────────────────────────────────────

/** GUID xác định từ nội dung — xuất hai lần cùng một clash ra cùng một topic. */
export function deterministicGuid(seed: string): string {
  // FNV-1a 32-bit chạy 4 lượt với muối khác nhau → 128 bit hex.
  const hex: string[] = [];
  for (let round = 0; round < 4; round += 1) {
    let hash = 0x811c9dc5 ^ round;
    for (const char of seed) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hex.push(hash.toString(16).padStart(8, "0"));
  }
  const digest = hex.join("");
  return (
    `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-` +
    `a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function topicXml(
  clash: ClashItem,
  createdAt: string,
  author: string,
): { guid: string; xml: string } {
  const guid = deterministicGuid(`${clash.aId}|${clash.bId}|${clash.kind}`);
  const title = `Va chạm: ${clash.aName} × ${clash.bName}`;
  const description =
    `Loại ${clash.kind}, xuyên ước tính ${clash.depth.toFixed(3)} m. ` +
    `Sàng lọc AABB bởi WeBIM — kiểm hình học chi tiết trước khi xử lý.`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Markup xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Topic Guid="${guid}" TopicType="Clash" TopicStatus="Open">
    <Title>${escapeXml(title)}</Title>
    <CreationDate>${createdAt}</CreationDate>
    <CreationAuthor>${escapeXml(author)}</CreationAuthor>
    <Description>${escapeXml(description)}</Description>
  </Topic>
</Markup>
`;
  return { guid, xml };
}

/** Cả báo cáo va chạm → một file .bcf (ZIP) đúng BCF 2.1. */
export function clashesToBcf(
  clashes: readonly ClashItem[],
  { createdAt, author }: { createdAt: string; author: string },
): Uint8Array {
  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    {
      name: "bcf.version",
      data: encoder.encode(
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<Version VersionId="2.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
          `<DetailedVersion>2.1</DetailedVersion></Version>\n`,
      ),
    },
  ];
  for (const clash of clashes) {
    const { guid, xml } = topicXml(clash, createdAt, author);
    entries.push({ name: `${guid}/markup.bcf`, data: encoder.encode(xml) });
  }
  return buildZip(entries);
}

// ── BCF IMPORT (round-trip) ───────────────────────────────────────────────
//
// File .bcf từ Revit/Navisworks/BIMcollab là ZIP có thể nén DEFLATE (bản
// mình xuất là store-only). Unzip zero-dep bằng central directory + 
// DecompressionStream("deflate-raw") — có sẵn trong browser lẫn Node 18+.

export interface BcfTopic {
  guid: string;
  title: string;
  status: string;
  description: string;
  author: string;
}

function readU16(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8);
}
function readU32(bytes: Uint8Array, at: number): number {
  return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.buffer as ArrayBuffer]).stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Đọc mọi entry của một ZIP (store + deflate) qua central directory. */
export async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  // EOCD ở cuối file (có thể lùi vì comment) — quét ngược tìm chữ ký.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i -= 1) {
    if (readU32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Không phải file ZIP (thiếu End of Central Directory).");
  const count = readU16(bytes, eocd + 10);
  let at = readU32(bytes, eocd + 16);
  const files = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index += 1) {
    if (readU32(bytes, at) !== 0x02014b50) throw new Error("Central directory hỏng.");
    const method = readU16(bytes, at + 10);
    const compressedSize = readU32(bytes, at + 20);
    const nameLength = readU16(bytes, at + 28);
    const extraLength = readU16(bytes, at + 30);
    const commentLength = readU16(bytes, at + 32);
    const localOffset = readU32(bytes, at + 42);
    const name = new TextDecoder().decode(bytes.slice(at + 46, at + 46 + nameLength));
    // Local header có name/extra RIÊNG (có thể khác central) — đọc lại.
    const localNameLength = readU16(bytes, localOffset + 26);
    const localExtraLength = readU16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.slice(dataStart, dataStart + compressedSize);
    if (method === 0) {
      files.set(name, raw);
    } else if (method === 8) {
      files.set(name, await inflateRaw(raw));
    } else {
      throw new Error(`ZIP dùng phương thức nén ${method} chưa hỗ trợ.`);
    }
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function xmlText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return (match?.[1] ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

/** Đọc topics từ một file .bcf — của WeBIM hay của tool khác đều được. */
export async function parseBcf(bytes: Uint8Array): Promise<BcfTopic[]> {
  const files = await unzip(bytes);
  const topics: BcfTopic[] = [];
  for (const [name, data] of files) {
    if (!name.endsWith("markup.bcf")) continue;
    const xml = new TextDecoder().decode(data);
    const topicTag = xml.match(/<Topic\s[^>]*>/)?.[0] ?? "";
    topics.push({
      guid: topicTag.match(/Guid="([^"]+)"/)?.[1] ?? name.split("/")[0],
      status: topicTag.match(/TopicStatus="([^"]+)"/)?.[1] ?? "",
      title: xmlText(xml, "Title"),
      description: xmlText(xml, "Description"),
      author: xmlText(xml, "CreationAuthor") || xmlText(xml, "ModifiedAuthor"),
    });
  }
  return topics;
}
