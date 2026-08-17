// Giao tam giác Möller + giao phần tử — pass 2 loại false positive của AABB.

import { describe, expect, it } from "vitest";
import {
  elementsIntersect,
  trianglesIntersect,
  type ClashMesh,
} from "../src/application/meshClash";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Hộp đơn vị tại (x,y,z) kích thước s — 12 tam giác. */
function box(x: number, y: number, z: number, s = 1): ClashMesh {
  const p = [
    [0,0,0],[s,0,0],[s,s,0],[0,s,0],
    [0,0,s],[s,0,s],[s,s,s],[0,s,s],
  ].map(([a,b,c]) => [a + x, b + y, c + z]);
  const positions = new Float32Array(p.flat());
  const quads = [
    [0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[0,3,7,4],[1,2,6,5],
  ];
  const indices = new Uint32Array(quads.flatMap(([a,b,c,d]) => [a,b,c, a,c,d]));
  return { positions, indices, matrix: IDENTITY };
}

describe("trianglesIntersect (Möller)", () => {
  it("hai tam giác đâm xuyên nhau → true; tách rời → false", () => {
    const a: [[number,number,number],[number,number,number],[number,number,number]] =
      [[0,0,0],[2,0,0],[0,2,0]];
    const pierce: typeof a = [[0.5,0.5,-1],[0.5,0.5,1],[1.5,0.5,0.5]];
    expect(trianglesIntersect(a, pierce)).toBe(true);
    const far: typeof a = [[10,10,10],[12,10,10],[10,12,10]];
    expect(trianglesIntersect(a, far)).toBe(false);
  });

  it("hai tam giác song song cách nhau → false (dù AABB chồng)", () => {
    const a: [[number,number,number],[number,number,number],[number,number,number]] =
      [[0,0,0],[2,0,0],[0,2,0]];
    const above: typeof a = [[0,0,0.5],[2,0,0.5],[0,2,0.5]];
    expect(trianglesIntersect(a, above)).toBe(false);
  });
});

describe("elementsIntersect — chính là ca false positive AABB", () => {
  it("hai hộp chồng lấn thật → true", () => {
    expect(elementsIntersect([box(0, 0, 0)], [box(0.5, 0.5, 0.5)])).toBe(true);
  });

  it("hai hộp CHÉO GÓC: AABB tổng chồng nhau nhưng mesh không chạm → false", () => {
    // Hộp nhỏ ở góc (0,0,0) và hộp nhỏ ở góc (1.2, 1.2, 1.2): AABB hợp
    // [0..2.2] chồng phần giữa nhưng hai khối cách nhau 0.2 theo chéo.
    expect(elementsIntersect([box(0, 0, 0)], [box(1.2, 1.2, 1.2)])).toBe(false);
  });

  it("chạm mặt (đồng phẳng) giữ dương tính — không lặng lẽ bỏ", () => {
    expect(elementsIntersect([box(0, 0, 0)], [box(1, 0, 0)])).toBe(true);
  });
});
