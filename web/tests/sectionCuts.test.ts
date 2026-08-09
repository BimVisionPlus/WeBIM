import { describe, expect, it } from "vitest";
import {
  hatchSegments,
  polygonPlaneIntervals,
  slabSectionCuts,
  wallSectionCuts,
} from "../src/application/sectionCuts";
import { NativeBimProject } from "../src/domain/project";

describe("polygonPlaneIntervals", () => {
  it("finds the crossing interval of a rectangle", () => {
    const outline: [number, number][] = [[-2, -0.1], [6, -0.1], [6, 0.1], [-2, 0.1]];
    expect(polygonPlaneIntervals(outline, 0)).toEqual([[-0.1, 0.1]]);
  });

  it("returns nothing when the polygon does not span the plane", () => {
    const outline: [number, number][] = [[1, 0], [2, 0], [2, 1], [1, 1]];
    expect(polygonPlaneIntervals(outline, 0)).toEqual([]);
  });
});

describe("wallSectionCuts", () => {
  it("cuts a solid wall crossing the plane into one full-height rect", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([-2, 0, 0], [6, 0, 0]);
    const cuts = wallSectionCuts(wall, project.walls, 0);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].u0).toBeCloseTo(-0.1, 9);
    expect(cuts[0].u1).toBeCloseTo(0.1, 9);
    expect(cuts[0].z0).toBe(0);
    expect(cuts[0].z1).toBeCloseTo(3);
  });

  it("cuts only the lintel when the plane passes through a door", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([-2, 0, 0], [6, 0, 0]);
    // Door centred at wall offset 2 = world x 0.
    project.addOpening(wall.id, "DOOR", 2, { width: 1, height: 2.1 });
    const cuts = wallSectionCuts(project.walls[0], project.walls, 0);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].z0).toBeCloseTo(2.1);
    expect(cuts[0].z1).toBeCloseTo(3);
  });

  it("misses walls that do not reach the plane", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([1, 0, 0], [6, 0, 0]);
    expect(wallSectionCuts(wall, project.walls, 0)).toEqual([]);
  });
});

describe("slabSectionCuts", () => {
  it("cuts a slab spanning the plane at its thickness band", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const level = project.addLevel("Level 1", 0);
    const slab = project.addSlab("ROOF", [[-4, -1], [4, -1], [4, 5], [-4, 5]], {
      levelId: level.id,
      zOffset: 3,
    });
    const cuts = slabSectionCuts(slab, project.slabTopZ(slab), 0);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].u0).toBe(-1);
    expect(cuts[0].u1).toBe(5);
    expect(cuts[0].z0).toBeCloseTo(2.8);
    expect(cuts[0].z1).toBeCloseTo(3);
  });
});

describe("hatchSegments", () => {
  it("fills a rect with 45-degree lines clipped to its bounds", () => {
    const segments = hatchSegments({ u0: 0, u1: 1, z0: 0, z1: 1 }, 0.5);
    expect(segments.length).toBeGreaterThan(1);
    for (const [u0, z0, u1, z1] of segments) {
      // 45 degrees: du == dz, and endpoints stay inside the rect.
      expect(u1 - u0).toBeCloseTo(z1 - z0, 9);
      for (const value of [u0, u1, z0, z1]) {
        expect(value).toBeGreaterThanOrEqual(-1e-9);
        expect(value).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("rejects non-positive spacing", () => {
    expect(() => hatchSegments({ u0: 0, u1: 1, z0: 0, z1: 1 }, 0)).toThrow("spacing");
  });
});
