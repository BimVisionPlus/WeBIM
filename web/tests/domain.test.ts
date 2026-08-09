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
