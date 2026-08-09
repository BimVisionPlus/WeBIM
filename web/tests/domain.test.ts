import { describe, expect, it } from "vitest";
import { dashSpans, LINE_PATTERNS, paperMmToModelUnits } from "../src/domain/lineStyles";
import { letterLabel, NativeBimProject } from "../src/domain/project";
import { snapGridPoint } from "../src/application/gridSnapping";

describe("letterLabel", () => {
  it("matches the Python letter sequence", () => {
    expect(letterLabel(0)).toBe("A");
    expect(letterLabel(25)).toBe("Z");
    expect(letterLabel(26)).toBe("AA");
    expect(letterLabel(27)).toBe("AB");
    expect(letterLabel(701)).toBe("ZZ");
    expect(letterLabel(702)).toBe("AAA");
  });
});

describe("NativeBimProject", () => {
  it("round-trips through the schema v4 JSON used by the Blender add-on", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addGridAxis([0, 0, 0], [0, 10, 0]);
    project.addGridAxis([0, 0, 0], [10, 0, 0], { headType: "HEXAGON", headScale: 1.5 });
    project.addView("Level 1", "FLOOR_PLAN", 50, 30);

    const payload = JSON.stringify(project.toDict());
    const parsed = JSON.parse(payload);
    expect(parsed.schema_version).toBe(4);
    expect(parsed.grid_axes[0].system_name).toBe("Default Grid");
    expect(parsed.grid_axes[1].head_type).toBe("HEXAGON");
    expect(parsed.views[0].view_type).toBe("FLOOR_PLAN");

    const restored = NativeBimProject.fromJson(payload);
    expect(restored.gridAxes).toHaveLength(2);
    expect(restored.gridAxes[0].name).toBe("A");
    expect(restored.gridAxes[1].headScale).toBe(1.5);
    expect(restored.views[0].scale).toBe(50);
  });

  it("rejects zero-length axes and bad view types", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    expect(() => project.addGridAxis([1, 1, 0], [1, 1, 0])).toThrow(
      "two different points",
    );
    expect(() => project.addView("V", "PERSPECTIVE")).toThrow("Unsupported");
  });

  it("assigns sequential names and updates immutably by id", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const first = project.addGridAxis([0, 0, 0], [0, 5, 0]);
    project.addGridAxis([1, 0, 0], [1, 5, 0]);
    expect(project.gridAxes.map((axis) => axis.name)).toEqual(["A", "B"]);
    const updated = project.updateGridAxis(first.id, { end: [0, 8, 0] });
    expect(updated.end).toEqual([0, 8, 0]);
    expect(updated.name).toBe("A");
    expect(() => project.updateGridAxis("missing", {})).toThrow("Unknown GridDatum");
  });
});

describe("snapGridPoint", () => {
  it("prefers endpoint snap over everything", () => {
    const result = snapGridPoint([3.21, 4.79, 0], {
      start: [0, 0, 0],
      endpoint: [3.0, 5.0, 0],
    });
    expect(result.kind).toBe("ENDPOINT");
    expect(result.point).toEqual([3.0, 5.0, 0]);
  });

  it("locks to the X axis inside the tolerance cone", () => {
    const result = snapGridPoint([10.03, 0.4, 0], { start: [0, 0, 0] });
    expect(result.kind).toBe("AXIS_X");
    expect(result.point[1]).toBe(0);
    expect(result.point[0]).toBeCloseTo(10.0, 10);
  });

  it("locks to the Y axis inside the tolerance cone", () => {
    const result = snapGridPoint([0.3, 8.02, 0], { start: [0, 0, 0] });
    expect(result.kind).toBe("AXIS_Y");
    expect(result.point[0]).toBe(0);
    expect(result.point[1]).toBeCloseTo(8.0, 10);
  });

  it("rounds free points to the increment", () => {
    const result = snapGridPoint([1.234, 5.678, 0], { increment: 0.25 });
    expect(result.kind).toBe("INCREMENT");
    expect(result.point[0]).toBeCloseTo(1.25, 10);
    expect(result.point[1]).toBeCloseTo(5.75, 10);
  });
});

describe("line styles", () => {
  it("converts paper mm to model metres by view scale", () => {
    expect(paperMmToModelUnits(12.5, 100)).toBeCloseTo(1.25, 10);
    expect(paperMmToModelUnits(12.5, 50)).toBeCloseTo(0.625, 10);
  });

  it("tiles the CENTER pattern along a line", () => {
    const spans = dashSpans(5, LINE_PATTERNS.get("CENTER")!, 100);
    expect(spans[0]).toEqual([0, 1.25]);
    expect(spans[1][0]).toBeCloseTo(1.55, 10);
    const total = spans.reduce((sum, [from, to]) => sum + (to - from), 0);
    expect(total).toBeLessThan(5);
  });

  it("keeps continuous lines whole", () => {
    expect(dashSpans(7, LINE_PATTERNS.get("CONTINUOUS")!, 100)).toEqual([[0, 7]]);
  });
});

describe("walls", () => {
  it("creates, updates and round-trips walls", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [4, 0, 0]);
    expect(wall.name).toBe("W1");
    expect(wall.thickness).toBeCloseTo(0.2);
    expect(wall.height).toBeCloseTo(3.0);
    project.updateWall(wall.id, { height: 2.7 });
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.walls).toHaveLength(1);
    expect(restored.walls[0].height).toBeCloseTo(2.7);
    expect(() => project.addWall([1, 1, 0], [1, 1, 0])).toThrow("different");
    expect(() => project.updateWall(wall.id, { thickness: 0 })).toThrow("thickness");
  });

  it("stays loadable when the walls key is absent (Blender add-on JSON)", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const payload = JSON.parse(JSON.stringify(project.toDict()));
    delete payload.walls;
    const restored = NativeBimProject.fromJson(JSON.stringify(payload));
    expect(restored.walls).toEqual([]);
  });
});

describe("wall join types (domain)", () => {
  it("defaults to MITER and round-trips overrides", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [4, 0, 0]);
    expect(wall.joinStart).toBe("MITER");
    project.updateWall(wall.id, { joinEnd: "BUTT" });
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.walls[0].joinEnd).toBe("BUTT");
    expect(restored.walls[0].joinStart).toBe("MITER");
    expect(() => project.updateWall(wall.id, { joinEnd: "WELD" as never })).toThrow(
      "Unknown wall join type",
    );
  });

  it("defaults missing join keys in legacy JSON to MITER", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addWall([0, 0, 0], [4, 0, 0]);
    const payload = JSON.parse(JSON.stringify(project.toDict()));
    delete payload.walls[0].join_start;
    delete payload.walls[0].join_end;
    const restored = NativeBimProject.fromJson(JSON.stringify(payload));
    expect(restored.walls[0].joinStart).toBe("MITER");
    expect(restored.walls[0].joinEnd).toBe("MITER");
  });
});

describe("wall openings (domain)", () => {
  it("adds doors and windows with kind defaults and sequential names", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0]);
    const door = project.addOpening(wall.id, "DOOR", 2);
    const window = project.addOpening(wall.id, "WINDOW", 5);
    expect(door.name).toBe("D1");
    expect(door.width).toBeCloseTo(0.9);
    expect(door.height).toBeCloseTo(2.1);
    expect(door.sillHeight).toBe(0);
    expect(window.name).toBe("WN1");
    expect(window.sillHeight).toBeCloseTo(0.9);
    expect(project.openingHost(door.id)?.id).toBe(wall.id);
  });

  it("validates opening bounds against the host wall", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0], { height: 3 });
    expect(() => project.addOpening(wall.id, "DOOR", 0.2)).toThrow("wall length");
    expect(() => project.addOpening(wall.id, "WINDOW", 4, { sillHeight: 2.5 })).toThrow(
      "wall height",
    );
    const door = project.addOpening(wall.id, "DOOR", 4);
    expect(() =>
      project.updateOpening(wall.id, door.id, { width: 0 }),
    ).toThrow("width");
  });

  it("round-trips openings through JSON and defaults legacy files", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0]);
    project.addOpening(wall.id, "DOOR", 2, { width: 1.0 });
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.walls[0].openings).toHaveLength(1);
    expect(restored.walls[0].openings[0].kind).toBe("DOOR");
    expect(restored.walls[0].openings[0].width).toBeCloseTo(1.0);

    const payload = JSON.parse(JSON.stringify(project.toDict()));
    delete payload.walls[0].openings;
    const legacy = NativeBimProject.fromJson(JSON.stringify(payload));
    expect(legacy.walls[0].openings).toEqual([]);
  });
});

describe("opening overlap validation", () => {
  it("rejects overlapping openings on the same wall", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0]);
    project.addOpening(wall.id, "DOOR", 4, { width: 1 });
    expect(() => project.addOpening(wall.id, "WINDOW", 4.5, { width: 1.2 })).toThrow(
      "overlaps D1",
    );
  });

  it("allows edge-to-edge openings and blocks updates into overlap", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0]);
    project.addOpening(wall.id, "DOOR", 2, { width: 1 });
    const window = project.addOpening(wall.id, "WINDOW", 3.1, { width: 1.2 });
    expect(() =>
      project.updateOpening(wall.id, window.id, { offset: 2.5 }),
    ).toThrow("overlaps D1");
    // Touching exactly edge-to-edge is allowed.
    project.updateOpening(wall.id, window.id, { offset: 3.1 });
  });

  it("round-trips hinge and swing and defaults legacy JSON", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0]);
    const door = project.addOpening(wall.id, "DOOR", 4);
    expect(door.hingeEnd).toBe("START");
    project.updateOpening(wall.id, door.id, { hingeEnd: "END", swingSide: "RIGHT" });
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.walls[0].openings[0].hingeEnd).toBe("END");
    expect(restored.walls[0].openings[0].swingSide).toBe("RIGHT");

    const payload = JSON.parse(JSON.stringify(project.toDict()));
    delete payload.walls[0].openings[0].hinge_end;
    delete payload.walls[0].openings[0].swing_side;
    const legacy = NativeBimProject.fromJson(JSON.stringify(payload));
    expect(legacy.walls[0].openings[0].hingeEnd).toBe("START");
    expect(legacy.walls[0].openings[0].swingSide).toBe("LEFT");
  });
});

describe("levels", () => {
  it("hosts walls: base z follows the level elevation", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const ground = project.addLevel("Level 1", 0);
    const upper = project.addLevel("Level 2", 3);
    const wall = project.addWall([0, 0, 0], [4, 0, 0], { levelId: upper.id });
    expect(wall.start[2]).toBe(3);
    expect(wall.levelId).toBe(upper.id);
    // Moving the level carries its walls.
    project.updateLevel(upper.id, { elevation: 3.5 });
    expect(project.walls[0].start[2]).toBe(3.5);
    expect(project.walls[0].end[2]).toBe(3.5);
    // Re-hosting a wall moves it to the new level's elevation.
    project.updateWall(wall.id, { levelId: ground.id });
    expect(project.walls[0].start[2]).toBe(0);
  });

  it("keeps levels sorted and guards deletion", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const l2 = project.addLevel("Level 2", 3);
    project.addLevel("Level 1", 0);
    expect(project.levels.map((level) => level.name)).toEqual(["Level 1", "Level 2"]);
    project.addWall([0, 0, 0], [4, 0, 0], { levelId: l2.id });
    expect(() => project.removeLevel(l2.id)).toThrow("hosts walls");
  });

  it("migrates legacy JSON without levels", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addWall([0, 0, 0], [4, 0, 0]);
    project.addView("Plan", "FLOOR_PLAN");
    const payload = JSON.parse(JSON.stringify(project.toDict()));
    delete payload.levels;
    delete payload.walls[0].level_id;
    delete payload.views[0].level_id;
    const restored = NativeBimProject.fromJson(JSON.stringify(payload));
    expect(restored.levels).toHaveLength(1);
    expect(restored.walls[0].levelId).toBe(restored.levels[0].id);
    expect(restored.views[0].levelId).toBe(restored.levels[0].id);
  });
});

describe("sheets", () => {
  it("numbers sheets and places views once each", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const view = project.addView("Plan", "FLOOR_PLAN");
    const sheet = project.addSheet("Ground floor plan");
    expect(sheet.name).toBe("A101");
    expect(project.addSheet("Details").name).toBe("A102");
    project.placeViewOnSheet(sheet.id, view.id, 60, 320);
    expect(() => project.placeViewOnSheet(sheet.id, view.id, 100, 100)).toThrow(
      "already placed",
    );
    project.updateSheetPlacement(sheet.id, sheet.placements[0].id, { x: 200 });
    expect(sheet.placements[0].x).toBe(200);
  });

  it("round-trips levels and sheets through JSON", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const level = project.addLevel("Level 1", 0);
    const view = project.addView("Plan", "FLOOR_PLAN", 100, 40, level.id);
    const sheet = project.addSheet("Plans");
    project.placeViewOnSheet(sheet.id, view.id, 60, 320);
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.levels[0].name).toBe("Level 1");
    expect(restored.views[0].levelId).toBe(level.id);
    expect(restored.sheets[0].name).toBe("A101");
    expect(restored.sheets[0].placements[0].viewId).toBe(view.id);
  });
});
