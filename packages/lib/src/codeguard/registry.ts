/**
 * CodeGuard baseline TCVN/QCVN seed registry.
 *
 * This file is the curated seed corpus — production wires up an updater that
 * pulls from luatvietnam.vn / TCVN portal and persists into the Regulation
 * table. For now we hand-curate the 10 most-cited standards in VN AEC so
 * the platform demonstrates depth out of the box.
 *
 * To extend: append entries here and re-run the seeder. Each entry maps
 * 1:1 to a Regulation row + 0-N CodeRule rows.
 */

export type RegulationSeed = {
  code: string;
  kind: "TCVN" | "QCVN" | "LUAT" | "NGHI_DINH" | "THONG_TU" | "QUYET_DINH" | "CONG_VAN";
  title: string;
  body?: string;
  issuedBy?: string;
  effectiveAt?: string; // YYYY-MM-DD
  tags?: string[];
  rules?: RuleSeed[];
};

export type RuleSeed = {
  code: string; // internal stable id
  clauseRef: string;
  title: string;
  description?: string;
  severity: "INFO" | "WARNING" | "BLOCKING";
  category?: string;
  /** Optional declarative check spec — interpreted by the runner if present. */
  check?: Record<string, unknown>;
};

export const BASELINE_REGULATIONS: RegulationSeed[] = [
  {
    code: "QCVN 06:2022/BXD",
    kind: "QCVN",
    title: "Quy chuẩn kỹ thuật quốc gia về an toàn cháy cho nhà và công trình",
    issuedBy: "Bộ Xây dựng",
    effectiveAt: "2023-01-16",
    tags: ["PCCC", "an toàn cháy"],
    rules: [
      {
        code: "QCVN-06-3.2.1",
        clauseRef: "§3.2.1",
        title: "Chiều rộng hành lang căn hộ",
        description: "Hành lang căn hộ chung cư phải có chiều rộng thông thuỷ ≥ 1.5 m.",
        severity: "BLOCKING",
        category: "PCCC",
        check: { dimension: "corridor_width_m", op: ">=", value: 1.5 },
      },
      {
        code: "QCVN-06-3.2.4",
        clauseRef: "§3.2.4",
        title: "Cầu thang thoát hiểm",
        description: "Cầu thang thoát hiểm: chiều rộng vế thang ≥ 1.2 m, độ dốc ≤ 1:1.5.",
        severity: "BLOCKING",
        category: "PCCC",
        check: { dimension: "exit_stair_width_m", op: ">=", value: 1.2 },
      },
      {
        code: "QCVN-06-3.4.1",
        clauseRef: "§3.4.1",
        title: "Bậc chịu lửa của bao che cầu thang",
        description: "Tường ngăn cầu thang thoát hiểm phải đạt giới hạn chịu lửa REI 120.",
        severity: "BLOCKING",
        category: "PCCC",
      },
    ],
  },
  {
    code: "QCVN 04:2021/BXD",
    kind: "QCVN",
    title: "Quy chuẩn kỹ thuật quốc gia về nhà chung cư",
    issuedBy: "Bộ Xây dựng",
    effectiveAt: "2021-12-30",
    tags: ["chung cư", "kiến trúc"],
    rules: [
      {
        code: "QCVN-04-2.3.1",
        clauseRef: "§2.3.1",
        title: "Diện tích căn hộ tối thiểu",
        description: "Diện tích sử dụng căn hộ chung cư thương mại ≥ 25 m².",
        severity: "BLOCKING",
        category: "kiến trúc",
        check: { dimension: "apartment_area_m2", op: ">=", value: 25 },
      },
    ],
  },
  {
    code: "QCVN 10:2014/BXD",
    kind: "QCVN",
    title: "Quy chuẩn kỹ thuật quốc gia về xây dựng công trình đảm bảo tiếp cận sử dụng",
    issuedBy: "Bộ Xây dựng",
    effectiveAt: "2014-12-26",
    tags: ["tiếp cận", "người khuyết tật"],
    rules: [
      {
        code: "QCVN-10-2.1.2",
        clauseRef: "§2.1.2",
        title: "Đường dốc tiếp cận",
        description: "Đường dốc tiếp cận có độ dốc ≤ 1:12 (8.33%), chiều rộng ≥ 1.2 m.",
        severity: "WARNING",
        category: "tiếp cận KT",
        check: { dimension: "ramp_slope", op: "<=", value: 0.0833 },
      },
    ],
  },
  {
    code: "TCVN 5574:2018",
    kind: "TCVN",
    title: "Thiết kế kết cấu bê tông và bê tông cốt thép",
    issuedBy: "Bộ Khoa học & Công nghệ",
    effectiveAt: "2018-12-26",
    tags: ["kết cấu", "bê tông"],
    rules: [
      {
        code: "TCVN-5574-10.3.1",
        clauseRef: "§10.3.1",
        title: "Lớp bê tông bảo vệ cốt thép cột",
        description: "Lớp bê tông bảo vệ cốt thép cột chính ≥ 25mm (môi trường thông thường).",
        severity: "WARNING",
        category: "kết cấu",
        check: { dimension: "rebar_cover_mm", op: ">=", value: 25 },
      },
    ],
  },
  {
    code: "TCVN 2737:2023",
    kind: "TCVN",
    title: "Tải trọng và tác động — Tiêu chuẩn thiết kế",
    issuedBy: "Bộ Khoa học & Công nghệ",
    effectiveAt: "2023-08-25",
    tags: ["kết cấu", "tải trọng"],
  },
  {
    code: "TCVN 7888:2014",
    kind: "TCVN",
    title: "Cốt thép cho bê tông — Thép thanh",
    issuedBy: "Bộ Khoa học & Công nghệ",
    tags: ["vật liệu", "thép"],
  },
  {
    code: "TCVN 9362:2012",
    kind: "TCVN",
    title: "Tiêu chuẩn thiết kế nền nhà và công trình",
    issuedBy: "Bộ Khoa học & Công nghệ",
    tags: ["nền móng"],
  },
  {
    code: "TCVN 4453:1995",
    kind: "TCVN",
    title: "Kết cấu bê tông và bê tông cốt thép toàn khối — Quy phạm thi công và nghiệm thu",
    issuedBy: "Bộ Xây dựng",
    tags: ["thi công", "nghiệm thu", "bê tông"],
  },
  {
    code: "NĐ 06/2021/NĐ-CP",
    kind: "NGHI_DINH",
    title: "Quy định chi tiết một số nội dung về quản lý chất lượng, thi công xây dựng và bảo trì công trình xây dựng",
    issuedBy: "Chính phủ",
    effectiveAt: "2021-01-26",
    tags: ["chất lượng", "nghiệm thu"],
  },
  {
    code: "NĐ 15/2021/NĐ-CP",
    kind: "NGHI_DINH",
    title: "Quy định chi tiết một số nội dung về quản lý dự án đầu tư xây dựng",
    issuedBy: "Chính phủ",
    effectiveAt: "2021-03-03",
    tags: ["quản lý dự án", "hồ sơ"],
  },
];

/**
 * Required quality-dossier items per NĐ 15/2021 Điều 26 + Phụ lục I.
 * Used to seed QualityDossierItem rows whenever a Project is created.
 */
export type DossierTemplateItem = {
  category: "KHAO_SAT" | "THIET_KE" | "THI_CONG" | "NGHIEM_THU" | "HOAN_CONG";
  itemCode: string;
  itemTitle: string;
  required: boolean;
};

export const DOSSIER_TEMPLATE: DossierTemplateItem[] = [
  // Khảo sát
  { category: "KHAO_SAT", itemCode: "I.A.1", itemTitle: "Báo cáo kết quả khảo sát địa chất công trình", required: true },
  { category: "KHAO_SAT", itemCode: "I.A.2", itemTitle: "Báo cáo kết quả khảo sát địa hình", required: true },
  { category: "KHAO_SAT", itemCode: "I.A.3", itemTitle: "Báo cáo khảo sát thuỷ văn (nếu có)", required: false },
  // Thiết kế
  { category: "THIET_KE", itemCode: "I.B.1", itemTitle: "Thuyết minh thiết kế cơ sở", required: true },
  { category: "THIET_KE", itemCode: "I.B.2", itemTitle: "Bản vẽ thiết kế kỹ thuật / bản vẽ thi công", required: true },
  { category: "THIET_KE", itemCode: "I.B.3", itemTitle: "Báo cáo thẩm tra thiết kế", required: true },
  { category: "THIET_KE", itemCode: "I.B.4", itemTitle: "Văn bản phê duyệt thiết kế", required: true },
  // Thi công
  { category: "THI_CONG", itemCode: "I.C.1", itemTitle: "Giấy phép xây dựng (hoặc văn bản miễn giấy phép)", required: true },
  { category: "THI_CONG", itemCode: "I.C.2", itemTitle: "Biện pháp tổ chức thi công đã phê duyệt", required: true },
  { category: "THI_CONG", itemCode: "I.C.3", itemTitle: "Nhật ký thi công xây dựng", required: true },
  { category: "THI_CONG", itemCode: "I.C.4", itemTitle: "Kết quả thí nghiệm vật liệu xây dựng", required: true },
  { category: "THI_CONG", itemCode: "I.C.5", itemTitle: "Hợp đồng và phụ lục hợp đồng thi công", required: true },
  // Nghiệm thu
  { category: "NGHIEM_THU", itemCode: "I.D.1", itemTitle: "Biên bản nghiệm thu công việc (Điều 21)", required: true },
  { category: "NGHIEM_THU", itemCode: "I.D.2", itemTitle: "Biên bản nghiệm thu giai đoạn / bộ phận (Điều 22)", required: true },
  { category: "NGHIEM_THU", itemCode: "I.D.3", itemTitle: "Biên bản nghiệm thu hoàn thành công trình (Điều 23)", required: true },
  { category: "NGHIEM_THU", itemCode: "I.D.4", itemTitle: "Văn bản chấp thuận PCCC", required: true },
  // Hoàn công
  { category: "HOAN_CONG", itemCode: "I.E.1", itemTitle: "Bản vẽ hoàn công", required: true },
  { category: "HOAN_CONG", itemCode: "I.E.2", itemTitle: "Báo cáo về chất lượng công trình", required: true },
  { category: "HOAN_CONG", itemCode: "I.E.3", itemTitle: "Hồ sơ bảo hành công trình", required: true },
];
