import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import {
  climateFindings,
  compassSector,
  exteriorNormal,
  facadeByOrientation,
} from "../src/application/climate";

function squareBuilding() {
  // 10×10 m square, walls 3 m high; centroid at (5,5).
  const project = NativeBimProject.create("P", "S", "B", "L1");
  project.addLevel("Level 1", 0);
  const south = project.addWall([0, 0, 0], [10, 0, 0], { height: 3 });
  const east = project.addWall([10, 0, 0], [10, 10, 0], { height: 3 });
  project.addWall([10, 10, 0], [0, 10, 0], { height: 3 }); // north
  const west = project.addWall([0, 10, 0], [0, 0, 0], { height: 3 });
  return { project, south, east, west };
}

describe("climate analysis", () => {
  it("maps normals to compass sectors with +Y = North", () => {
    expect(compassSector(0, 1)).toBe("Bắc");
    expect(compassSector(1, 0)).toBe("Đông");
    expect(compassSector(0, -1)).toBe("Nam");
    expect(compassSector(-1, 0)).toBe("Tây");
    expect(compassSector(1, 1)).toBe("Đông Bắc");
    expect(compassSector(-1, -1)).toBe("Tây Nam");
  });

  it("picks the exterior normal pointing away from the centroid", () => {
    const { project, south } = squareBuilding();
    void project;
    const [nx, ny] = exteriorNormal(south, [5, 5]);
    expect(nx).toBeCloseTo(0, 6);
    expect(ny).toBeCloseTo(-1, 6); // south wall faces south
  });

  it("aggregates façade and glazing per orientation", () => {
    const { project, west } = squareBuilding();
    project.addOpening(west.id, "WINDOW", 5, { width: 4, height: 1.5 }); // 6 m² kính hướng Tây
    project.addOpening(west.id, "DOOR", 2, { width: 0.9, height: 2.1 });
    const rows = facadeByOrientation(project);
    expect(rows.map((row) => row.orientation).sort()).toEqual(
      ["Bắc", "Nam", "Tây", "Đông"].sort(),
    );
    const westRow = rows.find((row) => row.orientation === "Tây")!;
    expect(westRow.wallArea).toBeCloseTo(30, 6); // 10 × 3
    expect(westRow.windowArea).toBeCloseTo(6, 6);
    expect(westRow.doorArea).toBeCloseTo(1.89, 6);
    expect(westRow.wwr).toBeCloseTo(0.2, 6);
  });

  it("flags west-facing glazing above 30% and clean projects politely", () => {
    const { project, west } = squareBuilding();
    project.addOpening(west.id, "WINDOW", 3, { width: 5, height: 2 });
    project.addOpening(west.id, "WINDOW", 7.5, { width: 2, height: 2 }); // 14 m² / 30 m² = 47%
    const warnings = climateFindings(facadeByOrientation(project)).filter(
      (finding) => finding.severity === "warning",
    );
    expect(warnings.some((finding) => finding.text.includes("Tây"))).toBe(true);

    const clean = squareBuilding().project;
    const calmFindings = climateFindings(facadeByOrientation(clean));
    expect(calmFindings.every((finding) => finding.severity === "info")).toBe(true);
  });
});

describe("OTTV ước tính (QCVN 09)", () => {
  it("kính nhiều hướng Tây đẩy OTTV vượt 60; đặc hoàn toàn thì đạt", async () => {
    const { estimateOttv } = await import("../src/application/climate");
    const glassyWest = estimateOttv([
      { orientation: "Tây", wallCount: 1, wallArea: 100, windowArea: 60, doorArea: 0, wwr: 0.6 },
    ]);
    expect(glassyWest?.pass).toBe(false);
    expect(glassyWest!.overall).toBeGreaterThan(60);

    const solidNorth = estimateOttv([
      { orientation: "Bắc", wallCount: 1, wallArea: 100, windowArea: 0, doorArea: 0, wwr: 0 },
    ]);
    expect(solidNorth?.pass).toBe(true);

    expect(estimateOttv([])).toBeNull();
  });
});
