// Port of webim/application/grid_snapping.py.

import type { Point3D } from "../domain/project";

export type SnapKind = "ENDPOINT" | "AXIS_X" | "AXIS_Y" | "INCREMENT";

export interface SnapResult {
  point: Point3D;
  kind: SnapKind;
}

export function snapGridPoint(
  raw: Point3D,
  options: {
    start?: Point3D | null;
    endpoint?: Point3D | null;
    increment?: number;
    axisAngleDegrees?: number;
  } = {},
): SnapResult {
  const { start = null, endpoint = null, increment = 0.1, axisAngleDegrees = 5.0 } = options;
  if (endpoint !== null) {
    return { point: endpoint, kind: "ENDPOINT" };
  }
  if (increment <= 0) {
    throw new Error("Snap increment must be greater than zero");
  }
  const roundTo = (value: number) =>
    Number((Math.round(value / increment) * increment).toFixed(10));
  const incrementPoint: Point3D = [roundTo(raw[0]), roundTo(raw[1]), raw[2]];
  if (start !== null) {
    const dx = raw[0] - start[0];
    const dy = raw[1] - start[1];
    const angle = Math.atan2(Math.abs(dy), Math.abs(dx));
    const tolerance = (axisAngleDegrees * Math.PI) / 180;
    if (angle <= tolerance) {
      return { point: [incrementPoint[0], start[1], raw[2]], kind: "AXIS_X" };
    }
    if (Math.abs(Math.PI / 2 - angle) <= tolerance) {
      return { point: [start[0], incrementPoint[1], raw[2]], kind: "AXIS_Y" };
    }
  }
  return { point: incrementPoint, kind: "INCREMENT" };
}
