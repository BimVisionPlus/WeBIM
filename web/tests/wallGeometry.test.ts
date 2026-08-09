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
