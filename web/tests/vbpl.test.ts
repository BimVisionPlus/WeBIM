// Đối chiếu vbpl.vn — kiểm các hàm thuần của crawler (parse flight, chữa
// double-UTF-8, match có biên) và phần merge vào catalog.

import { describe, expect, it } from "vitest";
import {
  containsCode,
  fixDoubleUtf8,
  matchItems,
  normalizeCode,
  parseFlightItems,
  queryForCode,
  toCatalogStatus,
  // @ts-expect-error — script .mjs không có type declarations; API là hàm thuần.
} from "../scripts/crawl-vbpl.mjs";
import { STANDARDS_CATALOG } from "../src/standards/catalog";
import vbplData from "../src/standards/vbpl.json";

describe("normalizeCode", () => {
  it("bỏ khoảng trắng quanh dấu nối và đổi Đ→D", () => {
    expect(normalizeCode("09/2023/TT- BXD")).toBe("09/2023/TT-BXD");
    expect(normalizeCode("06/2021/NĐ-CP")).toBe("06/2021/ND-CP");
    expect(normalizeCode("qcvn 06 : 2022 / bxd")).toBe("QCVN 06:2022/BXD");
  });
});

describe("fixDoubleUtf8", () => {
  it("chữa tiếng Việt bị mã hoá hai lần (kể cả vùng cp1252)", () => {
    expect(fixDoubleUtf8("CÃ²n hiá»‡u lá»±c")).toBe("Còn hiệu lực");
    expect(fixDoubleUtf8("ThÃ´ng tÆ°")).toBe("Thông tư");
    // "NĐ" → utf8 C4 90 → cp1252 hiện "Ä" + control 0x90
    expect(fixDoubleUtf8("NÄ-CP")).toBe("NĐ-CP");
  });

  it("chuỗi sạch giữ nguyên", () => {
    expect(fixDoubleUtf8("Còn hiệu lực")).toBe("Còn hiệu lực");
    expect(fixDoubleUtf8("06/2022/TT-BXD")).toBe("06/2022/TT-BXD");
  });
});

describe("containsCode — biên số hiệu", () => {
  it("không khớp giữa một số hiệu dài hơn", () => {
    expect(containsCode("NGHỊ DỊNH SỐ 106/2021/ND-CP", "06/2021/ND-CP")).toBe(false);
    expect(containsCode("NGHỊ DỊNH SỐ 06/2021/ND-CP", "06/2021/ND-CP")).toBe(true);
  });
});

describe("parseFlightItems", () => {
  it("bóc đúng dòng kết quả tìm kiếm và bỏ qua widget thiếu tokens", () => {
    const flight =
      '0:["$@1",["x",null]]\n' +
      '1:{"total":9,"pageSize":5,"items":[{"id":"1"}]}\n' + // widget — không tokens
      '2:{"total":2,"pageSize":20,"tokens":["06/2022/TT-BXD"],"items":[{"id":"159422"}]}\n';
    const data = parseFlightItems(flight);
    expect(data.total).toBe(2);
    expect(data.tokens).toEqual(["06/2022/TT-BXD"]);
  });

  it("không có dòng hợp lệ thì trả null", () => {
    expect(parseFlightItems('0:["$@1"]\n1:{"x":1}')).toBeNull();
  });
});

describe("matchItems", () => {
  // Mojibake sinh bằng chính phép lỗi của backend (utf8 đọc như latin1) —
  // gõ tay chuỗi mojibake rất dễ sai một ký tự vô hình (nbsp, control).
  const moji = (text: string) => Buffer.from(text, "utf8").toString("latin1");
  const items = [
    {
      id: "162885",
      title: moji("Thông tư số 09/2023/TT- BXD Ban hành Sửa đổi 1:2023 QCVN 06:2022/BXD"),
      docNum: "09/2023/TT- BXD",
      effStatus: { code: "CHL", name: "CÃ²n hiá»‡u lá»±c" },
      issueDate: "2023-10-16T00:00:00",
      effFrom: "2023-12-01T00:00:00",
      effTo: null,
    },
    {
      id: "999",
      title: "Văn bản không liên quan",
      docNum: "01/2020/TT-BYT",
      effStatus: { code: "HHLTB", name: "Hết hiệu lực toàn bộ" },
      issueDate: "2020-01-01T00:00:00",
      effFrom: "2020-02-01T00:00:00",
      effTo: "2021-01-01T00:00:00",
    },
  ];

  it("khớp qua tiêu đề mojibake, chữa dữ liệu và gắn cờ sửa đổi", () => {
    const matches = matchItems(items, "QCVN 06:2022/BXD");
    expect(matches).toHaveLength(1);
    expect(matches[0].docNum).toBe("09/2023/TT-BXD");
    expect(matches[0].statusName).toBe("Còn hiệu lực");
    expect(matches[0].amending).toBe(true);
    expect(matches[0].url).toBe("https://vbpl.vn/van-ban/chi-tiet/162885");
    expect(matches[0].effFrom).toBe("2023-12-01");
  });

  it("khớp theo số hiệu đúng bằng", () => {
    expect(matchItems(items, "01/2020/TT-BYT")).toHaveLength(1);
    expect(matchItems(items, "1/2020/TT-BYT")).toHaveLength(0);
  });
});

describe("queryForCode / toCatalogStatus", () => {
  it("TCVN/TCXD không tra được, văn bản QPPL bỏ tiền tố loại", () => {
    expect(queryForCode("TCVN", "TCVN 2622:1995")).toBeNull();
    expect(queryForCode("QCVN", "TCXD 16:1986")).toBeNull();
    expect(queryForCode("NGHI_DINH", "Nghị định 06/2021/NĐ-CP")).toBe("06/2021/NĐ-CP");
    expect(queryForCode("QCVN", "QCVN 06:2022/BXD")).toBe("QCVN 06:2022/BXD");
  });

  it("chỉ CHL/CCHL là hiện hành", () => {
    expect(toCatalogStatus("CHL")).toBe("HIEN_HANH");
    expect(toCatalogStatus("HHLTB")).toBe("HET_HIEU_LUC");
    expect(toCatalogStatus("HHLMP")).toBe("HET_HIEU_LUC");
  });
});

describe("catalog merge (dữ liệu snapshot thật)", () => {
  it("snapshot có cấu trúc và không còn mojibake", () => {
    const entries = Object.values(
      (vbplData as { entries: Record<string, { matches: { statusName: string; title: string }[] }> })
        .entries,
    );
    expect(entries.length).toBeGreaterThan(10);
    for (const entry of entries) {
      for (const match of entry.matches) {
        expect(match.statusName).not.toMatch(/Ã|á»/);
        expect(match.title).not.toMatch(/Ã|á»/);
      }
    }
  });

  it("QCVN 06:2022/BXD có link vbpl, bản gốc đứng trước bản sửa đổi", () => {
    const entry = STANDARDS_CATALOG.find((row) => row.code === "QCVN 06:2022/BXD");
    expect(entry?.vbpl?.length).toBeGreaterThanOrEqual(2);
    expect(entry?.vbpl?.[0].amending).toBe(false);
    expect(entry?.vbpl?.[0].url).toContain("vbpl.vn/van-ban/chi-tiet/");
    expect(entry?.vbplCheckedAt).toBeTruthy();
  });

  it("lệch tình trạng được nói ra thay vì im lặng (NĐ 06/2021 đã hết hiệu lực)", () => {
    const entry = STANDARDS_CATALOG.find((row) => row.code === "Nghị định 06/2021/NĐ-CP");
    expect(entry?.vbpl?.[0].statusName).toContain("Hết hiệu lực");
    // Catalog đang ghi hiện hành → phải có cảnh báo lệch.
    if (entry?.status === "HIEN_HANH") {
      expect(entry?.vbplMismatch).toContain("vbpl.vn ghi");
    }
  });

  it("TCVN mang ghi chú vì sao không đối chiếu được", () => {
    const entry = STANDARDS_CATALOG.find((row) => row.code === "TCVN 2622:1995");
    expect(entry?.vbpl).toBeUndefined();
    expect(entry?.vbplNote).toContain("không phải văn bản QPPL");
  });
});
