// Điều hướng theo Webim Web_Workflow.drawio: một TRANG CHỦ, tám nhánh.
//
// Trước đây là một thanh 12 tab phẳng — mọi thứ ngang hàng, nên không có chỗ
// nào nói cho người mới biết nên bắt đầu từ đâu. Sơ đồ workflow đặt ra thứ
// bậc: chọn việc định làm ở trang chủ, rồi mới tới các bước của việc đó.
//
// Bốn module không có trong sơ đồ được xếp vào nhánh sẵn có thay vì đẻ ra
// nhánh thứ chín: Dashboard là phần tổng quan của chính TRANG CHỦ, IFC Data
// đọc file đã link nên thuộc BIM, còn PCCC và Climate đều là mô phỏng — thoát
// nạn và vi khí hậu — nên nằm cùng 4D.

export type PaneId =
  | "HOME"
  | "PDF"
  | "STANDARDS"
  | "CDE"
  | "PLAN"
  | "NAMING"
  | "MEMBERS"
  | "ATLASPROCESS"
  | "ATLASPEOPLE"
  | "ATLASSITE"
  | "ATLAS"
  | "PLANVIEW"
  | "MASSING"
  | "IFCIMPORT"
  | "VIEWER"
  | "IFCDATA"
  | "CLASHMATRIX"
  | "CLASHREPORT"
  | "QTOTABLE"
  | "PRICING"
  | "RENDER"
  | "FOURD"
  | "PCCC"
  | "CLIMATE";

export type SectionId =
  | "HOME"
  | "PDF"
  | "STANDARDS"
  | "PROJECT"
  | "BIM"
  | "CLASH"
  | "QTO"
  | "RENDER"
  | "SIM";

export interface Pane {
  id: PaneId;
  label: string;
}

/**
 * Tầng sản phẩm — trang chủ nhóm thẻ theo tầng, đúng chiến lược:
 *   FREE: công cụ miễn phí kéo người dùng (PDF, tiêu chuẩn).
 *   CORE: cốt lõi giai đoạn 1, xoay quanh dự án (CDE, va chạm, view IFC).
 *   PLUS: giá trị gia tăng trên dự án (quản lý dự án, khối lượng, render, mô phỏng).
 *   BIM:  dựng hình — khó nhất, làm sau cùng, không phải cửa vào.
 */
export type SectionTier = "FREE" | "CORE" | "PLUS" | "BIM";

export interface Section {
  id: SectionId;
  /** Nhãn ở trang chủ và trên thanh nhánh — chữ của sơ đồ, không dịch lại. */
  label: string;
  /** Một câu nói nhánh này làm gì, hiện trên thẻ ở trang chủ. */
  blurb: string;
  tier: SectionTier;
  panes: Pane[];
}

export const SECTIONS: Section[] = [
  {
    id: "PDF",
    tier: "FREE",
    label: "Đọc & chỉnh sửa PDF",
    blurb: "Mở bản vẽ PDF từ CDE, ghi chú và đánh dấu ngay trên trang.",
    panes: [{ id: "PDF", label: "Bản vẽ" }],
  },
  {
    id: "STANDARDS",
    tier: "FREE",
    label: "Tra cứu tiêu chuẩn",
    blurb: "QCVN / TCVN, tình trạng hiệu lực, chuỗi thay thế và xung đột.",
    panes: [{ id: "STANDARDS", label: "QCVN / TCVN" }],
  },
  {
    id: "PROJECT",
    tier: "PLUS",
    label: "Quản lý dự án",
    blurb:
      "Hồ sơ CDE, tiến độ hạng mục, quy trình ISO của công ty, đánh giá nhân sự và hồ sơ công trường.",
    // Quy hoạch theo bảng nhu cầu (nhóm A — CDE quản lý quy trình làm việc):
    // trước đây ba pane xếp theo *ứng dụng nào cài nó* (CDE · Tiến độ ·
    // Atlas), nên toàn bộ nhóm A — sổ ISO, quy trình phối hợp, tiêu chí
    // chuyển giai đoạn, đánh giá nhân sự — bị giấu sau một ô "Atlas" nguyên
    // khối, và người cần duyệt một quy trình phải biết trước rằng nó nằm
    // trong đó. Giờ mỗi cụm việc là một pane, nhúng thẳng đúng trang.
    panes: [
      { id: "CDE", label: "CDE" },
      { id: "MEMBERS", label: "Thành viên" },
      { id: "NAMING", label: "Đặt tên ISO" },
      { id: "PLAN", label: "Tiến độ" },
      { id: "ATLASPROCESS", label: "Quy trình & ISO" },
      { id: "ATLASPEOPLE", label: "Nhân sự" },
      { id: "ATLASSITE", label: "Công trường" },
      { id: "ATLAS", label: "Atlas" },
    ],
  },
  {
    id: "BIM",
    tier: "BIM",
    label: "BIM",
    blurb: "Dựng mặt bằng và cấu kiện 3D, dựng box khối, import IFC, xem 3D.",
    panes: [
      { id: "PLANVIEW", label: "Mặt bằng & cấu kiện" },
      { id: "MASSING", label: "Box khối" },
      { id: "IFCIMPORT", label: "Import IFC" },
      { id: "VIEWER", label: "View 3D" },
      { id: "IFCDATA", label: "Dữ liệu IFC" },
    ],
  },
  {
    id: "CLASH",
    tier: "CORE",
    label: "Check va chạm",
    blurb: "Ma trận hệ × hệ với dung sai riêng, rồi báo cáo va chạm.",
    panes: [
      { id: "CLASHMATRIX", label: "Ma trận" },
      { id: "CLASHREPORT", label: "Báo cáo" },
    ],
  },
  {
    id: "QTO",
    tier: "PLUS",
    label: "Kiểm tra khối lượng",
    blurb: "Bảng thống kê khối lượng từ hình học, rồi áp đơn giá.",
    panes: [
      { id: "QTOTABLE", label: "Bảng thống kê" },
      { id: "PRICING", label: "Áp đơn giá" },
    ],
  },
  {
    id: "RENDER",
    tier: "PLUS",
    label: "Render AI",
    blurb: "Dựng ảnh concept từ khối hiện có, bằng model tự host.",
    panes: [{ id: "RENDER", label: "Render concept" }],
  },
  {
    id: "SIM",
    tier: "PLUS",
    label: "Mô phỏng",
    blurb: "Tiến độ 4D, thoát nạn theo QCVN 06, vi khí hậu theo hướng.",
    panes: [
      { id: "FOURD", label: "Tiến độ 4D" },
      { id: "PCCC", label: "Thoát nạn" },
      { id: "CLIMATE", label: "Vi khí hậu" },
    ],
  },
];

export const HOME: Section = {
  id: "HOME",
  label: "Trang chủ",
  blurb: "",
  tier: "FREE",
  panes: [{ id: "HOME", label: "Trang chủ" }],
};

export function sectionById(id: SectionId): Section {
  return id === "HOME" ? HOME : SECTIONS.find((section) => section.id === id) ?? HOME;
}

/** Which section owns a pane — used to keep the branch bar honest on deep links. */
export function sectionOfPane(pane: PaneId): SectionId {
  if (pane === "HOME") return "HOME";
  const owner = SECTIONS.find((section) => section.panes.some((p) => p.id === pane));
  return owner?.id ?? "HOME";
}
