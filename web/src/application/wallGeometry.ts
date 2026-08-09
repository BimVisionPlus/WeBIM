// Plan-space wall footprints with mitered corner joins.
//
// A wall's footprint is the rectangle around its axis. When exactly two
// wall ends meet at a point, both footprints are mitered: each side face
// is extended to its intersection with the matching side face of the
// other wall, so the pair shares the two miter corners and the seam runs
// between them. Collinear continuations, T/X joints (3+ ends) and
// too-sharp angles (miter limit) keep square butt ends.

import type { Point3D, WallDatum } from "../domain/project";

export type Point2 = [number, number];

const JOIN_TOLERANCE = 1e-4;
const PARALLEL_EPS = 1e-9;
const MITER_LIMIT_FACTOR = 4;

interface Line2 {
  point: Point2;
  dir: Point2;
}

interface WallEnd {
  wall: WallDatum;
  endpoint: "start" | "end";
}

function samePoint(a: Point3D, b: Point3D): boolean {
  return (
    Math.abs(a[0] - b[0]) <= JOIN_TOLERANCE &&
    Math.abs(a[1] - b[1]) <= JOIN_TOLERANCE &&
    Math.abs(a[2] - b[2]) <= JOIN_TOLERANCE
  );
}

function intersectLines(first: Line2, second: Line2): Point2 | null {
  const cross = first.dir[0] * second.dir[1] - first.dir[1] * second.dir[0];
  if (Math.abs(cross) < PARALLEL_EPS) {
    return null;
  }
  const dx = second.point[0] - first.point[0];
  const dy = second.point[1] - first.point[1];
  const t = (dx * second.dir[1] - dy * second.dir[0]) / cross;
  return [first.point[0] + t * first.dir[0], first.point[1] + t * first.dir[1]];
}

/** Direction from the given endpoint into the wall body, and its left normal. */
function outgoingFrame(wall: WallDatum, endpoint: "start" | "end"): { o: Point2; nl: Point2 } {
  const sign = endpoint === "start" ? 1 : -1;
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy);
  const o: Point2 = [(sign * dx) / length, (sign * dy) / length];
  return { o, nl: [-o[1], o[0]] };
}

function sideLines(wall: WallDatum, endpoint: "start" | "end"): { left: Line2; right: Line2 } {
  const joint = wall[endpoint];
  const { o, nl } = outgoingFrame(wall, endpoint);
  const half = wall.thickness / 2;
  return {
    left: { point: [joint[0] + nl[0] * half, joint[1] + nl[1] * half], dir: o },
    right: { point: [joint[0] - nl[0] * half, joint[1] - nl[1] * half], dir: o },
  };
}

/** The single other wall end meeting this one, or null for 0 or 2+ others. */
function joinPartner(wall: WallDatum, endpoint: "start" | "end", walls: readonly WallDatum[]): WallEnd | null {
  const joint = wall[endpoint];
  const others: WallEnd[] = [];
  for (const candidate of walls) {
    if (candidate.id === wall.id) continue;
    for (const candidateEnd of ["start", "end"] as const) {
      if (samePoint(candidate[candidateEnd], joint)) {
        others.push({ wall: candidate, endpoint: candidateEnd });
      }
    }
  }
  return others.length === 1 ? others[0] : null;
}

/**
 * Miter corners at one wall end, in the outgoing frame:
 * [cornerLeft, cornerRight], or null when the end stays square.
 */
function miterCorners(
  wall: WallDatum,
  endpoint: "start" | "end",
  walls: readonly WallDatum[],
): [Point2, Point2] | null {
  const partner = joinPartner(wall, endpoint, walls);
  if (!partner) return null;
  const own = sideLines(wall, endpoint);
  const other = sideLines(partner.wall, partner.endpoint);
  const cornerLeft = intersectLines(own.left, other.right);
  const cornerRight = intersectLines(own.right, other.left);
  if (!cornerLeft || !cornerRight) return null;
  const joint = wall[endpoint];
  const limit = MITER_LIMIT_FACTOR * Math.max(wall.thickness, partner.wall.thickness);
  const reach = Math.max(
    Math.hypot(cornerLeft[0] - joint[0], cornerLeft[1] - joint[1]),
    Math.hypot(cornerRight[0] - joint[0], cornerRight[1] - joint[1]),
  );
  if (reach > limit) return null;
  return [cornerLeft, cornerRight];
}

/**
 * Plan footprint of a wall as [startLeft, endLeft, endRight, startRight],
 * left/right relative to the start→end direction.
 */
export function wallFootprint(wall: WallDatum, walls: readonly WallDatum[]): Point2[] {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy);
  const n: Point2 = [-dy / length, dx / length];
  const half = wall.thickness / 2;
  let startLeft: Point2 = [wall.start[0] + n[0] * half, wall.start[1] + n[1] * half];
  let startRight: Point2 = [wall.start[0] - n[0] * half, wall.start[1] - n[1] * half];
  let endLeft: Point2 = [wall.end[0] + n[0] * half, wall.end[1] + n[1] * half];
  let endRight: Point2 = [wall.end[0] - n[0] * half, wall.end[1] - n[1] * half];

  const startMiter = miterCorners(wall, "start", walls);
  if (startMiter) {
    // Outgoing dir at the start is start→end, so outgoing-left is footprint-left.
    [startLeft, startRight] = startMiter;
  }
  const endMiter = miterCorners(wall, "end", walls);
  if (endMiter) {
    // Outgoing dir at the end is reversed, so outgoing-left is footprint-right.
    [endRight, endLeft] = endMiter;
  }
  return [startLeft, endLeft, endRight, startRight];
}
