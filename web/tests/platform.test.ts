import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { qtoRows, qtoSummary, wallNetVolume } from "../src/application/qto";
import { clashReport, convexOverlapDepth } from "../src/application/clash";
import { searchStandards, supersessionChain, STANDARDS_CATALOG } from "../src/standards/catalog";

function baseProject() {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  project.addLevel("Level 1", 0);
  return project;
}

describe("QTO", () => {
  it("computes net wall volume with openings deducted", () => {
    const project = baseProject();
    const wall = project.addWall([0, 0, 0], [8, 0, 0], { thickness: 0.2, height: 3 });
    // Gross 8*0.2*3 = 4.8 m3
    expect(wallNetVolume(project, wall.id)).toBeCloseTo(4.8, 6);
    project.addOpening(wall.id, "DOOR", 4, { width: 1, height: 2.1 });
    // Minus door 1*0.2*2.1 = 0.42
    expect(wallNetVolume(project, wall.id)).toBeCloseTo(4.38, 6);
  });

  it("splits typed walls across layers and counts openings + slabs", () => {
    const project = baseProject();
    const wallType = project.addWallType("Brick", [
      { name: "Core", material: "Brick", thickness: 0.15 },
      { name: "Finish", material: "Plaster", thickness: 0.05 },
    ]);
    const wall = project.addWall([0, 0, 0], [4, 0, 0], {
      typeId: wallType.id,
      height: 3,
    });
    project.addOpening(wall.id, "WINDOW", 2);
    project.addSlab("FLOOR", [[0, 0], [4, 0], [4, 4], [0, 4]], {
      levelId: project.levels[0].id,
      thickness: 0.2,
    });
    const rows = qtoRows(project);
    const brick = rows.find((row) => row.material === "Brick")!;
    const plaster = rows.find((row) => row.material === "Plaster")!;
    expect(brick.quantity / plaster.quantity).toBeCloseTo(3, 5);
    expect(rows.find((row) => row.category === "Window")?.quantity).toBe(1);
    expect(rows.find((row) => row.category === "Floor slab")?.quantity).toBeCloseTo(3.2);
    const summary = qtoSummary(rows);
    expect(summary.length).toBeGreaterThan(2);
  });
});

describe("clash detection", () => {
  it("measures convex overlap and ignores touching", () => {
    const a: [number, number][] = [[0, 0], [2, 0], [2, 1], [0, 1]];
    const b: [number, number][] = [[1.5, 0], [3, 0], [3, 1], [1.5, 1]];
    expect(convexOverlapDepth(a, b)).toBeCloseTo(0.5, 6);
    const touching: [number, number][] = [[2, 0], [4, 0], [4, 1], [2, 1]];
    expect(convexOverlapDepth(a, touching)).toBe(0);
  });

  it("reports crossing walls but not joined ones", () => {
    const project = baseProject();
    // L-joined pair: no clash.
    project.addWall([0, 0, 0], [4, 0, 0]);
    project.addWall([4, 0, 0], [4, 3, 0]);
    expect(clashReport(project)).toHaveLength(0);
    // A wall crossing another mid-span without a T-join relationship:
    // overlapping footprints at the same level -> clash... T-join covers
    // end-on-face; a full crossing is a genuine clash.
    project.addWall([2, -1, 0], [2, 4, 0]);
    const clashes = clashReport(project);
    expect(clashes.length).toBeGreaterThan(0);
    expect(clashes[0].kind).toBe("WALL_WALL");
  });

  it("keeps slab bearing out but flags deep wall-slab penetration", () => {
    const project = baseProject();
    project.addWall([0, 0, 0], [4, 0, 0], { height: 3 });
    // Roof slab bearing on top: z overlap zero -> no clash.
    project.addSlab("ROOF", [[-1, -1], [5, -1], [5, 1], [-1, 1]], {
      levelId: project.levels[0].id,
      zOffset: 3.2,
      thickness: 0.2,
    });
    expect(clashReport(project)).toHaveLength(0);
    // A floor slab cutting through the wall mid-height clashes.
    project.addSlab("FLOOR", [[-1, -1], [5, -1], [5, 1], [-1, 1]], {
      levelId: project.levels[0].id,
      zOffset: 1.5,
      thickness: 0.2,
    });
    const clashes = clashReport(project);
    expect(clashes.some((clash) => clash.kind === "WALL_SLAB")).toBe(true);
  });
});

describe("standards catalog", () => {
  it("searches without diacritics across code, title and tags", () => {
    expect(searchStandards("chay").some((entry) => entry.code.startsWith("QCVN 06"))).toBe(true);
    expect(searchStandards("tai trong")[0].code).toContain("2737");
    expect(searchStandards("zzz-nothing")).toHaveLength(0);
    expect(searchStandards("")).toHaveLength(STANDARDS_CATALOG.length);
  });

  it("follows supersession chains", () => {
    const fire = STANDARDS_CATALOG.find((entry) => entry.id === "qcvn-06-2022")!;
    expect(supersessionChain(fire)).toContain("QCVN 06:2021/BXD");
  });
});

describe("CDE documents and tasks (domain)", () => {
  it("numbers revisions by status prefix and round-trips", () => {
    const project = baseProject();
    const document = project.addDocument("WBM-XYZ-00-GF-DR-A-0001", "Plan");
    project.addDocumentRevision(document.id, "first", "k1", "plan.pdf", "t1");
    project.addDocumentRevision(document.id, "second", null, null, "t2");
    expect(document.revisions.map((revision) => revision.rev)).toEqual(["P01", "P02"]);
    project.updateDocument(document.id, { status: "PUBLISHED" });
    project.addDocumentRevision(document.id, "contract", "k2", "plan-c.pdf", "t3");
    expect(document.revisions[2].rev).toBe("C01");
    project.addDocumentNote(document.id, "check axis B", "sophie", "t4");
    const task = project.addTask("Kết cấu tầng 1", "Kết cấu", "2026-08-01", "2026-09-01");
    project.updateTask(task.id, { progress: 40, status: "IN_PROGRESS" });
    expect(() => project.updateTask(task.id, { progress: 150 })).toThrow("between");

    const restored = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(restored.documents[0].revisions).toHaveLength(3);
    expect(restored.documents[0].notes[0].text).toBe("check axis B");
    expect(restored.tasks[0].progress).toBe(40);
    expect(restored.tasks[0].status).toBe("IN_PROGRESS");
  });
});
