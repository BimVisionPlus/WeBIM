// Seed catalog of Vietnamese construction standards (QCVN / TCVN).
//
// This is a bootstrap dataset for the lookup module: enough structure to
// prove search, tagging and supersession chains. Entries must be checked
// against the official texts before relying on them — the UI shows that
// disclaimer. The long-term source of truth is the machine-checkable
// corpus (qcvn-conflict-map / plancheck).

export type StandardKind = "QCVN" | "TCVN";
export type StandardStatus = "HIEN_HANH" | "HET_HIEU_LUC";

export interface StandardEntry {
  id: string;
  kind: StandardKind;
  code: string;
  title: string;
  agency: string;
  status: StandardStatus;
  /** Code of the standard this one replaces, if known. */
  replaces?: string;
  tags: string[];
}

export const STANDARDS_CATALOG: StandardEntry[] = [
  {
    id: "qcvn-06-2022",
    kind: "QCVN",
    code: "QCVN 06:2022/BXD",
    title: "Quy chuẩn kỹ thuật quốc gia về An toàn cháy cho nhà và công trình (kèm Sửa đổi 1:2023)",
    agency: "Bộ Xây dựng",
    status: "HIEN_HANH",
    replaces: "QCVN 06:2021/BXD",
    tags: ["an toàn cháy", "PCCC", "thoát nạn", "nhà cao tầng"],
  },
  {
    id: "qcvn-04-2021",
    kind: "QCVN",
    code: "QCVN 04:2021/BXD",
    title: "Quy chuẩn kỹ thuật quốc gia về Nhà chung cư",
    agency: "Bộ Xây dựng",
    status: "HIEN_HANH",
    replaces: "QCVN 04:2019/BXD",
    tags: ["chung cư", "nhà ở", "diện tích căn hộ"],
  },
  {
    id: "qcvn-01-2021",
    kind: "QCVN",
    code: "QCVN 01:2021/BXD",
    title: "Quy chuẩn kỹ thuật quốc gia về Quy hoạch xây dựng",
    agency: "Bộ Xây dựng",
    status: "HIEN_HANH",
    replaces: "QCVN 01:2019/BXD",
    tags: ["quy hoạch", "mật độ xây dựng", "hệ số sử dụng đất", "khoảng lùi"],
  },
  {
    id: "qcvn-02-2022",
    kind: "QCVN",
    code: "QCVN 02:2022/BXD",
    title: "Quy chuẩn kỹ thuật quốc gia về Số liệu điều kiện tự nhiên dùng trong xây dựng",
    agency: "Bộ Xây dựng",
    status: "HIEN_HANH",
    replaces: "QCVN 02:2009/BXD",
    tags: ["khí hậu", "gió", "số liệu tự nhiên"],
  },
  {
    id: "qcvn-03-2022",
    kind: "QCVN",
    code: "QCVN 03:2022/BXD",
    title: "Quy chuẩn kỹ thuật quốc gia về Phân cấp công trình phục vụ thiết kế xây dựng",
    agency: "Bộ Xây dựng",
    status: "HIEN_HANH",
    tags: ["phân cấp công trình", "niên hạn", "cấp công trình"],
  },
  {
    id: "qcvn-09-2017",
    kind: "QCVN",
    code: "QCVN 09:2017/BXD",
    title: "Quy chuẩn kỹ thuật quốc gia về Các công trình xây dựng sử dụng năng lượng hiệu quả",
    agency: "Bộ Xây dựng",
    status: "HIEN_HANH",
    tags: ["năng lượng", "vỏ bao che", "OTTV"],
  },
  {
    id: "qcvn-10-2023",
    kind: "QCVN",
    code: "QCVN 10:2023/BXD",
    title: "Quy chuẩn kỹ thuật quốc gia về Xây dựng công trình đảm bảo người khuyết tật tiếp cận sử dụng",
    agency: "Bộ Xây dựng",
    status: "HIEN_HANH",
    replaces: "QCVN 10:2014/BXD",
    tags: ["tiếp cận", "người khuyết tật", "ramp dốc"],
  },
  {
    id: "qcvn-07-2016",
    kind: "QCVN",
    code: "QCVN 07:2016/BXD",
    title: "Quy chuẩn kỹ thuật quốc gia về Các công trình hạ tầng kỹ thuật (bộ 07:2016, đang được thay thế dần bởi bộ 07:2023)",
    agency: "Bộ Xây dựng",
    status: "HIEN_HANH",
    tags: ["hạ tầng", "cấp nước", "thoát nước", "chiếu sáng"],
  },
  {
    id: "tcvn-2737-2023",
    kind: "TCVN",
    code: "TCVN 2737:2023",
    title: "Tải trọng và tác động — Tiêu chuẩn thiết kế",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    replaces: "TCVN 2737:1995",
    tags: ["tải trọng", "gió", "hoạt tải", "kết cấu"],
  },
  {
    id: "tcvn-5574-2018",
    kind: "TCVN",
    code: "TCVN 5574:2018",
    title: "Thiết kế kết cấu bê tông và bê tông cốt thép",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    replaces: "TCVN 5574:2012",
    tags: ["bê tông cốt thép", "kết cấu", "thiết kế"],
  },
  {
    id: "tcvn-5575-2012",
    kind: "TCVN",
    code: "TCVN 5575:2012",
    title: "Kết cấu thép — Tiêu chuẩn thiết kế",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    tags: ["kết cấu thép", "thiết kế"],
  },
  {
    id: "tcvn-9362-2012",
    kind: "TCVN",
    code: "TCVN 9362:2012",
    title: "Tiêu chuẩn thiết kế nền nhà và công trình",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    tags: ["nền móng", "địa kỹ thuật"],
  },
  {
    id: "tcvn-10304-2014",
    kind: "TCVN",
    code: "TCVN 10304:2014",
    title: "Móng cọc — Tiêu chuẩn thiết kế",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    tags: ["móng cọc", "nền móng"],
  },
  {
    id: "tcvn-9386-2012",
    kind: "TCVN",
    code: "TCVN 9386:2012",
    title: "Thiết kế công trình chịu động đất",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    tags: ["động đất", "kháng chấn", "kết cấu"],
  },
  {
    id: "tcvn-4453-1995",
    kind: "TCVN",
    code: "TCVN 4453:1995",
    title: "Kết cấu bê tông và bê tông cốt thép toàn khối — Quy phạm thi công và nghiệm thu",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    tags: ["thi công", "nghiệm thu", "bê tông"],
  },
  {
    id: "tcvn-4055-2012",
    kind: "TCVN",
    code: "TCVN 4055:2012",
    title: "Công trình xây dựng — Tổ chức thi công",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    tags: ["tổ chức thi công", "tiến độ"],
  },
  {
    id: "tcvn-9385-2012",
    kind: "TCVN",
    code: "TCVN 9385:2012",
    title: "Chống sét cho công trình xây dựng — Hướng dẫn thiết kế, kiểm tra và bảo trì hệ thống",
    agency: "Bộ KH&CN",
    status: "HIEN_HANH",
    tags: ["chống sét", "MEP"],
  },
];

/** Case/diacritic-insensitive search across code, title and tags. */
export function searchStandards(
  query: string,
  entries: StandardEntry[] = STANDARDS_CATALOG,
): StandardEntry[] {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/g, "d");
  const needle = normalize(query.trim());
  if (!needle) return entries;
  return entries.filter((entry) =>
    [entry.code, entry.title, ...entry.tags].some((field) =>
      normalize(field).includes(needle),
    ),
  );
}

/** The chain of documents an entry replaces, following `replaces` codes. */
export function supersessionChain(
  entry: StandardEntry,
  entries: StandardEntry[] = STANDARDS_CATALOG,
): string[] {
  const chain: string[] = [];
  let current: StandardEntry | undefined = entry;
  while (current?.replaces) {
    chain.push(current.replaces);
    current = entries.find((candidate) => candidate.code === current!.replaces);
  }
  return chain;
}
