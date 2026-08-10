import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { sceneBounds } from "../src/viewport/Viewer3D";

describe("3D viewer bounds", () => {
  it("frames native walls, slabs and linked models together", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addLevel("Level 1", 0);
    project.addWall([0, 0, 0], [10, 0, 0], { height: 3 });
    project.addSlab("ROOF", [[0, 0], [10, 0], [10, 6], [0, 6]], {
      levelId: project.levels[0].id,
      zOffset: 3.2,
      thickness: 0.2,
    });
    const bounds = sceneBounds(project, [
      {
        name: "ext.ifc",
        skipped: 0,
        elements: [
          { name: "C1", ifcType: "IFCCOLUMN", min: [-5, -5, 0], max: [-4, -4, 9] },
        ],
      },
    ])!;
    expect(bounds.min[0]).toBeCloseTo(-5, 6);
    expect(bounds.max[0]).toBeCloseTo(10, 6);
    expect(bounds.max[1]).toBeCloseTo(6, 6);
    expect(bounds.max[2]).toBeCloseTo(9, 6); // linked column is tallest
    expect(sceneBounds(NativeBimProject.create("E", "S", "B", "L"), [])).toBeNull();
  });
});
