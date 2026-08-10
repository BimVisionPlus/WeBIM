import { describe, expect, it } from "vitest";
import { dimensionGeometry, distanceToDimension } from "../src/application/dimensions";
import { NativeBimProject } from "../src/domain/project";

describe("dimensionGeometry", () => {
  it("offsets the dimension line and measures the length", () => {
    const geometry = dimensionGeometry({ start: [0, 0], end: [8, 0], offset: 1.5 });
    expect(geometry.value).toBeCloseTo(8);
    expect(geometry.line[0]).toEqual([0, 1.5]);
    expect(geometry.line[1]).toEqual([8, 1.5]);
    // Extension lines run from the measured points past the line.
    expect(geometry.extensions[0][0]).toEqual([0, 0]);
    expect(geometry.extensions[0][1][1]).toBeCloseTo(1.65);
    expect(geometry.ticks).toHaveLength(2);
    expect(geometry.textPosition[0]).toBeCloseTo(4);
    expect(geometry.textPosition[1]).toBeGreaterThan(1.5);
  });

  it("supports negative offsets (other side)", () => {
    const geometry = dimensionGeometry({ start: [0, 0], end: [8, 0], offset: -1 });
    expect(geometry.line[0][1]).toBeCloseTo(-1);
    expect(geometry.textPosition[1]).toBeLessThan(-1);
  });

  it("computes picking distance to the dimension line", () => {
    const dimension = { start: [0, 0] as [number, number], end: [8, 0] as [number, number], offset: 1 };
    expect(distanceToDimension(dimension, [4, 1.2])).toBeCloseTo(0.2);
    expect(distanceToDimension(dimension, [-1, 1])).toBeCloseTo(1);
  });
});

describe("dimension domain", () => {
  it("binds dimensions to a view and round-trips", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const view = project.addView("Plan", "FLOOR_PLAN");
    const dimension = project.addDimension(view.id, [0, 0], [8, 0], 1.5);
    expect(() => project.addDimension("missing", [0, 0], [1, 0], 1)).toThrow(
      "Unknown TechnicalView",
    );
    expect(() => project.addDimension(view.id, [1, 1], [1, 1], 1)).toThrow(
      "different points",
    );
    project.updateDimension(dimension.id, { offset: -2 });
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.dimensions[0].viewId).toBe(view.id);
    expect(restored.dimensions[0].offset).toBe(-2);
  });
});
