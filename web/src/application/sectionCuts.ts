// Section-cut geometry: where walls and slabs cross the section plane,
// their cut faces are shown hatched (45-degree lines at paper spacing).
//
// The section camera looks along +X, so the cut plane is X = planeCoord
// and cut rectangles live in (y, z) — `u` below is the world Y.

import type { SlabDatum, WallDatum } from "../domain/project";
import { wallPieces, type Point2 } from "./wallGeometry";

export interface CutRect {
  u0: number;
  u1: number;
  z0: number;
  z1: number;
}

/**
 * Sorted crossing pairs of a polygon with the line axisCoord = planeCoord:
 * intervals of the other coordinate where the polygon spans the plane.
 */
export function polygonPlaneIntervals(
  outline: readonly Point2[],
  planeCoord: number,
): [number, number][] {
  const crossings: number[] = [];
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const a = outline[j][0] - planeCoord;
    const b = outline[i][0] - planeCoord;
    if ((a < 0 && b >= 0) || (b < 0 && a >= 0)) {
      if (a === b) continue;
      const t = a / (a - b);
      crossings.push(outline[j][1] + t * (outline[i][1] - outline[j][1]));
    }
  }
  crossings.sort((first, second) => first - second);
  const intervals: [number, number][] = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    if (crossings[i + 1] > crossings[i]) {
      intervals.push([crossings[i], crossings[i + 1]]);
    }
  }
  return intervals;
}

/** Cut rectangles of a wall crossed by the section plane X = planeCoord. */
export function wallSectionCuts(
  wall: WallDatum,
  walls: readonly WallDatum[],
  planeCoord = 0,
): CutRect[] {
  const rects: CutRect[] = [];
  for (const piece of wallPieces(wall, walls)) {
    for (const [u0, u1] of polygonPlaneIntervals(piece.corners, planeCoord)) {
      rects.push({
        u0,
        u1,
        z0: wall.start[2] + piece.zBottom,
        z1: wall.start[2] + piece.zTop,
      });
    }
  }
  return rects;
}

/** Cut rectangles of a slab crossed by the section plane X = planeCoord. */
export function slabSectionCuts(
  slab: SlabDatum,
  topZ: number,
  planeCoord = 0,
): CutRect[] {
  return polygonPlaneIntervals(slab.outline, planeCoord).map(([u0, u1]) => ({
    u0,
    u1,
    z0: topZ - slab.thickness,
    z1: topZ,
  }));
}

/**
 * 45-degree hatch line segments (z = u + c) clipped to the rectangle,
 * as [u0, z0, u1, z1] tuples.
 */
export function hatchSegments(
  rect: CutRect,
  spacing: number,
): [number, number, number, number][] {
  if (spacing <= 0) {
    throw new Error("Hatch spacing must be greater than zero");
  }
  const segments: [number, number, number, number][] = [];
  const cMin = rect.z0 - rect.u1;
  const cMax = rect.z1 - rect.u0;
  for (let c = Math.ceil(cMin / spacing) * spacing; c <= cMax; c += spacing) {
    const uA = Math.max(rect.u0, rect.z0 - c);
    const uB = Math.min(rect.u1, rect.z1 - c);
    if (uB > uA) {
      segments.push([uA, uA + c, uB, uB + c]);
    }
  }
  return segments;
}
