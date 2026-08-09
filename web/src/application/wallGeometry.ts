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
//
// Per-end join types override the defaults: SQUARE disallows the join,
// BUTT at a corner lets the wall listed first in the project run through
// to the far face while the other butts against its near face.

import type { OpeningDatum, Point3D, WallDatum, WallJoinType } from "../domain/project";

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

function joinTypeAt(wall: WallDatum, endpoint: "start" | "end"): WallJoinType {
  return (endpoint === "start" ? wall.joinStart : wall.joinEnd) ?? "MITER";
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

/** Unit axis direction and left normal of a wall's plan axis. */
function axisFrame(wall: WallDatum): { dir: Point2; normal: Point2; length: number } | null {
  const ax = wall.end[0] - wall.start[0];
  const ay = wall.end[1] - wall.start[1];
  const length = Math.hypot(ax, ay);
  if (length === 0) return null;
  const dir: Point2 = [ax / length, ay / length];
  return { dir, normal: [-dir[1], dir[0]], length };
}

/**
 * Offset face line of a wall: its axis shifted by signedHalf along the
 * axis normal.
 */
function faceLine(wall: WallDatum, signedHalf: number): Line2 | null {
  const frame = axisFrame(wall);
  if (!frame) return null;
  return {
    point: [
      wall.start[0] + frame.normal[0] * signedHalf,
      wall.start[1] + frame.normal[1] * signedHalf,
    ],
    dir: frame.dir,
  };
}

/** Cut a wall end square against a face line, honouring the miter limit. */
function cutEndAtFace(
  wall: WallDatum,
  endpoint: "start" | "end",
  face: Line2,
  otherThickness: number,
): [Point2, Point2] | null {
  const own = sideLines(wall, endpoint);
  const cornerLeft = intersectLines(own.left, face);
  const cornerRight = intersectLines(own.right, face);
  if (!cornerLeft || !cornerRight) return null;
  const joint = wall[endpoint];
  const limit = MITER_LIMIT_FACTOR * Math.max(wall.thickness, otherThickness);
  const reach = Math.max(
    Math.hypot(cornerLeft[0] - joint[0], cornerLeft[1] - joint[1]),
    Math.hypot(cornerRight[0] - joint[0], cornerRight[1] - joint[1]),
  );
  if (reach > limit) return null;
  return [cornerLeft, cornerRight];
}

/**
 * The continuous wall whose axis segment passes under this endpoint —
 * the target of a T-join — or null.
 */
export function tJoinTarget(
  wall: WallDatum,
  endpoint: "start" | "end",
  walls: readonly WallDatum[],
): WallDatum | null {
  const joint = wall[endpoint];
  const { o } = outgoingFrame(wall, endpoint);
  let best: { wall: WallDatum; distance: number } | null = null;
  for (const candidate of walls) {
    if (candidate.id === wall.id) continue;
    const frame = axisFrame(candidate);
    if (!frame) continue;
    const half = candidate.thickness / 2;
    const relX = joint[0] - candidate.start[0];
    const relY = joint[1] - candidate.start[1];
    const along = relX * frame.dir[0] + relY * frame.dir[1];
    // Interior of the axis segment only; end vicinities belong to corner logic.
    if (along < half || along > frame.length - half) continue;
    const offset = relX * frame.normal[0] + relY * frame.normal[1];
    if (Math.abs(offset) > half + JOIN_TOLERANCE) continue;
    const side = o[0] * frame.normal[0] + o[1] * frame.normal[1];
    if (Math.abs(side) < 1e-6) continue; // parallel walls
    const distance = Math.abs(offset);
    if (!best || distance < best.distance) {
      best = { wall: candidate, distance };
    }
  }
  return best?.wall ?? null;
}

/**
 * T-join corners: the end butts against the near face of the continuous
 * wall under this endpoint. [cornerLeft, cornerRight] in the outgoing
 * frame, or null when no continuous wall qualifies.
 */
function tButtCorners(
  wall: WallDatum,
  endpoint: "start" | "end",
  walls: readonly WallDatum[],
): [Point2, Point2] | null {
  const target = tJoinTarget(wall, endpoint, walls);
  if (!target) return null;
  const frame = axisFrame(target)!;
  const { o } = outgoingFrame(wall, endpoint);
  const side = o[0] * frame.normal[0] + o[1] * frame.normal[1];
  const sign = side > 0 ? 1 : -1;
  // The face on the side of the continuous wall that this wall's body faces.
  const face = faceLine(target, sign * (target.thickness / 2))!;
  return cutEndAtFace(wall, endpoint, face, target.thickness);
}

/**
 * Butt corner: the wall listed first in the project runs through to the
 * partner's far face; the other wall butts against the through wall's
 * near face. Both ends are square cuts against a face line.
 */
function buttCornerCorners(
  wall: WallDatum,
  endpoint: "start" | "end",
  partner: WallEnd,
  walls: readonly WallDatum[],
): [Point2, Point2] | null {
  const frame = axisFrame(partner.wall);
  if (!frame) return null;
  const { o } = outgoingFrame(wall, endpoint);
  const side = o[0] * frame.normal[0] + o[1] * frame.normal[1];
  if (Math.abs(side) < 1e-6) return null; // parallel walls
  const sign = side > 0 ? 1 : -1;
  const ownIndex = walls.findIndex((candidate) => candidate.id === wall.id);
  const partnerIndex = walls.findIndex((candidate) => candidate.id === partner.wall.id);
  const runsThrough = ownIndex < partnerIndex;
  // Through wall: cut at the partner face AWAY from its own body (far face).
  // Butting wall: cut at the partner face TOWARD its body (near face).
  const faceSign = runsThrough ? -sign : sign;
  const face = faceLine(partner.wall, faceSign * (partner.wall.thickness / 2))!;
  return cutEndAtFace(wall, endpoint, face, partner.wall.thickness);
}

/** Join corners for one wall end: corner miter/butt, T-butt, or null (square). */
function endJoinCorners(
  wall: WallDatum,
  endpoint: "start" | "end",
  walls: readonly WallDatum[],
): [Point2, Point2] | null {
  const ownType = joinTypeAt(wall, endpoint);
  if (ownType === "SQUARE") return null;
  const partners = endPartners(wall, endpoint, walls);
  if (partners.length === 1) {
    const partner = partners[0];
    const otherType = joinTypeAt(partner.wall, partner.endpoint);
    if (otherType === "SQUARE") return null;
    if (ownType === "BUTT" || otherType === "BUTT") {
      return buttCornerCorners(wall, endpoint, partner, walls);
    }
    return miterCorners(wall, endpoint, partner);
  }
  if (partners.length > 1) {
    return null;
  }
  return tButtCorners(wall, endpoint, walls);
}

export type WallConnectionType = "ATSTART" | "ATEND" | "ATPATH";

export interface WallJoin {
  relating: { id: string; connection: WallConnectionType };
  related: { id: string; connection: WallConnectionType };
}

const AT: Record<"start" | "end", WallConnectionType> = {
  start: "ATSTART",
  end: "ATEND",
};

/**
 * All wall-to-wall connections in the project: coincident-end pairs
 * (deduplicated) and T-joins (terminating end against ATPATH). Ends set
 * to SQUARE produce no connection.
 */
export function wallJoins(walls: readonly WallDatum[]): WallJoin[] {
  const joins: WallJoin[] = [];
  const seen = new Set<string>();
  for (const wall of walls) {
    for (const endpoint of ["start", "end"] as const) {
      if (joinTypeAt(wall, endpoint) === "SQUARE") continue;
      const partners = endPartners(wall, endpoint, walls);
      if (partners.length > 0) {
        for (const partner of partners) {
          if (joinTypeAt(partner.wall, partner.endpoint) === "SQUARE") continue;
          const key = [
            `${wall.id}:${endpoint}`,
            `${partner.wall.id}:${partner.endpoint}`,
          ]
            .sort()
            .join("|");
          if (seen.has(key)) continue;
          seen.add(key);
          joins.push({
            relating: { id: wall.id, connection: AT[endpoint] },
            related: { id: partner.wall.id, connection: AT[partner.endpoint] },
          });
        }
      } else {
        const target = tJoinTarget(wall, endpoint, walls);
        if (target) {
          joins.push({
            relating: { id: wall.id, connection: AT[endpoint] },
            related: { id: target.id, connection: "ATPATH" },
          });
        }
      }
    }
  }
  return joins;
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

/** One solid fragment of a wall: a plan polygon spanning [zBottom, zTop]. */
export interface WallPiece {
  corners: Point2[];
  zBottom: number;
  zTop: number;
}

/**
 * Decompose a wall into extrudable pieces around its openings: full-height
 * segments between openings (keeping mitered end corners), plus lintels
 * above and sills below each opening. Without openings this is exactly the
 * footprint at full height.
 */
export function wallPieces(wall: WallDatum, walls: readonly WallDatum[]): WallPiece[] {
  const footprint = wallFootprint(wall, walls);
  const frame = axisFrame(wall);
  if (!frame) return [];
  const half = wall.thickness / 2;
  const cutPair = (t: number): [Point2, Point2] => [
    [
      wall.start[0] + frame.dir[0] * t + frame.normal[0] * half,
      wall.start[1] + frame.dir[1] * t + frame.normal[1] * half,
    ],
    [
      wall.start[0] + frame.dir[0] * t - frame.normal[0] * half,
      wall.start[1] + frame.dir[1] * t - frame.normal[1] * half,
    ],
  ];
  // Left/right corner pair at an axis parameter, honouring joined ends.
  const pairAt = (t: number): [Point2, Point2] => {
    if (t <= 0) return [footprint[0], footprint[3]];
    if (t >= frame.length) return [footprint[1], footprint[2]];
    return cutPair(t);
  };
  const polygon = (a: number, b: number): Point2[] => {
    const [aLeft, aRight] = pairAt(a);
    const [bLeft, bRight] = pairAt(b);
    return [aLeft, bLeft, bRight, aRight];
  };

  const openings = wall.openings
    .map((opening) => ({
      opening,
      from: Math.max(0, opening.offset - opening.width / 2),
      to: Math.min(frame.length, opening.offset + opening.width / 2),
    }))
    .filter(({ from, to }) => to > from)
    .sort((first, second) => first.from - second.from);

  const pieces: WallPiece[] = [];
  let cursor = 0;
  for (const { opening, from, to } of openings) {
    if (from > cursor) {
      pieces.push({ corners: polygon(cursor, from), zBottom: 0, zTop: wall.height });
    }
    if (opening.sillHeight > 0) {
      pieces.push({ corners: polygon(from, to), zBottom: 0, zTop: opening.sillHeight });
    }
    const head = opening.sillHeight + opening.height;
    if (head < wall.height) {
      pieces.push({ corners: polygon(from, to), zBottom: head, zTop: wall.height });
    }
    cursor = Math.max(cursor, to);
  }
  if (cursor < frame.length) {
    pieces.push({ corners: polygon(cursor, frame.length), zBottom: 0, zTop: wall.height });
  }
  return pieces;
}

/** Plan rectangle of an opening (world XY), for markers and IFC voids. */
export function openingFootprint(wall: WallDatum, opening: OpeningDatum): Point2[] {
  const frame = axisFrame(wall);
  if (!frame) return [];
  const half = wall.thickness / 2;
  const from = opening.offset - opening.width / 2;
  const to = opening.offset + opening.width / 2;
  const corner = (t: number, side: number): Point2 => [
    wall.start[0] + frame.dir[0] * t + frame.normal[0] * half * side,
    wall.start[1] + frame.dir[1] * t + frame.normal[1] * half * side,
  ];
  return [corner(from, 1), corner(to, 1), corner(to, -1), corner(from, -1)];
}

/** Plan-symbol geometry for a door: hinge point, open leaf, quarter arc. */
export interface DoorSwing {
  hinge: Point2;
  leafEnd: Point2;
  arc: Point2[];
}

/**
 * Door swing in plan: the hinge sits on the swing-side wall face at the
 * hinge jamb; the leaf is drawn fully open (perpendicular to the wall)
 * and a quarter arc runs from the closed position at the opposite jamb
 * to the leaf end.
 */
export function doorSwing(
  wall: WallDatum,
  opening: OpeningDatum,
  segments = 12,
): DoorSwing | null {
  if (opening.kind !== "DOOR") return null;
  const frame = axisFrame(wall);
  if (!frame) return null;
  const half = wall.thickness / 2;
  const hingeSign = opening.hingeEnd === "START" ? -1 : 1;
  const sideSign = opening.swingSide === "LEFT" ? 1 : -1;
  const hingeT = opening.offset + (hingeSign * opening.width) / 2;
  const hinge: Point2 = [
    wall.start[0] + frame.dir[0] * hingeT + frame.normal[0] * half * sideSign,
    wall.start[1] + frame.dir[1] * hingeT + frame.normal[1] * half * sideSign,
  ];
  // Unit vectors from the hinge: closed leaf (toward the other jamb) and
  // fully open leaf (out of the wall on the swing side).
  const closed: Point2 = [-hingeSign * frame.dir[0], -hingeSign * frame.dir[1]];
  const open: Point2 = [frame.normal[0] * sideSign, frame.normal[1] * sideSign];
  const leafEnd: Point2 = [
    hinge[0] + open[0] * opening.width,
    hinge[1] + open[1] * opening.width,
  ];
  const arc: Point2[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (Math.PI / 2) * (i / segments);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    arc.push([
      hinge[0] + (closed[0] * cos + open[0] * sin) * opening.width,
      hinge[1] + (closed[1] * cos + open[1] * sin) * opening.width,
    ]);
  }
  return { hinge, leafEnd, arc };
}
