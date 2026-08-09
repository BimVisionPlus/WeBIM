import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { exportProjectToIfc, groupAxisFamilies, ifcGuid } from "../src/export/ifcGrid";

function projectWith(axes: Array<[[number, number, number], [number, number, number]]>) {
  const project = NativeBimProject.create("Test", "Site", "Building", "Storey");
  for (const [start, end] of axes) {
    project.addGridAxis(start, end);
  }
  return project;
}

describe("ifcGuid", () => {
  it("produces 22-char IFC base64 ids", () => {
    for (let i = 0; i < 20; i += 1) {
      const guid = ifcGuid();
      expect(guid).toHaveLength(22);
      expect(guid).toMatch(/^[0-3][0-9A-Za-z_$]{21}$/);
    }
  });
});

describe("groupAxisFamilies", () => {
  it("groups parallel axes within one degree", () => {
    const project = projectWith([
      [[0, 0, 0], [0, 10, 0]],
      [[5, 0, 0], [5.05, 10, 0]],
      [[0, 0, 0], [10, 0, 0]],
    ]);
    const families = groupAxisFamilies(project.gridAxes);
    expect(families).toHaveLength(2);
    expect(families[0].axes).toHaveLength(2);
  });
});

describe("exportProjectToIfc", () => {
  it("exports two axis families as a RECTANGULAR IfcGrid", () => {
    const project = projectWith([
      [[0, 0, 0], [0, 10, 0]],
      [[5, 0, 0], [5, 10, 0]],
      [[0, 0, 0], [10, 0, 0]],
      [[0, 5, 0], [10, 5, 0]],
    ]);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc).toContain("FILE_SCHEMA(('IFC4'))");
    expect(ifc).toContain("IFCGRID(");
    expect(ifc).toContain(".RECTANGULAR.");
    expect(ifc.match(/IFCGRIDAXIS\(/g)).toHaveLength(4);
    expect(ifc).toContain("'A'");
    expect(ifc).not.toContain("IFCANNOTATION(");
  });

  it("exports three families as TRIANGULAR", () => {
    const project = projectWith([
      [[0, 0, 0], [0, 10, 0]],
      [[0, 0, 0], [10, 0, 0]],
      [[0, 0, 0], [10, 10, 0]],
    ]);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc).toContain(".TRIANGULAR.");
  });

  it("keeps a single family as standalone IfcAnnotation axes", () => {
    const project = projectWith([
      [[0, 0, 0], [0, 10, 0]],
      [[5, 0, 0], [5, 10, 0]],
    ]);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc).not.toContain("IFCGRID(");
    expect(ifc.match(/IFCANNOTATION\(/g)).toHaveLength(2);
    expect(ifc).toContain("'WEBIM_GRID_AXIS'");
  });

  it("splits systems into separate IfcGrids", () => {
    const project = projectWith([]);
    project.addGridAxis([0, 0, 0], [0, 10, 0], { systemName: "G1" });
    project.addGridAxis([0, 0, 0], [10, 0, 0], { systemName: "G1" });
    project.addGridAxis([20, 0, 0], [20, 10, 0], { systemName: "G2" });
    project.addGridAxis([20, 0, 0], [30, 0, 0], { systemName: "G2" });
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc.match(/IFCGRID\(/g)).toHaveLength(2);
    expect(ifc).toContain("'G1'");
    expect(ifc).toContain("'G2'");
  });

  it("contains the spatial hierarchy", () => {
    const ifc = exportProjectToIfc(projectWith([[[0, 0, 0], [0, 1, 0]]]), {
      timestamp: "2026-08-09T00:00:00Z",
    });
    for (const entity of [
      "IFCPROJECT(",
      "IFCSITE(",
      "IFCBUILDING(",
      "IFCBUILDINGSTOREY(",
      "IFCRELAGGREGATES(",
      "IFCRELCONTAINEDINSPATIALSTRUCTURE(",
    ]) {
      expect(ifc).toContain(entity);
    }
  });
});

describe("wall export", () => {
  it("exports walls as IfcWall with a swept footprint body", () => {
    const project = projectWith([]);
    project.addWall([0, 0, 0], [5, 0, 0], { thickness: 0.3, height: 2.8 });
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc.match(/IFCWALL\(/g)).toHaveLength(1);
    expect(ifc).toContain("IFCEXTRUDEDAREASOLID(");
    expect(ifc).toContain("IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,");
    expect(ifc).toContain("'W1'");
    expect(ifc).toContain("2.8");
    expect(ifc).toContain("IFCRELCONTAINEDINSPATIALSTRUCTURE(");
  });

  it("exports mitered footprint corners for joined walls", () => {
    const project = projectWith([]);
    project.addWall([0, 0, 0], [4, 0, 0]);
    project.addWall([4, 0, 0], [4, 3, 0]);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc.match(/IFCWALL\(/g)).toHaveLength(2);
    // Shared miter corners appear in both wall profiles; (3.9,0.1) is also
    // wall B's first point, repeated to close its polyline.
    expect(ifc.match(/IFCCARTESIANPOINT\(\(3\.9,0\.1\)\)/g)?.length).toBe(3);
    expect(ifc.match(/IFCCARTESIANPOINT\(\(4\.1,-0\.1\)\)/g)?.length).toBe(2);
  });
});

describe("wall connection relationships", () => {
  it("emits IfcRelConnectsPathElements for corner and T joins", () => {
    const project = projectWith([]);
    project.addWall([0, 0, 0], [8, 0, 0]);
    project.addWall([8, 0, 0], [8, 3, 0]);
    project.addWall([4, -3, 0], [4, 0, 0]);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    const rels = ifc.match(/IFCRELCONNECTSPATHELEMENTS\(/g);
    expect(rels).toHaveLength(2);
    expect(ifc).toContain(".ATPATH.");
    expect(ifc).toContain("(),(),.ATSTART.,.ATEND.");
  });

  it("emits no relationship for SQUARE ends", () => {
    const project = projectWith([]);
    project.addWall([0, 0, 0], [4, 0, 0], { joinEnd: "SQUARE" } as never);
    project.addWall([4, 0, 0], [4, 3, 0]);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc).not.toContain("IFCRELCONNECTSPATHELEMENTS(");
  });
});

describe("opening export", () => {
  it("voids the wall and fills with an IfcDoor", () => {
    const project = projectWith([]);
    const wall = project.addWall([0, 0, 0], [8, 0, 0]);
    project.addOpening(wall.id, "DOOR", 4);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc.match(/IFCOPENINGELEMENT\(/g)).toHaveLength(1);
    expect(ifc.match(/IFCRELVOIDSELEMENT\(/g)).toHaveLength(1);
    expect(ifc.match(/IFCDOOR\(/g)).toHaveLength(1);
    expect(ifc.match(/IFCRELFILLSELEMENT\(/g)).toHaveLength(1);
    expect(ifc).toContain(".OPENING.");
    expect(ifc).toContain("'D1'");
  });

  it("exports windows as IfcWindow with sill-height placement", () => {
    const project = projectWith([]);
    const wall = project.addWall([0, 0, 0], [8, 0, 0]);
    project.addOpening(wall.id, "WINDOW", 4);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc.match(/IFCWINDOW\(/g)).toHaveLength(1);
    expect(ifc).toContain("(0.,0.,0.9)");
    expect(ifc).toContain("'WN1'");
  });
});

describe("multi-storey export", () => {
  it("exports one IfcBuildingStorey per level and contains walls by level", () => {
    const project = projectWith([]);
    const ground = project.addLevel("Level 1", 0);
    const upper = project.addLevel("Level 2", 3);
    project.addWall([0, 0, 0], [4, 0, 0], { levelId: ground.id } as never);
    project.addWall([0, 5, 0], [4, 5, 0], { levelId: upper.id } as never);
    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-09T00:00:00Z" });
    expect(ifc.match(/IFCBUILDINGSTOREY\(/g)).toHaveLength(2);
    expect(ifc).toContain("'Level 1'");
    expect(ifc).toContain("'Level 2'");
    // Two containment relationships, one per storey.
    expect(ifc.match(/IFCRELCONTAINEDINSPATIALSTRUCTURE\(/g)).toHaveLength(2);
    // Upper wall base placement sits at the level elevation.
    expect(ifc).toContain("(0.,0.,3.)");
    // Storey elevations are written on the storeys themselves.
    expect(ifc).toContain(".ELEMENT.,3.");
  });
});
