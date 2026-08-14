// Đường thoát nạn thật. Mỗi ca ở đây là một mặt bằng biết trước đáp án —
// pathfinding sai thì sai ở đây trước khi sai trong một hồ sơ PCCC thật.
import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { buildDemoProject } from "../src/demo/seedProject";
import {
  buildEscapeGrid,
  corridorLegs,
  distanceField,
  routedWorstDistance,
} from "../src/application/escapeRoute";
import { analyseProject, analyseRoom, exitsForRoom, exitsOnLevel } from "../src/application/pccc";

/**
 * Phòng 10×10, tường bao quanh, một cửa. Tuỳ ca mà thêm vách ngăn bên trong.
 * Toạ độ phòng hơi thụt vào để tâm ô không dính dải tường bao.
 */
function boxRoom() {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  const level = project.addLevel("Tầng 1", 0);
  const w = (a: [number, number], b: [number, number]) =>
    project.addWall([a[0], a[1], 0], [b[0], b[1], 0], { levelId: level.id, thickness: 0.2 });
  const south = w([0, 0], [10, 0]);
  w([10, 0], [10, 10]);
  w([10, 10], [0, 10]);
  w([0, 10], [0, 0]);
  const room = project.addRoom(
    "P.1",
    [
      [0.3, 0.3],
      [9.7, 0.3],
      [9.7, 9.7],
      [0.3, 9.7],
    ],
    { usage: "VAN_PHONG", levelId: level.id },
  );
  return { project, level, room, south };
}

describe("lưới vật cản", () => {
  it("tường chặn, cửa đi khoét hở, cửa sổ thì không", () => {
    const { project, level, south } = boxRoom();
    project.addOpening(south.id, "DOOR", 5, { width: 1.0 });
    project.addOpening(south.id, "WINDOW", 8, { width: 1.5 });
    const grid = buildEscapeGrid(project, level.id)!;

    const cellAt = (x: number, y: number) => {
      const c = Math.floor((x - grid.minX) / grid.cell);
      const r = Math.floor((y - grid.minY) / grid.cell);
      return grid.blocked[r * grid.cols + c];
    };
    expect(cellAt(2, 0)).toBe(1); // thân tường nam
    expect(cellAt(5, 0)).toBe(0); // giữa cửa đi
    expect(cellAt(8, 0)).toBe(1); // cửa sổ vẫn chặn — không phải lối thoát nạn
    expect(cellAt(5, 5)).toBe(0); // lòng phòng thoáng
  });

  it("cao độ trống trả null thay vì một lưới bịa", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const level = project.addLevel("Tầng 1", 0);
    expect(buildEscapeGrid(project, level.id)).toBeNull();
  });
});

describe("cự ly theo đường đi", () => {
  it("phòng trống: đường đi xấp xỉ đường thẳng (sai số lưới ≤ ~9%)", () => {
    const { project, level, room, south } = boxRoom();
    project.addOpening(south.id, "DOOR", 5, { width: 1.0 });
    const grid = buildEscapeGrid(project, level.id)!;
    const exits = exitsForRoom(room, exitsOnLevel(project, level.id));
    const field = distanceField(grid, exits.map((e) => ({ at: e.at, extraM: 0 })));
    const routed = routedWorstDistance(grid, field, room)!;
    // Chỗ xa nhất: góc trên, cách cửa (5,0) chừng hypot(4.7, 9.7) ≈ 10.8 m.
    const straight = Math.hypot(4.7, 9.7);
    expect(routed.worstM).not.toBeNull();
    expect(routed.worstM!).toBeGreaterThanOrEqual(straight * 0.98);
    expect(routed.worstM!).toBeLessThanOrEqual(straight * 1.12);
    expect(routed.unreachableM2).toBe(0);
  });

  it("vách ngăn bắt đường đi vòng — dài hơn hẳn đường chim bay", () => {
    const { project, level, room, south } = boxRoom();
    project.addOpening(south.id, "DOOR", 1, { width: 1.0 });
    // Vách ngang giữa phòng, chừa lối 1 m sát mép phải: từ cửa (1,0) tới góc
    // (0.3, 9.7) phải đi vòng qua x≈9 rồi quay lại.
    project.addWall([0, 5, 0], [9, 5, 0], { levelId: level.id, thickness: 0.11 });
    const grid = buildEscapeGrid(project, level.id)!;
    const exits = exitsForRoom(room, exitsOnLevel(project, level.id));
    const field = distanceField(grid, exits.map((e) => ({ at: e.at, extraM: 0 })));
    const routed = routedWorstDistance(grid, field, room)!;

    const straight = Math.hypot(1 - 0.3, 9.7); // đường chim bay xuyên vách
    // Đường vòng tối thiểu: (1,0)→(~9.3,5)→(0.3,9.7) ≈ 9.7 + 10.2 ≈ 19 m.
    expect(routed.worstM!).toBeGreaterThan(straight * 1.7);
    expect(routed.worstM!).toBeGreaterThan(17);
    expect(routed.unreachableM2).toBe(0);
  });

  it("vách chắn kín một nửa phòng → nửa đó là vùng không tới được, không phải 'xa'", () => {
    const { project, level, room, south } = boxRoom();
    project.addOpening(south.id, "DOOR", 5, { width: 1.0 });
    // Vách kín toàn bề ngang, không cửa: nửa trên phòng bị nhốt.
    project.addWall([0, 5, 0], [10, 5, 0], { levelId: level.id, thickness: 0.11 });
    const grid = buildEscapeGrid(project, level.id)!;
    const exits = exitsForRoom(room, exitsOnLevel(project, level.id));
    const field = distanceField(grid, exits.map((e) => ({ at: e.at, extraM: 0 })));
    const routed = routedWorstDistance(grid, field, room)!;
    // Nửa trên ≈ 9.4 × 4.5 ≈ 42 m² — cho biên rát hoá rộng rãi.
    expect(routed.unreachableM2).toBeGreaterThan(30);
    // Và phát hiện phải nói "bị chắn", mức serious.
    const result = analyseRoom(room, exitsOnLevel(project, level.id), undefined, {
      grid,
      legs: new Map(),
    });
    expect(result.findings.some((f) => f.message.includes("bị tường chắn"))).toBe(true);
  });

  it("cửa đục vách ngăn mở lại đường — không còn vùng bị chắn", () => {
    const { project, level, room, south } = boxRoom();
    project.addOpening(south.id, "DOOR", 5, { width: 1.0 });
    const partition = project.addWall([0, 5, 0], [10, 5, 0], {
      levelId: level.id,
      thickness: 0.11,
    });
    project.addOpening(partition.id, "DOOR", 2, { width: 0.9 });
    const grid = buildEscapeGrid(project, level.id)!;
    const exits = exitsForRoom(room, exitsOnLevel(project, level.id));
    const field = distanceField(grid, exits.map((e) => ({ at: e.at, extraM: 0 })));
    const routed = routedWorstDistance(grid, field, room)!;
    expect(routed.unreachableM2).toBe(0);
    // Lưu ý ngữ nghĩa: cửa đục trên vách NẰM TRONG phòng cũng là "lối ra của
    // phòng" theo exitsForRoom — phòng vẽ một đa giác mà có vách kín bên
    // trong thực chất là hai phòng, và mô hình phòng không phán xử hộ điều
    // đó. Vậy điểm xa nhất đo tới cửa vách (2,5): góc (9.7,9.7) → ≈ 9,1 m
    // đường đi, cộng sai số lưới.
    expect(routed.worstM!).toBeGreaterThan(8.5);
    expect(routed.worstM!).toBeLessThan(11);
  });
});

describe("đoạn hành lang", () => {
  it("cửa mở vào hành lang cộng thêm quãng đi dọc hành lang tới lối ra kế", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const level = project.addLevel("Tầng 1", 0);
    const w = (a: [number, number], b: [number, number]) =>
      project.addWall([a[0], a[1], 0], [b[0], b[1], 0], { levelId: level.id, thickness: 0.2 });
    // Phòng 4×4 (trái) + hành lang 12×2 chạy sang phải, lối ra cuối hành lang.
    w([0, 0], [12, 0]); // nam (tường ngoài hành lang + phòng)
    const north = w([0, 2], [12, 2]); // vách giữa phòng-trên/hành lang… đơn giản hoá:
    // hành lang: dải y∈(0,2); phòng nằm trên dải y∈(2,6), cửa phòng đục vách `north`.
    w([0, 2], [0, 6]);
    w([0, 6], [4, 6]);
    w([4, 2], [4, 6]);
    w([0, 0], [0, 2]);
    const east = w([12, 0], [12, 2]);
    project.addOpening(north.id, "DOOR", 2, { width: 0.9 }); // cửa phòng → hành lang, tại x=2
    project.addOpening(east.id, "DOOR", 1, { width: 0.9 }); // lối ra cuối hành lang, x=12

    project.addRoom(
      "P.1",
      [
        [0.3, 2.3],
        [3.7, 2.3],
        [3.7, 5.7],
        [0.3, 5.7],
      ],
      { usage: "VAN_PHONG", levelId: level.id },
    );
    project.addRoom(
      "HL",
      [
        [0.3, 0.3],
        [11.7, 0.3],
        [11.7, 1.7],
        [0.3, 1.7],
      ],
      { usage: "HANH_LANG", levelId: level.id },
    );

    const grid = buildEscapeGrid(project, level.id)!;
    const exits = exitsOnLevel(project, level.id);
    const legs = corridorLegs(project, level.id, grid, exits, exitsForRoom);

    // Cửa phòng (x=2 trên vách y=2) nằm trên biên hành lang → có đoạn cộng
    // thêm ≈ quãng (2,2)→(12,1): chừng 10 m.
    const roomDoor = exits.find((exit) => Math.abs(exit.at[0] - 2) < 0.01);
    expect(roomDoor).toBeDefined();
    const leg = legs.get(roomDoor!.openingId);
    expect(leg).toBeDefined();
    expect(leg!).toBeGreaterThan(8);
    expect(leg!).toBeLessThan(13);

    // Và cự ly của phòng qua analyseProject phải GỒM đoạn đó: xa hơn hẳn
    // quãng trong phòng đơn thuần (≤ ~6 m).
    const results = analyseProject(project);
    const roomResult = results.find((r) => r.room.code === "P.1")!;
    expect(roomResult.travelMode).toBe("ROUTED");
    expect(roomResult.travelM!).toBeGreaterThan(12);
  });
});

describe("trên dự án demo", () => {
  it("mọi phòng đo được theo đường đi, không phòng nào bị chắn", () => {
    const project = buildDemoProject();
    for (const result of analyseProject(project)) {
      if (result.exits.length === 0) continue; // P.102 demo không có cửa — ca riêng
      expect(result.travelMode).toBe("ROUTED");
      expect(result.travelM).not.toBeNull();
      expect(result.unreachableM2).toBe(0);
    }
  });
});
