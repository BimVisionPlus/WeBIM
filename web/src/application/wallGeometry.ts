// Plan-space wall footprints with mitered corner joins and T-joins.
//
// A wall's footprint is the rectangle around its axis. When exactly two
// wall ends meet at a point, both footprints are mitered: each side face
// is extended to its intersection with the matching side face of the
// other wall, so the pair shares the two miter corners and the seam runs
// between them. Collinear continuations, star joints (3+ ends) and
// too-sharp angles (miter limit) keep square butt ends.
//
// A wall end with no coincident end that lands on another wall's axis
// segment is a T-join: its end face is trimmed (or extended) to butt
// against the near face of the continuous wall, which stays unbroken.

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

/** Every other wall end coinciding with this one. */
function endPartners(
  wall: WallDatum,
  endpoint: "start" | "end",
  walls: readonly WallDatum[],
): WallEnd[] {
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
  return others;
}

/**
 * Miter corners against the single coincident wall end, in the outgoing
 * frame: [cornerLeft, cornerRight], or null when the end stays square.
 */
function miterCorners(
  wall: WallDatum,
  endpoint: "start" | "end",
  partner: WallEnd,
): [Point2, Point2] | null {
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
 * T-join corners: the end butts against the near face of a wall whose axis
 * segment passes under this endpoint. [cornerLeft, cornerRight] in the
 * outgoing frame, or null when no continuous wall qualifies.
 */
function tButtCorners(
  wall: WallDatum,
  endpoint: "start" | "end",
  walls: readonly WallDatum[],
): [Point2, Point2] | null {
  const joint = wall[endpoint];
  const { o } = outgoingFrame(wall, endpoint);

  let best: { face: Line2; distance: number; thickness: number } | null = null;
  for (const candidate of walls) {
    if (candidate.id === wall.id) continue;
    const ax = candidate.end[0] - candidate.start[0];
    const ay = candidate.end[1] - candidate.start[1];
    const axisLength = Math.hypot(ax, ay);
    if (axisLength === 0) continue;
    const dir: Point2 = [ax / axisLength, ay / axisLength];
    const normal: Point2 = [-dir[1], dir[0]];
    const half = candidate.thickness / 2;
    const relX = joint[0] - candidate.start[0];
    const relY = joint[1] - candidate.start[1];
    const along = relX * dir[0] + relY * dir[1];
    // Interior of the axis segment only; end vicinities belong to corner logic.
    if (along < half || along > axisLength - half) continue;
    const offset = relX * normal[0] + relY * normal[1];
    if (Math.abs(offset) > half + JOIN_TOLERANCE) continue;
    // The face on the side of the continuous wall that this wall's body faces.
    const side = o[0] * normal[0] + o[1] * normal[1];
    if (Math.abs(side) < 1e-6) continue; // parallel walls
    const sign = side > 0 ? 1 : -1;
    const face: Line2 = {
      point: [
        candidate.start[0] + normal[0] * sign * half,
        candidate.start[1] + normal[1] * sign * half,
      ],
      dir,
    };
    const distance = Math.abs(offset);
    if (!best || distance < best.distance) {
      best = { face, distance, thickness: candidate.thickness };
    }
  }
  if (!best) return null;

  const own = sideLines(wall, endpoint);
  const cornerLeft = intersectLines(own.left, best.face);
  const cornerRight = intersectLines(own.right, best.face);
  if (!cornerLeft || !cornerRight) return null;
  const limit = MITER_LIMIT_FACTOR * Math.max(wall.thickness, best.thickness);
  const reach = Math.max(
    Math.hypot(cornerLeft[0] - joint[0], cornerLeft[1] - joint[1]),
    Math.hypot(cornerRight[0] - joint[0], cornerRight[1] - joint[1]),
  );
  if (reach > limit) return null;
  return [cornerLeft, cornerRight];
}

/** Join corners for one wall end: corner miter, T-butt, or null (square). */
function endJoinCorners(
  wall: WallDatum,
  endpoint: "start" | "end",
  walls: readonly WallDatum[],
): [Point2, Point2] | null {
  const partners = endPartners(wall, endpoint, walls);
  if (partners.length === 1) {
    return miterCorners(wall, endpoint, partners[0]);
  }
  if (partners.length > 1) {
    return null;
  }
  return tButtCorners(wall, endpoint, walls);
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

  const startJoin = endJoinCorners(wall, "start", walls);
  if (startJoin) {
    // Outgoing dir at the start is start→end, so outgoing-left is footprint-left.
    [startLeft, startRight] = startJoin;
  }
  const endJoin = endJoinCorners(wall, "end", walls);
  if (endJoin) {
    // Outgoing dir at the end is reversed, so outgoing-left is footprint-right.
    [endRight, endLeft] = endJoin;
  }
  return [startLeft, endLeft, endRight, startRight];
}
