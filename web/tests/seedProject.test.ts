// The demo is the first thing anyone sees, and it is built from the same
// constructors the tools use — so these assert it is a complete project
// rather than that it has particular contents.
import { describe, expect, it } from "vitest";
import { buildDemoProject } from "../src/demo/seedProject";
import { NativeBimProject } from "../src/domain/project";
import { exportProjectToIfc } from "../src/export/ifcGrid";
import { qtoRows, wallNetVolume } from "../src/application/qto";

describe("demo project", () => {
  it("fills every branch of the Project Browser", () => {
    const project = buildDemoProject();
    expect(project.gridAxes.length).toBeGreaterThanOrEqual(6);
    expect(project.levels).toHaveLength(2);
    expect(project.walls.length).toBeGreaterThanOrEqual(8);
    expect(project.slabs).toHaveLength(3);
    expect(project.views.length).toBeGreaterThanOrEqual(4);
    expect(project.sheets).toHaveLength(1);
    expect(project.schedules).toHaveLength(4);
    expect(project.wallTypes.length).toBeGreaterThanOrEqual(2);
    expect(project.dimensions).toHaveLength(1);
    expect(project.documents).toHaveLength(2);
    expect(project.tasks).toHaveLength(5);
  });

  /** The old JSON demo had none, while the README said it did. */
  it("has doors and windows, not just walls", () => {
    const openings = buildDemoProject().walls.flatMap((wall) => wall.openings);
    expect(openings.filter((opening) => opening.kind === "DOOR").length).toBeGreaterThanOrEqual(2);
    expect(openings.filter((opening) => opening.kind === "WINDOW").length).toBeGreaterThanOrEqual(4);
  });

  it("round-trips through the project JSON the add-on reads", () => {
    const project = buildDemoProject();
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(reloaded.toDict()).toEqual(project.toDict());
    expect(reloaded.schemaVersion).toBe(project.schemaVersion);
  });

  it("exports to IFC — the demo must not be the thing that breaks export", () => {
    const ifc = exportProjectToIfc(buildDemoProject());
    expect(ifc).toContain("ISO-10303-21;");
    expect(ifc).toContain("IFCGRID");
    expect(ifc).toContain("IFCWALL");
    expect(ifc).toContain("IFCDOOR");
    expect(ifc).toContain("IFCWINDOW");
  });

  it("gives the take-off every category it can produce", () => {
    const rows = qtoRows(buildDemoProject());
    const categories = new Set(rows.map((row) => row.category));
    expect([...categories].sort()).toEqual([
      "Door",
      "Floor slab",
      "Roof slab",
      "Wall",
      "Window",
    ]);
    expect(rows.every((row) => row.quantity > 0)).toBe(true);
  });

  /**
   * Both storeys have the same 12 m front wall of the same type; only the
   * ground one is pierced. Comparing them measures the deduction without
   * assuming how mitred corners contribute.
   */
  it("deducts its openings from the wall volume", () => {
    const project = buildDemoProject();
    const front = project.walls.filter(
      (wall) => wall.start[0] === 0 && wall.start[1] === 0 && wall.end[0] === 12,
    );
    expect(front).toHaveLength(2);
    const pierced = front.find((wall) => wall.openings.length > 0)!;
    const solid = front.find((wall) => wall.openings.length === 0)!;
    expect(wallNetVolume(project, pierced.id)).toBeLessThan(
      wallNetVolume(project, solid.id),
    );
  });

  it("is deterministic apart from ids", () => {
    const strip = (project: NativeBimProject) =>
      JSON.stringify(project.toDict()).replace(/"[0-9a-f]{32}"/g, '"id"');
    expect(strip(buildDemoProject())).toBe(strip(buildDemoProject()));
  });
});
