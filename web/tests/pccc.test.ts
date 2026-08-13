// A screen that says a room is fine when it is not is worse than no screen,
// so these check the boundaries and the things it declines to claim.
import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { buildDemoProject } from "../src/demo/seedProject";
import {
  analyseProject,
  analyseRoom,
  DEFAULT_RULES,
  exitsForRoom,
  exitsOnLevel,
  MIN_EXIT_WIDTH_M,
  occupancyOf,
  roomArea,
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

describe("area and occupancy", () => {
  it("measures the polygon regardless of winding", () => {
    const { room } = square(10);
    expect(roomArea(room)).toBeCloseTo(100, 6);
    room.outline = [...room.outline].reverse();
    expect(roomArea(room)).toBeCloseTo(100, 6);
  });

  it("derives occupancy from area and usage, rounding up", () => {
    const { room } = square(10);
    // 100 m² / 10 m² per person
    expect(occupancyOf(room)).toBe(10);
    room.usage = "HOP";
    expect(occupancyOf(room)).toBe(Math.ceil(100 / DEFAULT_RULES.HOP.densityM2PerPerson));
  });

  /** Someone who counted the seats knows better than the density table. */
  it("prefers an explicit override over the table", () => {
    const { room } = square(10);
    room.occupancyOverride = 3;
    expect(occupancyOf(room)).toBe(3);
  });

  it("treats a circulation space as carrying no occupancy of its own", () => {
    const { room } = square(10);
    room.usage = "HANH_LANG";
    expect(occupancyOf(room)).toBe(0);
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
    // Door at one corner: the opposite corner is the diagonal away.
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

describe("findings", () => {
  it("is serious when a room has no door", () => {
    const { room } = square(10);
    const result = analyseRoom(room, []);
    expect(result.findings.some((f) => f.level === "serious")).toBe(true);
    expect(result.travelM).toBeNull();
  });

  it("flags travel beyond the single-exit limit", () => {
    const { room } = square(40); // diagonal ≈ 56 m, limit 20
    const result = analyseRoom(room, [exit([0, 0])]);
    expect(result.findings.some((f) => f.message.includes("Cự ly"))).toBe(true);
  });

  it("uses the two-exit limit once there are two exits", () => {
    const { room } = square(25); // diagonal ≈ 35 m: over 20, under 40
    expect(analyseRoom(room, [exit([0, 0])]).findings.some((f) => f.message.includes("Cự ly"))).toBe(true);
    const two = analyseRoom(room, [exit([0, 0]), exit([25, 25])]);
    expect(two.findings.some((f) => f.message.includes("Cự ly"))).toBe(false);
  });

  it("requires exit width in proportion to occupancy", () => {
    const { room } = square(10);
    room.occupancyOverride = 300; // needs 3.0 m
    const narrow = analyseRoom(room, [exit([5, 0], 1.2)]);
    expect(narrow.requiredWidthM).toBeCloseTo(3, 6);
    expect(narrow.findings.some((f) => f.message.includes("Bề rộng"))).toBe(true);
  });

  it("never requires less than the absolute minimum width", () => {
    const { room } = square(4);
    room.occupancyOverride = 2;
    expect(analyseRoom(room, [exit([2, 0])]).requiredWidthM).toBe(MIN_EXIT_WIDTH_M);
  });

  it("warns about a crowded room with a single exit", () => {
    const { room } = square(10);
    room.occupancyOverride = 60;
    const result = analyseRoom(room, [exit([5, 0], 5)]);
    expect(result.findings.some((f) => f.message.includes("hai lối thoát"))).toBe(true);
  });

  it("says nothing about a small room with a door of adequate width", () => {
    const { room } = square(8);
    const result = analyseRoom(room, [exit([4, 0], 1.2), exit([4, 8], 1.2)]);
    expect(result.findings).toEqual([]);
  });
});

describe("the demo project", () => {
  it("has rooms, and the screen runs on them", () => {
    const results = analyseProject(buildDemoProject());
    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const result of results) {
      expect(result.areaM2).toBeGreaterThan(0);
      expect(result.occupancy).toBeGreaterThan(0);
    }
  });

  it("round-trips rooms through the project JSON", () => {
    const project = buildDemoProject();
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(reloaded.rooms).toHaveLength(project.rooms.length);
    expect(reloaded.rooms[0].usage).toBe(project.rooms[0].usage);
    expect(reloaded.toDict()).toEqual(project.toDict());
  });

  it("keeps rooms out of the JSON until one exists", () => {
    const empty = NativeBimProject.create("P", "S", "B", "L1");
    expect(empty.toDict()).not.toHaveProperty("rooms");
  });
});
