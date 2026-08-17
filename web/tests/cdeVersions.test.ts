// File theo hạng mục + khôi phục phiên bản trong CDE.
//
// Bất biến: khôi phục KHÔNG viết lại lịch sử — nó thêm một revision mới trỏ
// lại file cũ; và liên kết tài liệu ↔ hạng mục phải trúng hạng mục có thật.

import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";

function projectWithTask() {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  const task = project.addTask("Móng", "Kết cấu", "an", "2026-01-01", "2026-02-01");
  const document = project.addDocument("WBM-XX-00-ZZ-DR-S-001", "MB móng");
  return { project, task, document };
}

describe("tài liệu gắn hạng mục", () => {
  it("gắn, gỡ, và round-trip qua JSON", () => {
    const { project, task, document } = projectWithTask();
    project.updateDocument(document.id, { taskId: task.id });
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(reloaded.documents[0].taskId).toBe(task.id);

    reloaded.updateDocument(document.id, { taskId: null });
    const again = NativeBimProject.fromJson(JSON.stringify(reloaded.toDict()));
    expect(again.documents[0].taskId).toBeUndefined();
  });

  it("taskId mồ côi bị từ chối ngay lúc gắn", () => {
    const { project, document } = projectWithTask();
    expect(() => project.updateDocument(document.id, { taskId: "khong-co" })).toThrow(
      /Unknown TaskDatum/,
    );
  });
});

describe("khôi phục phiên bản", () => {
  it("khôi phục thêm revision mới trỏ lại file cũ, lịch sử giữ nguyên", () => {
    const { project, document } = projectWithTask();
    project.addDocumentRevision(document.id, "bản đầu", "p/doc/v1.pdf", "v1.pdf", "2026-01-01");
    project.addDocumentRevision(document.id, "bản lỗi", "p/doc/v2.pdf", "v2.pdf", "2026-01-02");

    const restored = project.restoreDocumentRevision(
      document.id,
      document.revisions[0].id,
      "2026-01-03",
    );
    expect(document.revisions).toHaveLength(3);
    expect(restored.rev).toBe("P03");
    expect(restored.fileKey).toBe("p/doc/v1.pdf");
    expect(restored.note).toContain("Khôi phục từ P01");
    // hai bản cũ còn nguyên
    expect(document.revisions[0].fileKey).toBe("p/doc/v1.pdf");
    expect(document.revisions[1].fileKey).toBe("p/doc/v2.pdf");
  });

  it("không khôi phục được bản hiện hành hay bản metadata-only", () => {
    const { project, document } = projectWithTask();
    project.addDocumentRevision(document.id, "chỉ metadata", null, null, "2026-01-01");
    project.addDocumentRevision(document.id, "có file", "p/doc/v2.pdf", "v2.pdf", "2026-01-02");

    expect(() =>
      project.restoreDocumentRevision(document.id, document.revisions[0].id, "2026-01-03"),
    ).toThrow(/không có file/);
    expect(() =>
      project.restoreDocumentRevision(document.id, document.revisions[1].id, "2026-01-03"),
    ).toThrow(/hiện hành/);
  });
});

describe("markup toạ độ phải hữu hạn", () => {
  it("addMarkup từ chối Infinity/NaN ngay tại biên domain", () => {
    const { project, document } = (() => {
      const p = NativeBimProject.create("P", "S", "B", "L1");
      return { project: p, document: p.addDocument("X-001", "MB") };
    })();
    expect(() =>
      project.addMarkup(
        document.id,
        { kind: "RECT", page: 0, from: [Infinity, 0], to: [1, 1], text: "", color: "#fff", author: "a" },
        "2026-01-01",
      ),
    ).toThrow(/không hợp lệ/);
  });

  it("fromJson bỏ markup rác (null từ bug Infinity cũ), giữ markup lành", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const document = project.addDocument("X-001", "MB");
    project.addMarkup(
      document.id,
      { kind: "RECT", page: 0, from: [0.1, 0.1], to: [0.5, 0.4], text: "", color: "#fff", author: "a" },
      "2026-01-01",
    );
    const dict = project.toDict() as Record<string, unknown>;
    const docDict = (dict.documents as { markups: unknown[] }[])[0];
    docDict.markups.push({ id: "bad", kind: "RECT", page: 0, from: [null, null], to: [null, null] });
    const reloaded = NativeBimProject.fromJson(JSON.stringify(dict));
    expect(reloaded.documents[0].markups).toHaveLength(1);
    expect(reloaded.documents[0].markups?.[0].to[0]).toBe(0.5);
  });
});

describe("approval PUBLISHED + checksum (ISO 19650)", () => {
  it("approvedBy/checksum round-trip qua JSON", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const document = project.addDocument("X-001", "MB");
    project.addDocumentRevision(
      document.id, "nộp", "p/d/v1.pdf", "v1.pdf", "2026-01-01", "abc123def456",
    );
    project.updateDocument(document.id, {
      status: "PUBLISHED",
      approvedBy: "sophie",
      approvedAt: "2026-01-02T08:00:00Z",
    });
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(reloaded.documents[0].approvedBy).toBe("sophie");
    expect(reloaded.documents[0].revisions[0].checksum).toBe("abc123def456");
  });
});
