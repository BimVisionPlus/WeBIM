// Q&A trên văn bản quy chuẩn — retrieval thuần + prompt có kỷ luật trích dẫn.
//
// Kiến trúc "trích trước, trả lời sau": máy tìm các ĐIỀU KHOẢN liên quan
// bằng chấm điểm từ vựng (không cần model), rồi model chỉ được trả lời từ
// đúng những trích đoạn đó và phải ghi [n] cho mỗi khẳng định. Trích dẫn
// được kiểm lại sau khi model trả lời: [n] ngoài danh sách bị loại. Model
// bịa được câu chữ, nhưng không bịa được số điều — vì số điều do mình đưa.
//
// Retrieval là từ vựng chứ không phải embedding có chủ đích: corpus 26 điều
// khoản thì BM25-lite thắng mọi vector DB về độ đơn giản, chạy được cả khi
// chưa đăng nhập/chưa có AI (chế độ chỉ-tra-cứu vẫn hữu ích).

export interface StandardClause {
  id: string;
  document: string;
  clause: string;
  title: string;
  text: string;
  notes: string;
  tags: string[];
  severity: string;
}

/** Bỏ dấu tiếng Việt để "hanh lang" khớp "hành lang" — người gõ vội. */
export function foldDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Token chữ và số, đã thường hoá + bỏ dấu. "3.3.5" giữ nguyên dạng số chấm. */
export function tokenize(text: string): string[] {
  return foldDiacritics(text.toLowerCase())
    .split(/[^a-z0-9.]+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length >= 2 || /^\d$/.test(token));
}

const STOPWORDS = new Set([
  "la", "va", "cua", "cho", "trong", "khong", "phai", "duoc", "cac", "mot",
  "nho", "hon", "voi", "theo", "khi", "nay", "the", "nao", "bao", "nhieu",
]);

export interface RankedClause {
  clause: StandardClause;
  score: number;
}

/**
 * BM25-lite: idf × tần suất, tiêu đề nặng gấp 3, mã văn bản/số điều gấp 4.
 * Chỉ trả điều khoản có điểm dương — không độn kết quả cho đủ k.
 */
export function rankClauses(
  query: string,
  clauses: readonly StandardClause[],
  k = 5,
): RankedClause[] {
  const queryTokens = [...new Set(tokenize(query))].filter(
    (token) => !STOPWORDS.has(token),
  );
  if (queryTokens.length === 0) return [];

  const fields = clauses.map((clause) => ({
    title: tokenize(clause.title),
    ref: tokenize(`${clause.document} ${clause.clause} ${clause.tags.join(" ")}`),
    body: tokenize(`${clause.text} ${clause.notes}`),
  }));

  const documentFrequency = new Map<string, number>();
  for (const field of fields) {
    const seen = new Set([...field.title, ...field.ref, ...field.body]);
    for (const token of seen) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const idf = (token: string) =>
    Math.log(1 + clauses.length / (1 + (documentFrequency.get(token) ?? 0)));

  const scored = clauses.map((clause, index) => {
    const field = fields[index];
    let score = 0;
    for (const token of queryTokens) {
      const weight = idf(token);
      const count = (list: string[]) => list.filter((t) => t === token).length;
      score +=
        weight *
        (4 * count(field.ref) + 3 * count(field.title) + Math.min(count(field.body), 3));
    }
    return { clause, score };
  });
  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Trích đoạn đánh số gửi cho model — [n] là hợp đồng trích dẫn. */
export function excerptsOf(hits: readonly RankedClause[]): { label: string; text: string }[] {
  return hits.map(({ clause }, index) => ({
    label: `[${index + 1}] ${clause.document}, điều ${clause.clause} — ${clause.title}`,
    text: clause.text + (clause.notes ? `\n(Giới hạn: ${clause.notes})` : ""),
  }));
}

/**
 * Các chỉ số [n] model đã trích, đã lọc: chỉ giữ n trong 1..count, bỏ trùng.
 * Trả về kèm cờ có-trích-dẫn-lạ để UI cảnh báo thay vì im lặng.
 */
export function citedIndices(
  answer: string,
  count: number,
): { indices: number[]; invalid: number[] } {
  const indices: number[] = [];
  const invalid: number[] = [];
  for (const match of answer.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= count) {
      if (!indices.includes(n)) indices.push(n);
    } else if (!invalid.includes(n)) {
      invalid.push(n);
    }
  }
  return { indices, invalid };
}
