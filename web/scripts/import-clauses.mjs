// Import điều khoản mức-câu-chữ từ plancheck (building code as
// machine-readable rules) vào module Tiêu chuẩn — làm nền cho Q&A có trích
// điều khoản.
//
//   node scripts/import-clauses.mjs [path-to-plancheck]
//
// Đọc plancheck/rules/tcvn/*.toml và ghi src/standards/clauses.json. Mỗi
// rule là MỘT điều khoản đã máy-đọc: mã văn bản + số điều + nội dung chuẩn
// tắc (description) + ghi chú giới hạn (notes). Q&A chỉ được trả lời từ
// những trích đoạn này — không có trong corpus thì nói "không đủ căn cứ",
// không đoán.
//
// Cùng triết lý import-corpus.mjs: ghi rõ nguồn + revision, và import không
// đổi gì thì không chạm file (đừng để timestamp chôn vùi thay đổi thật).

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Parser TOML tối thiểu cho rule plancheck: key = giá trị ở top-level và
 * trong bảng [tên] một tầng; chuỗi """ nhiều dòng GIỮ nội dung (khác
 * import-corpus vốn bỏ qua — ở đây nội dung điều khoản chính là dữ liệu).
 * Bảng [[fixtures]] và mọi bảng lồng sâu bị bỏ qua có chủ đích.
 */
export function parseRuleToml(text) {
  const root = {};
  let table = root;
  let tableName = "";
  let multilineKey = null;
  let multilineParts = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (multilineKey !== null) {
      if (line.trim().endsWith('"""')) {
        const last = line.trim().slice(0, -3);
        if (last) multilineParts.push(last);
        table[multilineKey] = multilineParts.join("\n").replace(/\\\n/g, "");
        multilineKey = null;
        multilineParts = [];
      } else {
        multilineParts.push(line);
      }
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith("[[")) {
      table = null; // mảng bảng (fixtures…) — ngoài phạm vi
      continue;
    }
    if (trimmed.startsWith("[")) {
      tableName = trimmed.slice(1, -1);
      if (tableName.includes(".")) {
        table = null; // bảng lồng (check.values…) — ngoài phạm vi
      } else {
        table = {};
        root[tableName] = table;
      }
      continue;
    }
    if (!table) continue;
    const match = trimmed.match(/^([A-Za-z_]+)\s*=\s*(.+)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (rawValue.startsWith('"""')) {
      const rest = rawValue.slice(3);
      if (rest.endsWith('"""') && rest.length >= 3) {
        table[key] = rest.slice(0, -3);
      } else {
        multilineKey = key;
        multilineParts = rest ? [rest] : [];
      }
      continue;
    }
    if (rawValue.startsWith("[")) {
      table[key] = [...rawValue.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
      continue;
    }
    if (rawValue.startsWith('"')) {
      table[key] = rawValue.slice(1).replace(/"\s*(#.*)?$/, "");
      continue;
    }
    if (rawValue === "true" || rawValue === "false") {
      table[key] = rawValue === "true";
    }
  }
  return root;
}

export function ruleToClause(rule) {
  const source = rule.source ?? {};
  if (!rule.id || !source.document || !rule.description) return null;
  return {
    id: rule.id,
    document: source.document,
    clause: source.clause ?? "",
    title: rule.title ?? rule.id,
    text: rule.description.trim(),
    notes: (rule.notes ?? "").trim(),
    tags: rule.tags ?? [],
    severity: rule.severity ?? "",
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const repo = process.argv[2] ?? join(here, "..", "..", "..", "plancheck");
const rulesDir = join(repo, "plancheck", "rules", "tcvn");
if (!existsSync(rulesDir)) {
  console.error(`Không thấy ${rulesDir} — truyền đường dẫn repo plancheck.`);
  process.exit(1);
}

let revision = "";
try {
  revision = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {
  // repo không phải git checkout — vẫn import, chỉ thiếu revision.
}

const clauses = readdirSync(rulesDir)
  .filter((name) => name.endsWith(".toml"))
  .sort()
  .map((name) => ruleToClause(parseRuleToml(readFileSync(join(rulesDir, name), "utf8"))))
  .filter(Boolean);

const outPath = join(here, "..", "src", "standards", "clauses.json");
const previous = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : null;
if (previous && JSON.stringify(previous.clauses) === JSON.stringify(clauses)) {
  console.log(`Không đổi (${clauses.length} điều khoản) — giữ nguyên file.`);
  process.exit(0);
}

writeFileSync(
  outPath,
  JSON.stringify(
    {
      source: "https://github.com/sophie-nguyenthuthuy/plancheck",
      revision,
      importedAt: new Date().toISOString().slice(0, 10),
      clauses,
    },
    null,
    1,
  ) + "\n",
);
console.log(`Đã ghi ${clauses.length} điều khoản → src/standards/clauses.json`);
