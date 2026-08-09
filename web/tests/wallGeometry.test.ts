import { describe, expect, it } from "vitest";
import { wallFootprint } from "../src/application/wallGeometry";
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
