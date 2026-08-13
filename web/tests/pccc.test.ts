// A screen that says a room is fine when it is not is worse than no screen,
// so these check the boundaries and the things it declines to claim.
//
// The first block pins the numbers to the document. It looks tautological —
// asserting a constant equals itself — but that is the point: these values
// were wrong before they were checked against the công báo, and a test that
// names the bảng is what stops the next edit from drifting off it silently.
import { describe, expect, it } from "vitest";
import { NativeBimProject, type FireSettings } from "../src/domain/project";
import { buildDemoProject } from "../src/demo/seedProject";
import {
  analyseProject,
  analyseRoom,
  DEFAULT_FIRE_SETTINGS,
  exitsForRoom,
  exitsOnLevel,
  exitSeparation,
  isUsableFlowDensity,
  MIN_WIDTH_M,
  MIN_WIDTH_CROWDED_M,
  occupancyOf,
  PEOPLE_PER_METRE,
  requiredExitWidthM,
  roomArea,
  travelLimit,
  USAGE_RULES,
  worstTravelDistance,
  type Exit,
} from "../src/application/pccc";

function square(size = 10) {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  const level = project.addLevel("Tầng 1", 0);
  const room = project.addRoom("P.1", [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ], { usage: "VAN_PHONG", levelId: level.id });
  return { project, room, level };
}

const exit = (at: [number, number], widthM = 1.2): Exit => ({
  openingId: `e-${at.join("-")}`,
  name: "D1",
  at,
  widthM,
});

const settings = (patch: Partial<FireSettings> = {}): FireSettings => ({
  ...DEFAULT_FIRE_SETTINGS,
  ...patch,
});

describe("the numbers match QCVN 06:2022/BXD (Sửa đổi 1:2023)", () => {
  it("carries Bảng G.9 hệ số không gian sàn", () => {
    expect(USAGE_RULES.HOI_TRUONG.floorSpaceFactorM2).toBe(1.0);
    expect(USAGE_RULES.HOP.floorSpaceFactorM2).toBe(1.5);
    expect(USAGE_RULES.THUONG_MAI.floorSpaceFactorM2).toBe(3.0);
    expect(USAGE_RULES.BAO_TANG.floorSpaceFactorM2).toBe(5.0);
    expect(USAGE_RULES.VAN_PHONG.floorSpaceFactorM2).toBe(6.0);
    expect(USAGE_RULES.O.floorSpaceFactorM2).toBe(8.0);
    expect(USAGE_RULES.PHONG_KHACH.floorSpaceFactorM2).toBe(10.0);
    expect(USAGE_RULES.KHO.floorSpaceFactorM2).toBe(30.0);
  });

  /** Guessing a factor is how the previous version got this wrong. */
  it("leaves a factor null where Bảng G.9 has no row, rather than inventing one", () => {
    expect(USAGE_RULES.KY_THUAT.floorSpaceFactorM2).toBeNull();
    expect(USAGE_RULES.DE_XE.floorSpaceFactorM2).toBeNull(); // tính theo ô đỗ
    expect(USAGE_RULES.HANH_LANG.floorSpaceFactorM2).toBeNull();
  });

  it("carries the G.2.1.1 người/m by bậc chịu lửa", () => {
    expect(PEOPLE_PER_METRE.I).toBe(165);
    expect(PEOPLE_PER_METRE.II).toBe(165);
    expect(PEOPLE_PER_METRE.III).toBe(115);
    expect(PEOPLE_PER_METRE.IV).toBe(115);
    expect(PEOPLE_PER_METRE.V).toBe(80);
  });

  it("reads travel limits off the right axes, not off room usage", () => {
    // Bảng G.2a, bậc I–III: giữa hai lối ra 60 m ở mật độ ≤2 người/m².
    expect(travelLimit(settings({ flowDensity: 2 }), 2).metres).toBe(60);
    // Cùng nhà, mật độ >5 → 20 m. Công năng phòng không đổi.
    expect(travelLimit(settings({ flowDensity: 6 }), 2).metres).toBe(20);
    // Hành lang cụt luôn ngặt hơn.
    expect(travelLimit(settings({ flowDensity: 2 }), 1).metres).toBe(30);
    // Bậc V ngặt hơn bậc II ở cùng mật độ.
    expect(travelLimit(settings({ grade: "V" }), 2).metres).toBeLessThan(
      travelLimit(settings({ grade: "II" }), 2).metres,
    );
    // Nhà ở đọc Bảng G.1, khoá theo cấp nguy hiểm cháy kết cấu.
    expect(travelLimit(settings({ group: "F1.3", grade: "II", structureClass: "S0" }), 2).metres).toBe(40);
    expect(travelLimit(settings({ group: "F1.3", grade: "II", structureClass: "S1" }), 2).metres).toBe(30);
    expect(travelLimit(settings({ group: "F1.3", grade: "II", structureClass: "S0" }), 1).metres).toBe(25);
  });
});

describe("area and occupancy", () => {
  it("measures the polygon regardless of winding", () => {
    const { room } = square(10);
    expect(roomArea(room)).toBeCloseTo(100, 6);
    room.outline = [...room.outline].reverse();
    expect(roomArea(room)).toBeCloseTo(100, 6);
  });

  it("derives occupancy from area and Bảng G.9, rounding up", () => {
    const { room } = square(10); // 100 m², văn phòng 6,0 m²/người
    expect(occupancyOf(room)).toEqual({ people: 17, from: "Bảng G.9" });
    room.usage = "HOP";
    expect(occupancyOf(room)).toEqual({ people: 67, from: "Bảng G.9" });
  });

  /** G.3 puts the approved design first and the table second. */
  it("prefers the approved design figure over the table, and says so", () => {
    const { room } = square(10);
    room.occupancyOverride = 3;
    expect(occupancyOf(room)).toEqual({ people: 3, from: "thiết kế" });
  });

  /**
   * Zero-with-a-reason, not zero-as-a-fact: the caller can tell "no people"
   * apart from "Bảng G.9 cannot say", which is what the screen reports.
   */
  it("reports an unknown factor as unknown rather than as zero people", () => {
    const { room } = square(10);
    room.usage = "KY_THUAT";
    expect(occupancyOf(room)).toEqual({ people: 0, from: "không xác định" });
    const result = analyseRoom(room, [exit([5, 0])]);
    expect(result.findings.some((f) => f.clause === "G.3")).toBe(true);
  });
});

describe("finding a room's exits", () => {
  it("accepts a door on the boundary, where doors actually sit", () => {
    const { room } = square(10);
    expect(exitsForRoom(room, [exit([5, 0])])).toHaveLength(1);
  });

  it("rejects a door belonging to another room", () => {
    const { room } = square(10);
    expect(exitsForRoom(room, [exit([25, 25])])).toHaveLength(0);
  });

  it("reads doors off walls at their offset along the wall", () => {
    const { project, level } = square(10);
    const wall = project.addWall([0, 0, 0], [10, 0, 0], { levelId: level.id });
    project.addOpening(wall.id, "DOOR", 4, { width: 1.2 });
    project.addOpening(wall.id, "WINDOW", 8, { width: 1.5 });
    const exits = exitsOnLevel(project, level.id);
    expect(exits).toHaveLength(1); // the window is not an exit
    expect(exits[0].at[0]).toBeCloseTo(4, 6);
  });
});

describe("travel distance", () => {
  it("is the furthest corner from the nearest exit", () => {
    const { room } = square(10);
    expect(worstTravelDistance(room, [exit([0, 0])])!).toBeCloseTo(Math.hypot(10, 10), 6);
  });

  it("improves when a second exit is added", () => {
    const { room } = square(10);
    const one = worstTravelDistance(room, [exit([0, 0])])!;
    const two = worstTravelDistance(room, [exit([0, 0]), exit([10, 10])])!;
    expect(two).toBeLessThan(one);
  });

  /** Null, not zero — no exits is a different statement from no distance. */
  it("is null with no exits at all", () => {
    const { room } = square(10);
    expect(worstTravelDistance(room, [])).toBeNull();
  });
});

describe("exit width", () => {
  it("scales with occupancy at the G.2.1.1 rate for the bậc chịu lửa", () => {
    // 330 người ở bậc II: 330 / 165 = 2,0 m.
    expect(requiredExitWidthM(330, settings({ grade: "II" }))).toBeCloseTo(2.0, 6);
    // Cùng số người, bậc V chỉ tải 80 người/m → rộng gấp đôi.
    expect(requiredExitWidthM(330, settings({ grade: "V" }))).toBeCloseTo(330 / 80, 6);
  });

  it("never drops below the 3.2.9 minimum", () => {
    expect(requiredExitWidthM(2, settings())).toBe(MIN_WIDTH_M);
  });

  it("lifts the minimum to 1,2 m above 50 người, except in F1.3", () => {
    expect(requiredExitWidthM(60, settings())).toBe(MIN_WIDTH_CROWDED_M);
    expect(requiredExitWidthM(60, settings({ group: "F1.3" }))).toBe(MIN_WIDTH_M);
  });
});

describe("distance between two exits — 3.2.8", () => {
  it("wants half the largest diagonal, and at least 7 m", () => {
    const { room } = square(20); // đường chéo ≈ 28,3 m → cần ≈ 14,1 m
    const result = exitSeparation(room, [exit([0, 0]), exit([20, 0])], settings())!;
    expect(result.requiredM).toBeCloseTo(Math.hypot(20, 20) / 2, 6);
    // Tâm cách 20 m, cộng nửa bề rộng mỗi cửa.
    expect(result.actualM).toBeCloseTo(20 + 1.2, 6);
  });

  it("relaxes to a third of the diagonal when the building is sprinklered", () => {
    const { room } = square(20);
    const dry = exitSeparation(room, [exit([0, 0]), exit([20, 0])], settings())!;
    const wet = exitSeparation(room, [exit([0, 0]), exit([20, 0])], settings({ sprinklered: true }))!;
    expect(wet.requiredM).toBeLessThan(dry.requiredM);
  });

  it("keeps the 7 m floor in a small room where a third of the diagonal is tiny", () => {
    const { room } = square(6); // đường chéo ≈ 8,5 m → nửa ≈ 4,2 m
    expect(exitSeparation(room, [exit([0, 0]), exit([6, 0])], settings())!.requiredM).toBe(7);
  });

  /** Nothing to measure with one door — null, not a passing zero. */
  it("says nothing with fewer than two exits", () => {
    const { room } = square(10);
    expect(exitSeparation(room, [exit([5, 0])], settings())).toBeNull();
  });

  it("flags two doors placed side by side", () => {
    const { room } = square(20);
    const result = analyseRoom(room, [exit([9, 0]), exit([11, 0])], settings());
    expect(result.findings.some((f) => f.clause === "3.2.8")).toBe(true);
  });
});

describe("findings", () => {
  it("is serious when a room has no door", () => {
    const { room } = square(10);
    const result = analyseRoom(room, [], settings());
    expect(result.findings.some((f) => f.clause === "3.2.1")).toBe(true);
    expect(result.travelM).toBeNull();
  });

  it("demands a second exit above 50 người — 3.2.5 c)", () => {
    const { room } = square(10);
    room.occupancyOverride = 50;
    const result = analyseRoom(room, [exit([5, 0], 5)], settings());
    expect(result.findings.some((f) => f.clause === "3.2.5 c)")).toBe(true);
    room.occupancyOverride = 49;
    expect(
      analyseRoom(room, [exit([5, 0], 5)], settings()).findings.some((f) => f.clause === "3.2.5 c)"),
    ).toBe(false);
  });

  it("demands a second exit past 25 m even under 50 người — 3.2.5 d)", () => {
    const { room } = square(30);
    room.occupancyOverride = 10;
    const result = analyseRoom(room, [exit([0, 0], 2)], settings());
    expect(result.findings.some((f) => f.clause === "3.2.5 d)")).toBe(true);
  });

  it("flags travel beyond the Bảng G.2a limit", () => {
    const { room } = square(60); // đường chéo ≈ 85 m, hành lang cụt 30 m
    room.occupancyOverride = 10;
    const result = analyseRoom(room, [exit([0, 0], 2)], settings());
    expect(result.findings.some((f) => f.clause.startsWith("Bảng G.2a"))).toBe(true);
  });

  it("relaxes the limit once a second exit puts the room between two exits", () => {
    const { room } = square(30); // đường chéo ≈ 42 m: quá 30 m cụt, dưới 60 m
    room.occupancyOverride = 10;
    const one = analyseRoom(room, [exit([0, 0], 2)], settings());
    expect(one.findings.some((f) => f.clause.startsWith("Bảng G.2a"))).toBe(true);
    const two = analyseRoom(room, [exit([0, 0], 2), exit([30, 30], 2)], settings());
    expect(two.findings.some((f) => f.clause.startsWith("Bảng G.2a"))).toBe(false);
  });

  it("requires exit width in proportion to occupancy", () => {
    const { room } = square(10);
    room.occupancyOverride = 330; // 2,0 m ở bậc II
    const narrow = analyseRoom(room, [exit([5, 0], 1.2), exit([5, 10], 0.3)], settings());
    expect(narrow.requiredWidthM).toBeCloseTo(2.0, 6);
    expect(narrow.findings.some((f) => f.clause === "G.2.1.1 + 3.2.9")).toBe(true);
  });

  it("says nothing about a small room with two adequate, well-separated doors", () => {
    const { room } = square(8);
    room.occupancyOverride = 8;
    const result = analyseRoom(room, [exit([0, 0], 1.2), exit([8, 8], 1.2)], settings());
    expect(result.findings).toEqual([]);
  });
});

describe("the demo project", () => {
  it("has rooms, and the screen runs on them", () => {
    const project = buildDemoProject();
    const results = analyseProject(project, project.fireSettings);
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const result of results) {
      expect(result.areaM2).toBeGreaterThan(0);
      expect(result.occupancy.people).toBeGreaterThan(0);
    }
  });

  it("round-trips rooms and fire settings through the project JSON", () => {
    const project = buildDemoProject();
    project.fireSettings = { ...project.fireSettings, grade: "III", sprinklered: true };
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(reloaded.rooms).toHaveLength(project.rooms.length);
    expect(reloaded.rooms[0].usage).toBe(project.rooms[0].usage);
    expect(reloaded.fireSettings).toEqual(project.fireSettings);
    expect(reloaded.toDict()).toEqual(project.toDict());
  });

  it("keeps rooms and fire settings out of the JSON until they differ", () => {
    const empty = NativeBimProject.create("P", "S", "B", "L1");
    expect(empty.toDict()).not.toHaveProperty("rooms");
    expect(empty.toDict()).not.toHaveProperty("fire_settings");
  });
});

/**
 * Bảng G.2a has no column for a density of zero, and reading `<= 2` off the
 * top of the table hands that case the loosest limit in it. A screen that
 * turns an empty field into permission is worse than one that refuses to
 * answer, so the fallback is the strictest column.
 */
describe("a flow density the table cannot be read at", () => {
  it("falls to the strictest column, not the most permissive one", () => {
    const strictest = travelLimit(settings({ flowDensity: 6 }), 2).metres;
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(travelLimit(settings({ flowDensity: bad }), 2).metres).toBe(strictest);
      expect(isUsableFlowDensity(bad)).toBe(false);
    }
    // The loosest column is still reachable with a real density.
    expect(travelLimit(settings({ flowDensity: 2 }), 2).metres).toBe(60);
    expect(isUsableFlowDensity(2)).toBe(true);
  });

  it("says in the citation that the density was not usable", () => {
    expect(travelLimit(settings({ flowDensity: 0 }), 2).source).toContain("chưa nhập");
    expect(travelLimit(settings({ flowDensity: 3 }), 2).source).toContain("3 người/m²");
  });

  /** Nhà ở reads Bảng G.1, which has no density axis at all. */
  it("does not let a bad density touch the residential table", () => {
    const group = "F1.3" as const;
    expect(travelLimit(settings({ group, flowDensity: 0 }), 2).metres).toBe(
      travelLimit(settings({ group, flowDensity: 4 }), 2).metres,
    );
  });
});
