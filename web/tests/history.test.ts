// Undo/redo an toàn trong cộng tác — kiểm hàm thuần (history.ts) và tích hợp
// qua store. Bất biến quan trọng nhất: undo KHÔNG được đè lên phần tử mà
// người khác đã sửa tiếp sau bước đó — phần tử ấy phải bị bỏ qua và đếm ra.

import { beforeEach, describe, expect, it } from "vitest";
import { applyUndo, diffElements, invert, type UndoEntry } from "../src/sync/history";
import { collectElements } from "../src/sync/syncEngine";
import { NativeBimProject } from "../src/domain/project";
import { AppStore } from "../src/state/store";

function freshProject() {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  project.addLevel("Level 1", 0);
  return project;
}

function entryFrom(before: NativeBimProject, after: NativeBimProject, label = "bước"): UndoEntry {
  return {
    label,
    at: "2026-08-14T00:00:00Z",
    patches: diffElements(
      collectElements(before.toDict()),
      collectElements(after.toDict()),
    ),
  };
}

describe("diffElements", () => {
  it("bắt được thêm, sửa và xoá", () => {
    const project = freshProject();
    const beforeSnap = collectElements(project.toDict());
    const wall = project.addWall([0, 0, 0], [4, 0, 0]);
    const patches = diffElements(beforeSnap, collectElements(project.toDict()));
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({ id: wall.id, collection: "walls", before: null });

    const midSnap = collectElements(project.toDict());
    project.removeWall(wall.id);
    const removal = diffElements(midSnap, collectElements(project.toDict()));
    expect(removal).toHaveLength(1);
    expect(removal[0].after).toBeNull();
    expect(removal[0].before).not.toBeNull();
  });

  it("đổi meta (tên dự án) ra một patch __meta__", () => {
    const project = freshProject();
    const beforeSnap = collectElements(project.toDict());
    const dict = project.toDict();
    dict.name = "Tên mới";
    const patches = diffElements(beforeSnap, collectElements(dict));
    expect(patches.map((patch) => patch.id)).toEqual(["__meta__"]);
  });
});

describe("applyUndo", () => {
  it("hoàn tác một bức tường vừa thêm", () => {
    const before = freshProject();
    const after = NativeBimProject.fromJson(JSON.stringify(before.toDict()));
    after.addWall([0, 0, 0], [4, 0, 0]);
    const entry = entryFrom(before, after);

    const result = applyUndo(after.toDict(), entry);
    expect(result.skipped).toHaveLength(0);
    expect(result.applied).toHaveLength(1);
    expect((result.project.walls as unknown[]).length).toBe(
      (before.toDict().walls as unknown[]).length,
    );
  });

  it("BỎ QUA phần tử đã bị người khác sửa tiếp, giữ nguyên bản mới hơn", () => {
    const before = freshProject();
    const after = NativeBimProject.fromJson(JSON.stringify(before.toDict()));
    const wall = after.addWall([0, 0, 0], [4, 0, 0]);
    const entry = entryFrom(before, after);

    // Người khác sửa tiếp đúng bức tường đó (dời điểm cuối).
    const remote = NativeBimProject.fromJson(JSON.stringify(after.toDict()));
    remote.updateWall(wall.id, { end: [6, 0, 0] });

    const result = applyUndo(remote.toDict(), entry);
    expect(result.applied).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    const kept = (result.project.walls as { id: string; end: number[] }[]).find(
      (row) => row.id === wall.id,
    );
    expect(kept?.end?.[0]).toBe(6);
  });

  it("bước nhiều phần tử áp được một phần: cái sạch hoàn tác, cái đã sửa giữ", () => {
    const before = freshProject();
    const after = NativeBimProject.fromJson(JSON.stringify(before.toDict()));
    const wallA = after.addWall([0, 0, 0], [4, 0, 0]);
    const wallB = after.addWall([0, 5, 0], [4, 5, 0]);
    const entry = entryFrom(before, after);

    const remote = NativeBimProject.fromJson(JSON.stringify(after.toDict()));
    remote.updateWall(wallB.id, { end: [9, 5, 0] });

    const result = applyUndo(remote.toDict(), entry);
    expect(result.applied.map((patch) => patch.id)).toEqual([wallA.id]);
    expect(result.skipped.map((patch) => patch.id)).toEqual([wallB.id]);
    const walls = result.project.walls as { id: string }[];
    expect(walls.some((row) => row.id === wallA.id)).toBe(false);
    expect(walls.some((row) => row.id === wallB.id)).toBe(true);
  });

  it("hoàn tác một lệnh xoá thì phần tử quay lại", () => {
    const before = freshProject();
    const wall = before.addWall([0, 0, 0], [4, 0, 0]);
    const after = NativeBimProject.fromJson(JSON.stringify(before.toDict()));
    after.removeWall(wall.id);
    const entry = entryFrom(before, after);

    const result = applyUndo(after.toDict(), entry);
    expect(result.applied).toHaveLength(1);
    expect(
      (result.project.walls as { id: string }[]).some((row) => row.id === wall.id),
    ).toBe(true);
  });

  it("invert của bước đã áp làm redo tròn vòng", () => {
    const before = freshProject();
    const after = NativeBimProject.fromJson(JSON.stringify(before.toDict()));
    after.addWall([0, 0, 0], [4, 0, 0]);
    const entry = entryFrom(before, after);

    const undone = applyUndo(after.toDict(), entry);
    const redoEntry = invert(entry, undone.applied);
    const redone = applyUndo(undone.project, redoEntry);
    expect(redone.skipped).toHaveLength(0);
    expect(collectElements(redone.project)).toEqual(collectElements(after.toDict()));
  });
});

describe("store integration", () => {
  let store: AppStore;

  beforeEach(() => {
    store = new AppStore();
  });

  it("undo/redo một thao tác thật của store", () => {
    const wallsBefore = store.project.walls.length;
    store.addWall([0, 0, 0], [4, 0, 0]);
    expect(store.project.walls.length).toBe(wallsBefore + 1);
    expect(store.canUndo).toBe(true);

    store.undo();
    expect(store.project.walls.length).toBe(wallsBefore);
    expect(store.canRedo).toBe(true);

    store.redo();
    expect(store.project.walls.length).toBe(wallsBefore + 1);
  });

  it("merge từ xa vào lịch sử (kind remote) nhưng KHÔNG vào undo stack", () => {
    const undoDepth = store.history.filter((item) => item.kind === "local").length;
    const remote = NativeBimProject.fromJson(JSON.stringify(store.project.toDict()));
    remote.addWall([0, 9, 0], [4, 9, 0]);
    const canUndoBefore = store.canUndo;

    store.applyRemoteProject(remote.toDict());
    expect(store.history.at(-1)?.kind).toBe("remote");
    expect(store.history.filter((item) => item.kind === "local").length).toBe(undoDepth);
    expect(store.canUndo).toBe(canUndoBefore);
  });

  it("undo bỏ qua phần tử đã nhận sửa từ xa sau đó và nói ra điều ấy", () => {
    store.addWall([0, 0, 0], [4, 0, 0]);
    const wall = store.project.walls.at(-1)!;

    const remote = NativeBimProject.fromJson(JSON.stringify(store.project.toDict()));
    remote.updateWall(wall.id, { end: [7, 0, 0] });
    store.applyRemoteProject(remote.toDict());

    store.undo();
    const kept = store.project.walls.find((row) => row.id === wall.id);
    expect(kept).toBeDefined();
    expect(kept?.end[0]).toBe(7);
    expect(store.statusMessage).toContain("đã bị sửa tiếp");
  });

  it("chỉnh sửa mới xoá redo stack", () => {
    store.addWall([0, 0, 0], [4, 0, 0]);
    store.undo();
    expect(store.canRedo).toBe(true);
    store.addWall([0, 3, 0], [4, 3, 0]);
    expect(store.canRedo).toBe(false);
  });
});
