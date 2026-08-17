// Luồng xương sống của một dự án: Dự án → CDE → View → Plan → Đối chiếu.
//
// Các pane đã tồn tại từ lâu; cái còn thiếu là CÂU TRẢ LỜI cho người vừa mở
// app: "tôi đang đứng ở đâu trong luồng, và việc tiếp theo là gì?" Mỗi bước
// ở đây tự đánh giá từ dữ liệu thật của dự án — không phải checklist tĩnh
// tick tay, mà là tấm gương: thêm tài liệu thì bước CDE tự đổi màu.
//
// Hàm thuần trên các con số đã đếm sẵn — store đếm, flow kết luận, UI vẽ.

import type { PaneId } from "../ui/navigation";

export type FlowState = "OK" | "ATTENTION" | "EMPTY";

export interface FlowStep {
  id: "PROJECT" | "CDE" | "VIEW" | "PLAN" | "CHECK";
  label: string;
  state: FlowState;
  /** Đang có gì — một câu. */
  summary: string;
  /** Việc tiếp theo — một câu, chỉ hiện khi chưa OK. */
  nextAction: string | null;
  /** Bấm vào bước là tới thẳng chỗ làm việc đó. */
  pane: PaneId;
}

export interface FlowInput {
  /** Kết nối máy chủ nền tảng (snapshot dự án tự đẩy/kéo). */
  serverSynced: boolean;
  /** Đã đăng ký riêng tư (true), chế độ mở (false), chưa biết (null). */
  registered: boolean | null;
  memberCount: number | null;

  documentCount: number;
  documentsWithoutFile: number;
  documentsWithoutTask: number;

  elementCount: number;
  linkedModelCount: number;

  taskCount: number;
  averageProgress: number;
  doneTasksMissingPublished: number;

  /** Số phát hiện PCCC mức serious; null = chưa chạy được (thiếu phòng…). */
  pcccSeriousCount: number | null;
  markupCount: number;
}

export function assessFlow(input: FlowInput): FlowStep[] {
  const steps: FlowStep[] = [];

  // 1. DỰ ÁN — nền: có trên máy chủ chưa, ai được chạm.
  if (!input.serverSynced) {
    steps.push({
      id: "PROJECT",
      label: "Dự án",
      state: "ATTENTION",
      summary: "Chưa nối máy chủ — dự án chỉ nằm trong trình duyệt này.",
      nextAction: "Đăng nhập để dự án tự lưu lên máy chủ và mở được từ máy khác.",
      pane: "MEMBERS",
    });
  } else if (input.registered === false) {
    steps.push({
      id: "PROJECT",
      label: "Dự án",
      state: "ATTENTION",
      summary: "Đã lưu trên máy chủ · chế độ mở (ai đăng nhập cũng sửa được).",
      nextAction: "Đăng ký riêng tư để chỉ thành viên được mời mới chạm vào dự án.",
      pane: "MEMBERS",
    });
  } else {
    steps.push({
      id: "PROJECT",
      label: "Dự án",
      state: "OK",
      summary:
        input.registered === true
          ? `Riêng tư · ${input.memberCount ?? 1} thành viên · tự lưu máy chủ.`
          : "Đã lưu trên máy chủ.",
      nextAction: null,
      pane: "MEMBERS",
    });
  }

  // 2. CDE — hồ sơ là sản phẩm, mã ISO là tên sản phẩm.
  if (input.documentCount === 0) {
    steps.push({
      id: "CDE",
      label: "CDE",
      state: "EMPTY",
      summary: "Chưa có tài liệu nào.",
      nextAction: "Tạo tài liệu đầu tiên theo mã ISO 19650 và nộp file.",
      pane: "CDE",
    });
  } else {
    const issues: string[] = [];
    if (input.documentsWithoutFile > 0) {
      issues.push(`${input.documentsWithoutFile} chưa có file`);
    }
    if (input.documentsWithoutTask > 0) {
      issues.push(`${input.documentsWithoutTask} chưa gắn hạng mục`);
    }
    steps.push({
      id: "CDE",
      label: "CDE",
      state: issues.length > 0 ? "ATTENTION" : "OK",
      summary: `${input.documentCount} tài liệu${issues.length ? ` · ${issues.join(" · ")}` : ""}.`,
      nextAction:
        issues.length > 0 ? "Nộp file và gắn hạng mục cho các tài liệu còn thiếu." : null,
      pane: "CDE",
    });
  }

  // 3. VIEW — không có hình thì các bước sau không có gì để soi.
  if (input.elementCount === 0 && input.linkedModelCount === 0) {
    steps.push({
      id: "VIEW",
      label: "Mô hình",
      state: "EMPTY",
      summary: "Mô hình trống.",
      nextAction: "Vẽ trong nhánh BIM hoặc link file IFC từ CDE.",
      pane: "VIEWER",
    });
  } else {
    steps.push({
      id: "VIEW",
      label: "Mô hình",
      state: "OK",
      summary:
        `${input.elementCount} phần tử native` +
        (input.linkedModelCount > 0 ? ` · ${input.linkedModelCount} model IFC link` : "") +
        ".",
      nextAction: null,
      pane: "VIEWER",
    });
  }

  // 4. PLAN — tiến độ và lỗ hổng bàn giao.
  if (input.taskCount === 0) {
    steps.push({
      id: "PLAN",
      label: "Tiến độ",
      state: "EMPTY",
      summary: "Chưa có hạng mục nào.",
      nextAction: "Lập danh sách hạng mục với ngày bắt đầu / kết thúc.",
      pane: "PLAN",
    });
  } else {
    const gap = input.doneTasksMissingPublished;
    steps.push({
      id: "PLAN",
      label: "Tiến độ",
      state: gap > 0 ? "ATTENTION" : "OK",
      summary:
        `${input.taskCount} hạng mục · ${input.averageProgress}%` +
        (gap > 0 ? ` · ${gap} đã xong nhưng thiếu file PUBLISHED` : "") +
        ".",
      nextAction:
        gap > 0 ? "Nộp và PUBLISH hồ sơ cho các hạng mục đã xong — lỗ hổng bàn giao." : null,
      pane: "PLAN",
    });
  }

  // 5. ĐỐI CHIẾU — QCVN (thoát nạn) + đánh dấu PDF.
  if (input.pcccSeriousCount === null) {
    steps.push({
      id: "CHECK",
      label: "Đối chiếu",
      state: "EMPTY",
      summary: "Chưa chạy được kiểm thoát nạn (mô hình chưa có phòng).",
      nextAction: "Khoanh phòng trong BIM rồi mở tab Thoát nạn.",
      pane: "PCCC",
    });
  } else if (input.pcccSeriousCount > 0) {
    steps.push({
      id: "CHECK",
      label: "Đối chiếu",
      state: "ATTENTION",
      summary: `${input.pcccSeriousCount} phát hiện NGHIÊM TRỌNG theo QCVN 06.`,
      nextAction: "Mở tab Thoát nạn, xử lý từng phát hiện kèm điều/bảng đã dẫn.",
      pane: "PCCC",
    });
  } else {
    steps.push({
      id: "CHECK",
      label: "Đối chiếu",
      state: "OK",
      summary:
        "Thoát nạn không còn phát hiện nghiêm trọng" +
        (input.markupCount > 0 ? ` · ${input.markupCount} đánh dấu PDF` : "") +
        ".",
      nextAction: null,
      pane: "PCCC",
    });
  }

  return steps;
}
