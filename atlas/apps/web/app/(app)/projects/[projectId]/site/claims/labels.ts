// Nhãn tiếng Việt dùng chung cho module Claims (list + detail + forms).

export const CLAIM_TYPE_LABEL: Record<string, string> = {
  EOT: "Gia hạn tiến độ (EOT)",
  COST: "Chi phí phát sinh",
  PRICE_ESCALATION: "Điều chỉnh giá",
  PAYMENT_DELAY: "Chậm thanh toán",
  DEFECT: "Chất lượng / lỗi thi công",
  OTHER: "Khác",
};

export const CLAIM_STATE_LABEL: Record<string, string> = {
  DRAFT: "Lập hồ sơ",
  EVIDENCE: "Thu thập chứng cứ",
  SUBMITTED: "Đã gửi văn bản",
  UNDER_REVIEW: "Đang xem xét",
  NEGOTIATION: "Thương lượng",
  RESOLVED: "Đã giải quyết",
  REJECTED: "Bị bác",
  ESCALATED: "Trọng tài / Tòa án",
  WITHDRAWN: "Đã rút",
};

export const CLAIM_DIRECTION_LABEL: Record<string, string> = {
  CONTRACTOR_TO_OWNER: "Nhà thầu → CĐT",
  OWNER_TO_CONTRACTOR: "CĐT → Nhà thầu",
  TO_CONSULTANT: "→ Tư vấn",
};

export const EVENT_KIND_LABEL: Record<string, string> = {
  DELAY_START: "Bắt đầu chậm trễ",
  DELAY_END: "Kết thúc chậm trễ",
  INSTRUCTION: "Chỉ đạo",
  NOTICE: "Thông báo gửi đi",
  RESPONSE: "Phản hồi nhận được",
  SITE_CONDITION: "Điều kiện công trường",
  PAYMENT: "Thanh toán",
  MEETING: "Cuộc họp",
  OTHER: "Khác",
};

export const EVIDENCE_KIND_LABEL: Record<string, string> = {
  DAILY_LOG: "Nhật ký thi công",
  RFI: "RFI",
  CHANGE_ORDER: "Lệnh thay đổi",
  SUPERVISE_ENTRY: "Sổ TVGS",
  ACCEPTANCE: "Biên bản nghiệm thu",
  WEATHER: "Dữ liệu thời tiết",
  CORRESPONDENCE: "Công văn / email",
  PHOTO: "Hình ảnh",
  CONTRACT: "Hợp đồng / phụ lục",
  INVOICE: "Hóa đơn / chứng từ",
  OTHER: "Khác",
};

// Bước chuyển hợp lệ — phải khớp TRANSITIONS phía API.
export const NEXT_STATES: Record<string, string[]> = {
  DRAFT: ["EVIDENCE", "SUBMITTED", "WITHDRAWN"],
  EVIDENCE: ["DRAFT", "SUBMITTED", "WITHDRAWN"],
  SUBMITTED: ["UNDER_REVIEW", "WITHDRAWN"],
  UNDER_REVIEW: ["NEGOTIATION", "RESOLVED", "REJECTED"],
  NEGOTIATION: ["RESOLVED", "REJECTED", "ESCALATED"],
  REJECTED: ["NEGOTIATION", "ESCALATED", "WITHDRAWN"],
  ESCALATED: ["RESOLVED"],
  RESOLVED: [],
  WITHDRAWN: [],
};
