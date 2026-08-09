import { describe, expect, it } from "vitest";
import {
  openingFootprint,
  wallFootprint,
  wallJoins,
  wallPieces,
} from "../src/application/wallGeometry";
import { NativeBimProject } from "../src/domain/project";

function projectWithWalls(
  segments: Array<[[number, number, number], [number, number, number]]>,
  thickness = 0.2,
) {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  for (const [start, end] of segments) {
    project.addWall(start, end, { thickness });
  }
  return project;
}

function expectPoint(actual: [number, number], expected: [number, number]) {
  expect(actual[0]).toBeCloseTo(expected[0], 9);
  expect(actual[1]).toBeCloseTo(expected[1], 9);
}

describe("wallFootprint", () => {
  it("keeps an isolated wall rectangular", () => {
    const project = projectWithWalls([[[0, 0, 0], [4, 0, 0]]]);
    const [sl, el, er, sr] = wallFootprint(project.walls[0], project.walls);
    expectPoint(sl, [0, 0.1]);
    expectPoint(el, [4, 0.1]);
    expectPoint(er, [4, -0.1]);
    expectPoint(sr, [0, -0.1]);
  });

  it("miters an L corner so both walls share the two corner points", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [4, 0, 0]],
      [[4, 0, 0], [4, 3, 0]],
    ]);
    const [wallA, wallB] = project.walls;
    const footprintA = wallFootprint(wallA, project.walls);
    const footprintB = wallFootprint(wallB, project.walls);
    // Wall A: end corners are mitered.
    expectPoint(footprintA[1], [3.9, 0.1]); // endLeft = inner corner
    expectPoint(footprintA[2], [4.1, -0.1]); // endRight = outer corner
    // Wall B: start corners are the same two points.
    expectPoint(footprintB[0], [3.9, 0.1]); // startLeft = inner corner
    expectPoint(footprintB[3], [4.1, -0.1]); // startRight = outer corner
    // Untouched ends stay square.
    expectPoint(footprintA[0], [0, 0.1]);
    expectPoint(footprintB[1], [3.9, 3]);
  });

  it("miters a mixed-thickness corner on the correct offsets", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addWall([0, 0, 0], [4, 0, 0], { thickness: 0.2 });
    project.addWall([4, 0, 0], [4, 3, 0], { thickness: 0.4 });
    const [wallA, wallB] = project.walls;
    const footprintA = wallFootprint(wallA, project.walls);
    expectPoint(footprintA[1], [3.8, 0.1]);
    expectPoint(footprintA[2], [4.2, -0.1]);
    const footprintB = wallFootprint(wallB, project.walls);
    expectPoint(footprintB[0], [3.8, 0.1]);
    expectPoint(footprintB[3], [4.2, -0.1]);
  });

  it("keeps square ends for collinear continuations", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [4, 0, 0]],
      [[4, 0, 0], [8, 0, 0]],
    ]);
    const [sl, el, er, sr] = wallFootprint(project.walls[0], project.walls);
    expectPoint(sl, [0, 0.1]);
    expectPoint(el, [4, 0.1]);
    expectPoint(er, [4, -0.1]);
    expectPoint(sr, [0, -0.1]);
  });

  it("keeps square ends at T joints (three wall ends)", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [4, 0, 0]],
      [[4, 0, 0], [4, 3, 0]],
      [[4, 0, 0], [8, 0, 0]],
    ]);
    const [, el, er] = wallFootprint(project.walls[0], project.walls);
    expectPoint(el, [4, 0.1]);
    expectPoint(er, [4, -0.1]);
  });

  it("falls back to square ends past the miter limit", () => {
    // ~7 degrees between the two axes -> miter reach far beyond 4x thickness.
    const project = projectWithWalls([
      [[0, 0, 0], [4, 0, 0]],
      [[4, 0, 0], [0.03, 0.5, 0]],
    ]);
    const [, el, er] = wallFootprint(project.walls[0], project.walls);
    expectPoint(el, [4, 0.1]);
    expectPoint(er, [4, -0.1]);
  });
});

describe("wallFootprint T-joins", () => {
  it("trims a wall drawn to the axis back to the near face", () => {
    // B ends on A's centerline; its end face should sit on A's near face.
    const project = projectWithWalls([
      [[0, 0, 0], [8, 0, 0]],
      [[4, -3, 0], [4, 0, 0]],
    ]);
    const [wallA, wallB] = project.walls;
    const footprintB = wallFootprint(wallB, project.walls);
    expectPoint(footprintB[1], [3.9, -0.1]); // endLeft
    expectPoint(footprintB[2], [4.1, -0.1]); // endRight
    // The continuous wall stays a full rectangle.
    const footprintA = wallFootprint(wallA, project.walls);
    expectPoint(footprintA[0], [0, 0.1]);
    expectPoint(footprintA[1], [8, 0.1]);
    expectPoint(footprintA[2], [8, -0.1]);
    expectPoint(footprintA[3], [0, -0.1]);
  });

  it("extends a wall stopping inside the footprint out to the face", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [8, 0, 0]],
      [[4, -3, 0], [4, -0.05, 0]],
    ]);
    const footprintB = wallFootprint(project.walls[1], project.walls);
    expectPoint(footprintB[1], [3.9, -0.1]);
    expectPoint(footprintB[2], [4.1, -0.1]);
  });

  it("trims an overshoot past the centerline back to the body-side face", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [8, 0, 0]],
      [[4, -3, 0], [4, 0.08, 0]],
    ]);
    const footprintB = wallFootprint(project.walls[1], project.walls);
    expectPoint(footprintB[1], [3.9, -0.1]);
    expectPoint(footprintB[2], [4.1, -0.1]);
  });

  it("butts an angled T against the face line", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [8, 0, 0]],
      [[1, -3, 0], [4, 0, 0]],
    ]);
    const footprintB = wallFootprint(project.walls[1], project.walls);
    // Both end corners land on the near face y = -0.1.
    expect(footprintB[1][1]).toBeCloseTo(-0.1, 9);
    expect(footprintB[2][1]).toBeCloseTo(-0.1, 9);
    expectPoint(footprintB[1], [3.7585786438, -0.1]);
    expectPoint(footprintB[2], [4.0414213562, -0.1]);
  });

  it("leaves a wall alone when it stops clear of the other wall", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [8, 0, 0]],
      [[4, -3, 0], [4, -0.4, 0]],
    ]);
    const footprintB = wallFootprint(project.walls[1], project.walls);
    expectPoint(footprintB[1], [3.9, -0.4]);
    expectPoint(footprintB[2], [4.1, -0.4]);
  });

  it("does not T-join near the continuous wall's own end", () => {
    // Endpoint over A's axis but within half a thickness of A's start.
    const project = projectWithWalls([
      [[0, 0, 0], [8, 0, 0]],
      [[0.05, -3, 0], [0.05, 0, 0]],
    ]);
    const footprintB = wallFootprint(project.walls[1], project.walls);
    expectPoint(footprintB[1], [-0.05, 0]);
    expectPoint(footprintB[2], [0.15, 0]);
  });

  it("ignores parallel walls", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [8, 0, 0]],
      [[2, 0.05, 0], [6, 0.05, 0]],
    ]);
    const footprintB = wallFootprint(project.walls[1], project.walls);
    expectPoint(footprintB[0], [2, 0.15]);
    expectPoint(footprintB[1], [6, 0.15]);
  });

  it("corner miter wins over T-join when ends coincide", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [4, 0, 0]],
      [[4, 0, 0], [4, 3, 0]],
    ]);
    const footprintA = wallFootprint(project.walls[0], project.walls);
    expectPoint(footprintA[1], [3.9, 0.1]);
    expectPoint(footprintA[2], [4.1, -0.1]);
  });
});

describe("wall join types", () => {
  it("BUTT at a corner runs the older wall through to the far face", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addWall([0, 0, 0], [4, 0, 0], { thickness: 0.2, joinEnd: "BUTT" });
    project.addWall([4, 0, 0], [4, 3, 0], { thickness: 0.2 });
    const [wallA, wallB] = project.walls;
    // A (older) runs through: square end at B's far face x = 4.1.
    const footprintA = wallFootprint(wallA, project.walls);
    expectPoint(footprintA[1], [4.1, 0.1]);
    expectPoint(footprintA[2], [4.1, -0.1]);
    // B butts against A's near face y = 0.1.
    const footprintB = wallFootprint(wallB, project.walls);
    expectPoint(footprintB[0], [3.9, 0.1]);
    expectPoint(footprintB[3], [4.1, 0.1]);
  });

  it("SQUARE on either end disables the corner join for both walls", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addWall([0, 0, 0], [4, 0, 0], { thickness: 0.2, joinEnd: "SQUARE" });
    project.addWall([4, 0, 0], [4, 3, 0], { thickness: 0.2 });
    const footprintA = wallFootprint(project.walls[0], project.walls);
    expectPoint(footprintA[1], [4, 0.1]);
    expectPoint(footprintA[2], [4, -0.1]);
    const footprintB = wallFootprint(project.walls[1], project.walls);
    expectPoint(footprintB[0], [3.9, 0]);
    expectPoint(footprintB[3], [4.1, 0]);
  });

  it("SQUARE disables a T-join trim", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addWall([0, 0, 0], [8, 0, 0], { thickness: 0.2 });
    project.addWall([4, -3, 0], [4, 0, 0], { thickness: 0.2, joinEnd: "SQUARE" });
    const footprintB = wallFootprint(project.walls[1], project.walls);
    expectPoint(footprintB[1], [3.9, 0]);
    expectPoint(footprintB[2], [4.1, 0]);
  });
});

describe("wallJoins", () => {
  it("records a corner pair once with end connections", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [4, 0, 0]],
      [[4, 0, 0], [4, 3, 0]],
    ]);
    const joins = wallJoins(project.walls);
    expect(joins).toHaveLength(1);
    expect(joins[0].relating).toEqual({ id: project.walls[0].id, connection: "ATEND" });
    expect(joins[0].related).toEqual({ id: project.walls[1].id, connection: "ATSTART" });
  });

  it("records a T-join with ATPATH on the continuous wall", () => {
    const project = projectWithWalls([
      [[0, 0, 0], [8, 0, 0]],
      [[4, -3, 0], [4, 0, 0]],
    ]);
    const joins = wallJoins(project.walls);
    expect(joins).toHaveLength(1);
    expect(joins[0].relating).toEqual({ id: project.walls[1].id, connection: "ATEND" });
    expect(joins[0].related).toEqual({ id: project.walls[0].id, connection: "ATPATH" });
  });

  it("emits nothing for SQUARE ends", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addWall([0, 0, 0], [4, 0, 0], { thickness: 0.2, joinEnd: "SQUARE" });
    project.addWall([4, 0, 0], [4, 3, 0], { thickness: 0.2 });
    expect(wallJoins(project.walls)).toHaveLength(0);
  });
});

describe("wallPieces", () => {
  it("keeps a wall without openings as one full-height footprint piece", () => {
    const project = projectWithWalls([[[0, 0, 0], [8, 0, 0]]]);
    const pieces = wallPieces(project.walls[0], project.walls);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].zBottom).toBe(0);
    expect(pieces[0].zTop).toBeCloseTo(3);
    expect(pieces[0].corners).toHaveLength(4);
  });

  it("splits around a door into two segments and a lintel", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0], { height: 3 });
    project.addOpening(wall.id, "DOOR", 4, { width: 1, height: 2.1 });
    const pieces = wallPieces(wall, project.walls);
    expect(pieces).toHaveLength(3);
    const lintel = pieces.find((piece) => piece.zBottom > 0)!;
    expect(lintel.zBottom).toBeCloseTo(2.1);
    expect(lintel.zTop).toBeCloseTo(3);
    expectPoint(lintel.corners[0], [3.5, 0.1]);
    expectPoint(lintel.corners[1], [4.5, 0.1]);
  });

  it("adds a sill piece below a window", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0], { height: 3 });
    project.addOpening(wall.id, "WINDOW", 4, { width: 1.2, height: 1.2, sillHeight: 0.9 });
    const pieces = wallPieces(wall, project.walls);
    expect(pieces).toHaveLength(4);
    const sill = pieces.find((piece) => piece.zBottom === 0 && piece.zTop < 3)!;
    expect(sill.zTop).toBeCloseTo(0.9);
    const lintel = pieces.find((piece) => piece.zBottom > 1)!;
    expect(lintel.zBottom).toBeCloseTo(2.1);
  });

  it("preserves mitered end corners in the end segments", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wallA = project.addWall([0, 0, 0], [4, 0, 0]);
    project.addWall([4, 0, 0], [4, 3, 0]);
    project.addOpening(wallA.id, "DOOR", 2, { width: 1 });
    const pieces = wallPieces(wallA, project.walls);
    const endSegment = pieces.find(
      (piece) => piece.zBottom === 0 && piece.corners.some(([x]) => x > 3.6),
    )!;
    expectPoint(endSegment.corners[1], [3.9, 0.1]);
    expectPoint(endSegment.corners[2], [4.1, -0.1]);
  });
});

describe("openingFootprint", () => {
  it("spans the opening width across the wall thickness", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const wall = project.addWall([0, 0, 0], [8, 0, 0], { thickness: 0.2 });
    const door = project.addOpening(wall.id, "DOOR", 4, { width: 1 });
    const corners = openingFootprint(wall, door);
    expectPoint(corners[0], [3.5, 0.1]);
    expectPoint(corners[1], [4.5, 0.1]);
    expectPoint(corners[2], [4.5, -0.1]);
    expectPoint(corners[3], [3.5, -0.1]);
  });
});
