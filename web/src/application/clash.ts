// Clash detection on the native model (plan footprints + z ranges).
//
// Two elements clash when their vertical ranges overlap AND their plan
// footprints overlap by more than a tolerance. Wall pairs that share a
// legitimate join (coincident ends or a T-join) are excluded — joined
// geometry intentionally touches. Everything runs on convex footprint
// polygons via the separating axis test, so it is exact for the shapes
// the authoring tools produce.

import type { NativeBimProject, SlabDatum, WallDatum } from "../domain/project";
import type { LinkedElement } from "../ifc/parseIfc";
import { tJoinTarget, wallFootprint, type Point2 } from "./wallGeometry";

export interface ClashItem {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  kind: "WALL_WALL" | "WALL_SLAB" | "SLAB_SLAB" | "NATIVE_IFC";
  /** Penetration depth estimate in metres (minimum separating overlap). */
  depth: number;
}

const TOUCH_TOLERANCE = 1e-3;

/**
 * Separating-axis overlap of two convex polygons: returns the minimum
 * overlap depth, or 0 when separated (touching counts as separated
 * within tolerance).
 */
export function convexOverlapDepth(
  a: readonly Point2[],
  b: readonly Point2[],
): number {
  let minOverlap = Infinity;
  for (const polygon of [a, b]) {
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const edgeX = polygon[i][0] - polygon[j][0];
      const edgeY = polygon[i][1] - polygon[j][1];
      const length = Math.hypot(edgeX, edgeY);
      if (length === 0) continue;
      const axisX = -edgeY / length;
      const axisY = edgeX / length;
      let aMin = Infinity;
      let aMax = -Infinity;
      for (const [x, y] of a) {
        const p = x * axisX + y * axisY;
        aMin = Math.min(aMin, p);
        aMax = Math.max(aMax, p);
      }
      let bMin = Infinity;
      let bMax = -Infinity;
      for (const [x, y] of b) {
        const p = x * axisX + y * axisY;
        bMin = Math.min(bMin, p);
        bMax = Math.max(bMax, p);
      }
      const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
      if (overlap <= TOUCH_TOLERANCE) return 0;
      minOverlap = Math.min(minOverlap, overlap);
    }
  }
  return Number.isFinite(minOverlap) ? minOverlap : 0;
}

function zRange(project: NativeBimProject, element: WallDatum | SlabDatum): [number, number] {
  if ("height" in element && "start" in element) {
    return [element.start[2], element.start[2] + element.height];
  }
  const slab = element as SlabDatum;
  const top = project.slabTopZ(slab);
  return [top - slab.thickness, top];
}

function zOverlap(a: [number, number], b: [number, number]): boolean {
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > TOUCH_TOLERANCE;
}

/** Wall pairs that intentionally touch through joins are not clashes. */
function wallsAreJoined(a: WallDatum, b: WallDatum, walls: readonly WallDatum[]): boolean {
  for (const endA of ["start", "end"] as const) {
    for (const endB of ["start", "end"] as const) {
      const pa = a[endA];
      const pb = b[endB];
      if (
        Math.abs(pa[0] - pb[0]) <= 1e-4 &&
        Math.abs(pa[1] - pb[1]) <= 1e-4 &&
        Math.abs(pa[2] - pb[2]) <= 1e-4
      ) {
        return true;
      }
    }
  }
  for (const end of ["start", "end"] as const) {
    if (tJoinTarget(a, end, walls)?.id === b.id) return true;
    if (tJoinTarget(b, end, walls)?.id === a.id) return true;
  }
  return false;
}

/** All hard clashes in the project. Wall/slab contacts at slab faces are
 * expected construction (slabs bear on walls), so wall-slab pairs only
 * report when the slab cuts INTO the wall's z range by more than its
 * bearing tolerance (default: report all overlaps deeper than 1 cm). */
export function clashReport(project: NativeBimProject): ClashItem[] {
  const clashes: ClashItem[] = [];
  const walls = project.walls;

  for (let i = 0; i < walls.length; i += 1) {
    for (let j = i + 1; j < walls.length; j += 1) {
      const a = walls[i];
      const b = walls[j];
      if (!zOverlap(zRange(project, a), zRange(project, b))) continue;
      if (wallsAreJoined(a, b, walls)) continue;
      const depth = convexOverlapDepth(
        wallFootprint(a, walls),
        wallFootprint(b, walls),
      );
      if (depth > TOUCH_TOLERANCE) {
        clashes.push({
          aId: a.id,
          aName: a.name,
          bId: b.id,
          bName: b.name,
          kind: "WALL_WALL",
          depth,
        });
      }
    }
  }

  for (const wall of walls) {
    for (const slab of project.slabs) {
      const wallZ = zRange(project, wall);
      const slabZ = zRange(project, slab);
      const penetration = Math.min(wallZ[1], slabZ[1]) - Math.max(wallZ[0], slabZ[0]);
      if (penetration <= 0.01) continue;
      const depth = convexOverlapDepth(
        wallFootprint(wall, walls),
        slab.outline,
      );
      if (depth > TOUCH_TOLERANCE) {
        clashes.push({
          aId: wall.id,
          aName: wall.name,
          bId: slab.id,
          bName: slab.name,
          kind: "WALL_SLAB",
          depth: Math.min(depth, penetration),
        });
      }
    }
  }

  for (let i = 0; i < project.slabs.length; i += 1) {
    for (let j = i + 1; j < project.slabs.length; j += 1) {
      const a = project.slabs[i];
      const b = project.slabs[j];
      if (!zOverlap(zRange(project, a), zRange(project, b))) continue;
      const depth = convexOverlapDepth(a.outline, b.outline);
      if (depth > TOUCH_TOLERANCE) {
        clashes.push({
          aId: a.id,
          aName: a.name,
          bId: b.id,
          bName: b.name,
          kind: "SLAB_SLAB",
          depth,
        });
      }
    }
  }

  return clashes.sort((first, second) => second.depth - first.depth);
}

interface Aabb {
  name: string;
  min: [number, number, number];
  max: [number, number, number];
}

function nativeAabbs(project: NativeBimProject): Aabb[] {
  const boxes: Aabb[] = [];
  for (const wall of project.walls) {
    const footprint = wallFootprint(wall, project.walls);
    const xs = footprint.map((point) => point[0]);
    const ys = footprint.map((point) => point[1]);
    boxes.push({
      name: wall.name,
      min: [Math.min(...xs), Math.min(...ys), wall.start[2]],
      max: [Math.max(...xs), Math.max(...ys), wall.start[2] + wall.height],
    });
  }
  for (const slab of project.slabs) {
    const xs = slab.outline.map((point) => point[0]);
    const ys = slab.outline.map((point) => point[1]);
    const top = project.slabTopZ(slab);
    boxes.push({
      name: slab.name,
      min: [Math.min(...xs), Math.min(...ys), top - slab.thickness],
      max: [Math.max(...xs), Math.max(...ys), top],
    });
  }
  return boxes;
}

function aabbOverlapDepth(a: Aabb, b: Aabb): number {
  let depth = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    const overlap = Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
    if (overlap <= TOUCH_TOLERANCE) return 0;
    depth = Math.min(depth, overlap);
  }
  return depth;
}

/** Hard-clash screen of the native model against linked IFC elements
 * (AABB level — Navisworks-style first pass, not exact geometry). */
export function externalClashes(
  project: NativeBimProject,
  linked: readonly LinkedElement[],
): ClashItem[] {
  const clashes: ClashItem[] = [];
  const natives = nativeAabbs(project);
  for (const native of natives) {
    for (const element of linked) {
      const depth = aabbOverlapDepth(native, {
        name: element.name,
        min: element.min,
        max: element.max,
      });
      if (depth > TOUCH_TOLERANCE) {
        clashes.push({
          aId: native.name,
          aName: native.name,
          bId: element.name,
          bName: `${element.name} (${element.ifcType})`,
          kind: "NATIVE_IFC",
          depth,
        });
      }
    }
  }
  return clashes.sort((first, second) => second.depth - first.depth);
}
