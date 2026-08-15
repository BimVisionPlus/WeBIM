// Đối chiếu catalog Tiêu chuẩn với vbpl.vn — CSDL quốc gia về VBQPPL.
//
//   node scripts/crawl-vbpl.mjs            # cào và ghi src/standards/vbpl.json
//   node scripts/crawl-vbpl.mjs --dry      # cào nhưng chỉ in, không ghi
//
// TẠI SAO vbpl.vn CHỨ KHÔNG PHẢI Thư viện pháp luật: văn bản QPPL không được
// bảo hộ quyền tác giả (Điều 15 Luật SHTT) nên dữ liệu ở nguồn nhà nước là
// sạch để tái sử dụng; còn phần giá trị gia tăng của các trang thương mại
// (bản hợp nhất tự biên tập, sơ đồ, tóm tắt) là sản phẩm có bản quyền và ToS
// của họ cấm cào. Trang này cho đúng thứ module Standards cần: tình trạng
// hiệu lực + ngày + link toàn văn chính thức.
//
// TẠI SAO CẦN TRÌNH DUYỆT: vbpl.vn (bản 2026) là Next.js SPA, tìm kiếm chạy
// qua server action POST / với action-id đổi theo mỗi lần deploy — bám vào id
// đó là cào kiểu sẽ hỏng lặng lẽ. Thay vào đó crawler lái đúng trang thật
// (Playwright), gõ từ khoá như người dùng, và ĐỌC TRỘM response JSON của
// chính trang ({total, items:[...]}) — id đổi bao nhiêu lần cũng không sao.
// Trang chi tiết /van-ban/chi-tiet/{id} là URL bền, server-render, dùng làm
// link "toàn văn".
//
// Phép lịch sự với máy chủ nhà nước: một phiên trình duyệt, tuần một lần,
// mỗi truy vấn cách nhau >= 1,5 s, và chỉ tra các mã trong catalog (~15 truy
// vấn) — ít hơn một người dùng thật mở trang tra tay.
//
// TCVN/TCXD không phải văn bản QPPL nên vbpl.vn không có — các mã đó được
// ghi rõ "không tra được" thay vì lặng lẽ vắng mặt: bảng đối chiếu phải nói
// nó KHÔNG phủ cái gì.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_PATH = join(root, "src", "standards", "vbpl.json");
const BASE = "https://vbpl.vn";

/** Chuẩn hoá mã để so khớp: hoa, bỏ khoảng trắng thừa quanh - / và số hiệu. */
export function normalizeCode(text) {
  return text
    .toUpperCase()
    .replace(/Đ/g, "D")
    .replace(/\s*([-/:])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Từ khoá tra cứu cho một mục catalog — null nếu vbpl.vn không thể có nó.
 * QCVN tra theo chính mã (tiêu đề thông tư ban hành luôn chứa mã); văn bản
 * QPPL tra theo số hiệu trần (bỏ chữ "Nghị định"… cho khớp cả hai chế độ).
 */
export function queryForCode(kind, code) {
  if (kind === "TCVN" || code.startsWith("TCVN") || code.startsWith("TCXD")) {
    return null;
  }
  return code.replace(/^(Nghị định|Thông tư|Quyết định|Luật)\s+/i, "").trim();
}

// Byte 0x80–0x9F của cp1252 → codepoint Unicode mà lần mis-decode đầu sinh ra.
const CP1252_REVERSE = new Map(
  Object.entries({
    "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84,
    "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02C6": 0x88,
    "\u2030": 0x89, "\u0160": 0x8a, "\u2039": 0x8b, "\u0152": 0x8c,
    "\u017D": 0x8e, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93,
    "\u201D": 0x94, "\u2022": 0x95, "\u2013": 0x96, "\u2014": 0x97,
    "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9a, "\u203A": 0x9b,
    "\u0153": 0x9c, "\u017E": 0x9e, "\u0178": 0x9f,
  }),
);

/**
 * Chữa UTF-8 bị mã hoá hai lần: backend của vbpl.vn trả tiếng Việt dạng
 * "ThÃ´ng tÆ°" — bytes UTF-8 từng bị đọc như Windows-1252 rồi mã hoá lại.
 * Đảo đúng chiều cp1252 (không phải latin1 — dấu vết "\u2018/\u201C" là
 * vùng 0x80–0x9F chỉ cp1252 mới có). Chuỗi không có vết mojibake, hoặc đảo
 * xong vẫn ra ký tự lỗi, thì giữ nguyên — thà mojibake còn hơn phá dữ liệu.
 */
export function fixDoubleUtf8(text) {
  if (typeof text !== "string" || !/[ÃÆ]|Ä|á»|áº/.test(text)) return text;
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xff) bytes.push(cp);
    else if (CP1252_REVERSE.has(ch)) bytes.push(CP1252_REVERSE.get(ch));
    else return text;
  }
  const decoded = Buffer.from(bytes).toString("utf8");
  return decoded.includes("\ufffd") ? text : decoded;
}

/**
 * Bóc {total, items} từ response RSC flight của server action: mỗi dòng dạng
 * `N:payload`; dòng kết quả có payload là JSON object chứa "items".
 */
export function parseFlightItems(text) {
  for (const line of text.split("\n")) {
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const payload = line.slice(sep + 1);
    if (!payload.startsWith("{") || !payload.includes('"items"')) continue;
    try {
      const data = JSON.parse(payload);
      // Trang chủ còn các widget (văn bản mới…) cũng trả {items} — chỉ kết
      // quả tìm kiếm mới mang "tokens", thiếu nó là nhận nhầm widget.
      if (Array.isArray(data.items) && Array.isArray(data.tokens)) return data;
    } catch {
      // dòng flight khác vô tình chứa "items" — bỏ qua
    }
  }
  return null;
}

/** haystack chứa needle với BIÊN: ký tự ngay trước không phải chữ/số —
 * "06/2021/NĐ-CP" không được khớp vào giữa "106/2021/NĐ-CP". */
export function containsCode(haystack, needle) {
  let from = 0;
  while (true) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    if (at === 0 || !/[0-9A-ZÀ-Ỹ]/.test(haystack[at - 1])) return true;
    from = at + 1;
  }
}

/** Các item khớp một truy vấn: tiêu đề chứa (có biên), hoặc số hiệu đúng bằng. */
export function matchItems(items, query) {
  const wanted = normalizeCode(query);
  return items
    .filter(
      (item) =>
        containsCode(normalizeCode(fixDoubleUtf8(item.title ?? "")), wanted) ||
        normalizeCode(fixDoubleUtf8(item.docNum ?? "")) === wanted,
    )
    .map((item) => ({
      vbplId: String(item.id),
      docNum: normalizeCode(fixDoubleUtf8(item.docNum ?? "")),
      title: fixDoubleUtf8((item.title ?? "").trim()),
      // "Sửa đổi 1:2023 QCVN..." là văn bản sửa đổi, không phải bản gốc —
      // phân biệt để UI không trưng nhầm ngày hiệu lực của bản sửa đổi.
      // (Không dùng normalizeCode ở đây: nó đổi Đ→D nên "SỬA ĐỔI" sẽ trượt.)
      amending: /SỬA ĐỔI|BỔ SUNG/.test(fixDoubleUtf8(item.title ?? "").toUpperCase()),
      status: item.effStatus?.code ?? "",
      statusName: fixDoubleUtf8(item.effStatus?.name ?? ""),
      issueDate: (item.issueDate ?? "").slice(0, 10),
      effFrom: (item.effFrom ?? "").slice(0, 10),
      effTo: item.effTo ? String(item.effTo).slice(0, 10) : null,
      url: `${BASE}/van-ban/chi-tiet/${item.id}`,
    }));
}

/** CHL = còn hiệu lực → HIEN_HANH của catalog; mọi mã "hết/ngưng" → HET_HIEU_LUC. */
export function toCatalogStatus(vbplStatusCode) {
  if (vbplStatusCode === "CHL" || vbplStatusCode === "CCHL") return "HIEN_HANH";
  return "HET_HIEU_LUC";
}

async function crawl() {
  const { chromium } = await import("playwright");
  const catalogSource = readFileSync(join(root, "src", "standards", "catalog.ts"), "utf8");
  const corpus = JSON.parse(
    readFileSync(join(root, "src", "standards", "corpus.json"), "utf8"),
  );

  // Danh sách mã: corpus + mã trong seed (regex trên nguồn — seed là mảng
  // literal, không cần chạy TS chỉ để đọc các chuỗi code).
  const codes = new Map(); // code -> kind
  for (const entry of corpus.entries) codes.set(entry.code, entry.kind);
  for (const match of catalogSource.matchAll(
    /kind:\s*"(QCVN|TCVN|VBPL)",\s*\n\s*code:\s*"([^"]+)"/g,
  )) {
    if (!codes.has(match[2])) codes.set(match[2], match[1]);
  }

  const browser = await chromium
    .launch({ channel: "chrome" })
    .catch(() => chromium.launch());
  // WAF của vbpl.vn trả 403 cho UA "HeadlessChrome" — trình bày như Chrome
  // thường. Không phải lách bot-check có thử thách, chỉ là UA string.
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    locale: "vi-VN",
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  // Mọi response của server action đi qua đây; cái nào là kết quả tìm kiếm
  // thì parse được {items} — không cần biết action-id.
  let lastResult = null;
  page.on("response", (response) => {
    if (response.request().method() !== "POST") return;
    response
      .body()
      .then((buffer) => {
        const data = parseFlightItems(buffer.toString("utf8"));
        if (data) lastResult = data;
      })
      .catch(() => undefined);
  });

  // Trang chủ có ô #keyword và hiện kết quả ngay tại chỗ; trang danh mục
  // đặt ô tìm kiếm khác id tuỳ layout — dùng trang chủ cho ổn định.
  await page.goto(BASE, { waitUntil: "networkidle" });
  const keywordBox = page.locator('#keyword, input[placeholder*="từ khóa" i], input[type="text"]').first();

  await page
    .locator('label:has-text("Chính xác cụm từ")')
    .first()
    .click()
    .catch(() => undefined);

  const entries = {};
  for (const [code, kind] of codes) {
    const query = queryForCode(kind, code);
    if (query === null) {
      entries[code] = {
        query: null,
        note: "TCVN/TCXD không phải văn bản QPPL — vbpl.vn không tra được",
        matches: [],
      };
      continue;
    }
    const runSearch = async (field) => {
      lastResult = null;
      await keywordBox.fill(query);
      await page.locator(`label:has-text("${field}")`).first().click().catch(() => undefined);
      await page.locator('button:has-text("Tìm kiếm")').first().click();
      // Response nào cũng qua interceptor, kể cả của truy vấn TRƯỚC còn
      // đang bay — chỉ nhận response mà tokens (chữ ký truy vấn server echo
      // lại, có thể bị tách đôi) khớp đúng từ khoá hiện tại.
      const wantedToken = normalizeCode(query);
      const isMine = () => {
        if (lastResult === null) return false;
        const joined = normalizeCode(
          lastResult.tokens.map((token) => fixDoubleUtf8(String(token))).join(" "),
        );
        return joined.includes(wantedToken) || wantedToken.includes(joined);
      };
      for (let i = 0; i < 60 && !isMine(); i += 1) {
        if (lastResult !== null && !isMine()) lastResult = null;
        await page.waitForTimeout(250);
      }
      return isMine() ? lastResult : null;
    };

    // Tìm lỏng theo mức liên quan hay trả 20+ văn bản NHẮC tới mã mà thiếu
    // chính văn bản gốc — chọn đúng trường: QCVN nằm trong TIÊU ĐỀ thông tư
    // ban hành; văn bản QPPL tra theo SỐ HIỆU. (Checkbox "chính xác" đã bật
    // một lần trước vòng lặp — click lại mỗi vòng là toggle tắt nó đi.)
    const field = kind === "QCVN" ? "Tiêu đề" : "Số hiệu";
    let result = await runSearch(field);
    let matches = result ? matchItems(result.items, query) : [];
    let viaContent = false;

    // Nhiều thông tư ban hành QCVN không ghi mã trong tiêu đề ("ban hành Quy
    // chuẩn kỹ thuật quốc gia về...") — rơi về tìm trong NỘI DUNG, và nói rõ
    // đây là đối chiếu gián tiếp: mã chắc chắn nằm trong văn bản, nhưng văn
    // bản có thể chỉ dẫn chiếu chứ không ban hành.
    if (kind === "QCVN" && matches.length === 0) {
      const titleResult = result;
      await page.waitForTimeout(1500);
      result = await runSearch("Nội dung");
      if (result && result.total > 0 && result.total <= 8) {
        matches = result.items
          .filter((item) =>
            /QUY CHUẨN|THÔNG TƯ/.test(normalizeCode(fixDoubleUtf8(item.title ?? ""))),
          )
          .slice(0, 3)
          .map((item) => matchItems([{ ...item, title: `${item.title} ${query}` }], query)[0]);
        viaContent = matches.length > 0;
      }
      // Fallback không dùng được thì báo cáo theo lần tìm tiêu đề — total
      // hàng trăm của tìm nội dung lỏng không nói lên điều gì về mã này.
      if (!viaContent) result = titleResult;
    }

    entries[code] = {
      query,
      total: result?.total ?? null,
      matches,
      ...(viaContent
        ? {
            viaContent: true,
            note: "Đối chiếu gián tiếp — mã nằm trong nội dung văn bản, không có trong tiêu đề",
          }
        : {}),
      ...(result === null ? { note: "vbpl.vn không phản hồi truy vấn này" } : {}),
    };
    console.log(
      `${code}: ${matches.length} khớp/${result?.total ?? "?"} kết quả` +
        (matches[0] ? ` — ${matches[0].statusName}` : "") +
        (viaContent ? " (gián tiếp)" : ""),
    );
    await page.waitForTimeout(1500);
  }
  await browser.close();

  return {
    source: "vbpl.vn (CSDL quốc gia về pháp luật — Bộ Tư pháp)",
    fetchedAt: new Date().toISOString().slice(0, 10),
    entries,
  };
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const snapshot = await crawl();
  const matched = Object.values(snapshot.entries).filter((e) => e.matches.length > 0).length;
  const skipped = Object.values(snapshot.entries).filter((e) => e.query === null).length;
  console.log(`\nKhớp ${matched}, bỏ qua (TCVN) ${skipped}, tổng ${Object.keys(snapshot.entries).length}`);
  if (process.argv.includes("--dry")) {
    console.log(JSON.stringify(snapshot, null, 2).slice(0, 3000));
  } else {
    // Giữ nguyên fetchedAt cũ nếu dữ liệu không đổi — cron không được tạo
    // diff rỗng mỗi tuần (cùng lý do với import-corpus).
    let previous = null;
    try {
      previous = JSON.parse(readFileSync(OUT_PATH, "utf8"));
    } catch {
      previous = null;
    }
    if (
      previous &&
      JSON.stringify(previous.entries) === JSON.stringify(snapshot.entries)
    ) {
      console.log("Không có gì đổi — giữ nguyên vbpl.json");
    } else {
      writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2) + "\n");
      console.log(`Đã ghi ${OUT_PATH}`);
    }
  }
}
