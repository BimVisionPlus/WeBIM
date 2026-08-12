// A dashboard's failure mode is a confident wrong number, so these check the
// arithmetic and — above all — that nothing quietly disappears from it.
import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { buildDemoProject } from "../src/demo/seedProject";
import { pairKey } from "../src/application/clashMatrix";
import {
  clashBreakdown,
  documentsByStatus,
  modelTotals,
  openingsByKind,
  planProgress,
  tasksByStatus,
  volumeByMaterial,
} from "../src/application/dashboard";

const label = (id: string) => id;

describe("modelTotals", () => {
  it("counts openings across every wall, not per wall", () => {
    const totals = modelTotals(buildDemoProject());
    expect(totals.walls).toBeGreaterThanOrEqual(8);
    expect(totals.openings).toBe(7);
    expect(totals.slabs).toBe(3);
  });
});

describe("clashBreakdown", () => {
  it("reports what survives the matrix and how much was hidden", () => {
    const project = buildDemoProject();
    const before = clashBreakdown(project, [], label);
    expect(before.reported).toBeGreaterThan(0);
    expect(before.suppressed).toBe(0);

    project.clashMatrix[pairKey("NATIVE_SLAB", "NATIVE_SLAB")] = {
      enabled: false,
      toleranceM: 0.001,
    };
    const after = clashBreakdown(project, [], label);
    expect(after.reported).toBeLessThan(before.reported);
    expect(after.reported + after.suppressed).toBe(before.reported);
  });

  it("ranks pairs by count, biggest first", () => {
    const rows = clashBreakdown(buildDemoProject(), [], label).byPair;
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value);
    }
  });
});

describe("status breakdowns", () => {
  it("keeps workflow order and shows empty states as zero, not as absent", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addDocument("A-001", "Một tài liệu");
    const rows = documentsByStatus(project);
    expect(rows.map((row) => row.label)).toEqual(["WIP", "SHARED", "PUBLISHED", "ARCHIVED"]);
    expect(rows[0].value).toBe(1);
    expect(rows[3].value).toBe(0);
  });

  it("accounts for every task exactly once", () => {
    const project = buildDemoProject();
    const total = tasksByStatus(project).reduce((sum, row) => sum + row.value, 0);
    expect(total).toBe(project.tasks.length);
  });
});

describe("planProgress", () => {
  it("is zero rather than NaN with no tasks", () => {
    expect(planProgress(NativeBimProject.create("P", "S", "B", "L1"))).toBe(0);
  });

  it("averages task progress", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const a = project.addTask("A");
    const b = project.addTask("B");
    a.progress = 100;
    b.progress = 50;
    expect(planProgress(project)).toBe(75);
  });
});

describe("volumeByMaterial", () => {
  it("sums a material across walls instead of listing each wall", () => {
    const rows = volumeByMaterial(buildDemoProject());
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.label)).size).toBe(rows.length);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].value).toBeGreaterThanOrEqual(rows[i].value);
    }
  });

  /** A ninth colour is never invented; the tail folds into one row. */
  it("folds the tail into 'Khác' rather than growing the palette", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addLevel("L1", 0);
    for (let i = 0; i < 12; i += 1) {
      const type = project.addWallType(`T${i}`, [
        { name: "Lõi", material: `Vật liệu ${i}`, thickness: 0.2 },
      ]);
      project.addWall([0, i * 2, 0], [4, i * 2, 0], { typeId: type.id });
    }
    const rows = volumeByMaterial(project, 8);
    expect(rows).toHaveLength(8);
    expect(rows[7].label).toBe("Khác");
    expect(rows[7].value).toBeGreaterThan(0);
  });

  it("keeps every cubic metre when folding — the tail is summed, not dropped", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addLevel("L1", 0);
    for (let i = 0; i < 10; i += 1) {
      const type = project.addWallType(`T${i}`, [
        { name: "Lõi", material: `M${i}`, thickness: 0.2 },
      ]);
      project.addWall([0, i * 2, 0], [4, i * 2, 0], { typeId: type.id });
    }
    const full = volumeByMaterial(project, 99).reduce((sum, row) => sum + row.value, 0);
    const folded = volumeByMaterial(project, 5).reduce((sum, row) => sum + row.value, 0);
    expect(folded).toBeCloseTo(full, 1);
  });
});

describe("openingsByKind", () => {
  it("splits doors from windows", () => {
    expect(openingsByKind(buildDemoProject())).toEqual([
      { label: "Cửa đi", value: 2 },
      { label: "Cửa sổ", value: 5 },
    ]);
  });
});
