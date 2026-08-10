// Linear dimension geometry: dimension line parallel to A-B at a signed
// perpendicular offset, extension lines from the measured points with a
// small overshoot, 45-degree tick slashes, and the text anchor.

import type { DimensionDatum } from "../domain/project";

export type P2 = [number, number];

export interface DimensionGeometry {
  /** Dimension line endpoints (A and B projected onto the offset line). */
  line: [P2, P2];
  /** Extension lines from each measured point past the dimension line. */
  extensions: [P2, P2][];
  /** 45-degree tick slashes at both ends. */
  ticks: [P2, P2][];
  /** Text anchor: middle of the dimension line, nudged to the offset side. */
  textPosition: P2;
  /** Measured length in metres. */
  value: number;
}

export function dimensionGeometry(
  dimension: Pick<DimensionDatum, "start" | "end" | "offset">,
  overshoot = 0.15,
  tickSize = 0.12,
): DimensionGeometry {
  const [ax, ay] = dimension.start;
  const [bx, by] = dimension.end;
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    throw new Error("A dimension needs two different points");
  }
  const ux = dx / length;
  const uy = dy / length;
  const nx = -uy;
  const ny = ux;
  const o = dimension.offset;
  const lineA: P2 = [ax + nx * o, ay + ny * o];
  const lineB: P2 = [bx + nx * o, by + ny * o];
  const sign = o >= 0 ? 1 : -1;
  const extEndA: P2 = [
    lineA[0] + nx * sign * overshoot,
    lineA[1] + ny * sign * overshoot,
  ];
  const extEndB: P2 = [
    lineB[0] + nx * sign * overshoot,
    lineB[1] + ny * sign * overshoot,
  ];
  // Tick slash: 45 degrees across the dimension line at each end.
  const tick = (p: P2): [P2, P2] => [
    [p[0] - (ux + nx) * (tickSize / 2), p[1] - (uy + ny) * (tickSize / 2)],
    [p[0] + (ux + nx) * (tickSize / 2), p[1] + (uy + ny) * (tickSize / 2)],
  ];
  return {
    line: [lineA, lineB],
    extensions: [
      [[ax, ay], extEndA],
      [[bx, by], extEndB],
    ],
    ticks: [tick(lineA), tick(lineB)],
    textPosition: [
      (lineA[0] + lineB[0]) / 2 + nx * sign * 0.25,
      (lineA[1] + lineB[1]) / 2 + ny * sign * 0.25,
    ],
    value: length,
  };
}

/** Distance from a point to the dimension line segment, for picking. */
export function distanceToDimension(
  dimension: Pick<DimensionDatum, "start" | "end" | "offset">,
  point: P2,
): number {
  const { line } = dimensionGeometry(dimension);
  const [a, b] = line;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  let t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}
