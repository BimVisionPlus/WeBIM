// Luồng xương sống — mỗi bước phải phản chiếu đúng dữ liệu và chỉ đúng việc.

import { describe, expect, it } from "vitest";
import { assessFlow, type FlowInput } from "../src/application/flow";

const BASE: FlowInput = {
  serverSynced: true,
  registered: true,
  memberCount: 3,
  documentCount: 4,
  documentsWithoutFile: 0,
  documentsWithoutTask: 0,
  elementCount: 20,
  linkedModelCount: 1,
  taskCount: 5,
  averageProgress: 60,
  doneTasksMissingPublished: 0,
  pcccSeriousCount: 0,
  markupCount: 2,
};

describe("assessFlow", () => {
  it("dự án đầy đủ: 5 bước đều OK, không còn việc phải chỉ", () => {
    const steps = assessFlow(BASE);
    expect(steps).toHaveLength(5);
    expect(steps.every((step) => step.state === "OK")).toBe(true);
    expect(steps.every((step) => step.nextAction === null)).toBe(true);
  });

  it("chưa nối máy chủ → bước Dự án cảnh báo và trỏ về đăng nhập", () => {
    const steps = assessFlow({ ...BASE, serverSynced: false, registered: null });
    expect(steps[0].state).toBe("ATTENTION");
    expect(steps[0].nextAction).toContain("Đăng nhập");
  });

  it("chế độ mở → gợi ý đăng ký riêng tư", () => {
    const steps = assessFlow({ ...BASE, registered: false });
    expect(steps[0].state).toBe("ATTENTION");
    expect(steps[0].nextAction).toContain("riêng tư");
  });

  it("CDE trống là EMPTY; thiếu file/hạng mục là ATTENTION với số đếm", () => {
    expect(assessFlow({ ...BASE, documentCount: 0 })[1].state).toBe("EMPTY");
    const attention = assessFlow({
      ...BASE,
      documentsWithoutFile: 2,
      documentsWithoutTask: 1,
    })[1];
    expect(attention.state).toBe("ATTENTION");
    expect(attention.summary).toContain("2 chưa có file");
    expect(attention.summary).toContain("1 chưa gắn hạng mục");
  });

  it("mô hình trống chỉ đường sang BIM hoặc link IFC", () => {
    const step = assessFlow({ ...BASE, elementCount: 0, linkedModelCount: 0 })[2];
    expect(step.state).toBe("EMPTY");
    expect(step.nextAction).toContain("IFC");
  });

  it("hạng mục xong thiếu PUBLISHED là lỗ hổng bàn giao — phải gọi tên", () => {
    const step = assessFlow({ ...BASE, doneTasksMissingPublished: 2 })[3];
    expect(step.state).toBe("ATTENTION");
    expect(step.summary).toContain("2 đã xong nhưng thiếu file PUBLISHED");
  });

  it("PCCC: null = chưa chạy được (EMPTY), >0 = nghiêm trọng (ATTENTION)", () => {
    expect(assessFlow({ ...BASE, pcccSeriousCount: null })[4].state).toBe("EMPTY");
    const serious = assessFlow({ ...BASE, pcccSeriousCount: 3 })[4];
    expect(serious.state).toBe("ATTENTION");
    expect(serious.summary).toContain("3 phát hiện NGHIÊM TRỌNG");
  });
});
