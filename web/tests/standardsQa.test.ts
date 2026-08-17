import { describe, expect, it } from "vitest";
import {
  citedIndices,
  excerptsOf,
  foldDiacritics,
  rankClauses,
  tokenize,
  type StandardClause,
} from "../src/application/standardsQa";
import { CLAUSES } from "../src/standards/clauses";

const clause = (over: Partial<StandardClause>): StandardClause => ({
  id: "X",
  document: "QCVN 00:2000/BXD",
  clause: "1.1",
  title: "",
  text: "",
  notes: "",
  tags: [],
  severity: "error",
  ...over,
});

describe("tokenize", () => {
  it("bỏ dấu để câu hỏi gõ vội vẫn khớp", () => {
    expect(foldDiacritics("hành lang thoát nạn Đường")).toBe("hanh lang thoat nan Duong");
    expect(tokenize("Hành lang 1,2 m")).toContain("hanh");
    expect(tokenize("Hành lang 1,2 m")).toContain("lang");
  });

  it("giữ số điều dạng chấm", () => {
    expect(tokenize("điều 3.3.5 của QCVN")).toContain("3.3.5");
  });
});

describe("rankClauses", () => {
  const corpus: StandardClause[] = [
    clause({
      id: "CORRIDOR",
      document: "QCVN 06:2022/BXD",
      clause: "3.3.5",
      title: "Chiều rộng hành lang thoát nạn",
      text: "Hành lang trên đường thoát nạn phải rộng thông thủy không nhỏ hơn 1,2 m.",
      tags: ["egress", "corridor"],
    }),
    clause({
      id: "BEDROOM",
      document: "QCVN 04:2021/BXD",
      clause: "2.2.6",
      title: "Diện tích tối thiểu phòng ngủ",
      text: "Phòng ngủ trong căn hộ phải có diện tích không nhỏ hơn 9 m².",
      tags: ["apartment", "bedroom"],
    }),
  ];

  it("câu hỏi có dấu lẫn không dấu đều tìm đúng điều khoản", () => {
    for (const query of ["hành lang thoát nạn rộng bao nhiêu", "hanh lang thoat nan"]) {
      const hits = rankClauses(query, corpus);
      expect(hits[0]?.clause.id).toBe("CORRIDOR");
    }
  });

  it("không độn kết quả: câu hỏi lạc đề trả về rỗng", () => {
    expect(rankClauses("zzz qqq", corpus)).toHaveLength(0);
  });

  it("câu dài chỉ khớp MỘT token lẻ (nhiễu bỏ dấu) cũng bị loại", () => {
    // "giá vàng" bỏ dấu dính "gia"/"vang" khớp lung tung trong corpus thật.
    expect(rankClauses("giá vàng hôm nay thế nào", CLAUSES)).toHaveLength(0);
  });

  it("hỏi bằng số điều khoản tìm thẳng được", () => {
    const hits = rankClauses("3.3.5", corpus);
    expect(hits[0]?.clause.id).toBe("CORRIDOR");
  });

  it("corpus thật: hỏi phòng ngủ ra điều khoản phòng ngủ", () => {
    const hits = rankClauses("phòng ngủ tối thiểu bao nhiêu m2", CLAUSES);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].clause.tags).toContain("bedroom");
  });
});

describe("excerptsOf", () => {
  it("đánh số [n] và kèm giới hạn của điều khoản", () => {
    const excerpts = excerptsOf([
      { clause: clause({ clause: "3.3.5", title: "T", text: "X", notes: "N" }), score: 1 },
    ]);
    expect(excerpts[0].label).toContain("[1]");
    expect(excerpts[0].label).toContain("3.3.5");
    expect(excerpts[0].text).toContain("Giới hạn: N");
  });
});

describe("citedIndices", () => {
  it("lấy [n] hợp lệ, giữ thứ tự, bỏ trùng", () => {
    expect(citedIndices("Theo [1] và [2], xem thêm [1].", 3).indices).toEqual([1, 2]);
  });

  it("trích dẫn ngoài danh sách bị tách riêng để cảnh báo — model không được bịa nguồn", () => {
    const { indices, invalid } = citedIndices("Theo [7] thì được phép.", 3);
    expect(indices).toEqual([]);
    expect(invalid).toEqual([7]);
  });
});
