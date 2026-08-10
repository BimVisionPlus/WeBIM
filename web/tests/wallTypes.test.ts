import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { exportProjectToIfc } from "../src/export/ifcGrid";

describe("wall types", () => {
  it("derives wall thickness from the assembly and keeps it in sync", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wallType = project.addWallType("Brick 220", [
      { name: "Finish", material: "Plaster", thickness: 0.01 },
      { name: "Core", material: "Brick", thickness: 0.2 },
      { name: "Finish", material: "Plaster", thickness: 0.01 },
    ]);
    const wall = project.addWall([0, 0, 0], [8, 0, 0], { typeId: wallType.id });
    expect(wall.thickness).toBeCloseTo(0.22);
    // Editing the assembly re-derives every typed wall.
    project.updateWallType(wallType.id, {
      layers: [{ name: "Core", material: "Brick", thickness: 0.3 }],
    });
    expect(project.walls[0].thickness).toBeCloseTo(0.3);
    // Clearing the type frees manual thickness again.
    project.updateWall(wall.id, { typeId: null, thickness: 0.15 });
    expect(project.walls[0].thickness).toBeCloseTo(0.15);
    expect(project.walls[0].typeId).toBeUndefined();
  });

  it("guards deletion while in use and validates layers", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wallType = project.addWallType();
    project.addWall([0, 0, 0], [8, 0, 0], { typeId: wallType.id });
    expect(() => project.removeWallType(wallType.id)).toThrow("in use");
    expect(() => project.updateWallType(wallType.id, { layers: [] })).toThrow(
      "at least one layer",
    );
  });

  it("round-trips wall types and exports IfcMaterialLayerSet", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wallType = project.addWallType("Brick 220", [
      { name: "Finish", material: "Plaster", thickness: 0.01 },
      { name: "Core", material: "Brick", thickness: 0.2 },
    ]);
    project.addWall([0, 0, 0], [8, 0, 0], { typeId: wallType.id });
    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.wallTypes[0].layers).toHaveLength(2);
    expect(restored.walls[0].typeId).toBe(wallType.id);

    const ifc = exportProjectToIfc(project, { timestamp: "2026-08-10T00:00:00Z" });
    expect(ifc.match(/IFCMATERIALLAYERSET\(/g)).toHaveLength(1);
    expect(ifc.match(/IFCMATERIALLAYER\(/g)?.length).toBe(2);
    expect(ifc).toContain("IFCMATERIAL('Plaster'");
    expect(ifc).toContain("IFCMATERIAL('Brick'");
    expect(ifc.match(/IFCRELASSOCIATESMATERIAL\(/g)).toHaveLength(1);
    expect(ifc).toContain("'Brick 220'");
  });
});
