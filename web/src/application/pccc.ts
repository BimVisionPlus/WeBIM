// PCCC — sàng lọc thoát nạn sơ bộ.
//
// WHAT THIS IS NOT: a fire-safety calculation. It is a screen — occupancy
// load from area, straight-line distance to the nearest exit, and required
// exit width — of the kind that catches a room with one door and ninety
// people before anyone opens the code book.
//
// The limits below are DEFAULTS THAT MUST BE CHECKED against the current
// QCVN 06:2022/BXD (+ Sửa đổi 1:2023) before anybody relies on them. They are
// data, editable per project, precisely so a corrected figure does not mean a
// code change — and so nobody mistakes a number in a source file for the
// standard itself. The Standards module carries QCVN 06 with its own
// edition_verified flag, which is still false; this inherits that caveat.
//
// Travel distance here is straight-line ("cự ly trực tiếp"), not the walked
// path around furniture and partitions. Real egress distance is measured
// along the route, and is therefore never shorter than this. A room that
// fails on straight-line distance definitely fails; one that passes may still
// fail when the route is drawn. Stated in the UI, not just here.

import type { NativeBimProject, RoomDatum, RoomUsage } from "../domain/project";
import { outlineArea } from "./schedules";

export interface UsageRule {
  label: string;
  /** m² sàn cho mỗi người. */
  densityM2PerPerson: number;
  /** Cự ly thoát nạn tối đa, mét — phòng có một lối ra. */
  maxTravelSingleExitM: number;
  /** Cự ly tối đa khi có từ hai lối ra. */
  maxTravelMultiExitM: number;
}

/**
 * Placeholder values pending a công báo check. Deliberately round numbers —
 * they should look like what they are, not like precise citations.
 */
export const DEFAULT_RULES: Record<RoomUsage, UsageRule> = {
  O: { label: "Ở", densityM2PerPerson: 20, maxTravelSingleExitM: 20, maxTravelMultiExitM: 40 },
  VAN_PHONG: { label: "Văn phòng", densityM2PerPerson: 10, maxTravelSingleExitM: 20, maxTravelMultiExitM: 40 },
  HOP: { label: "Hội họp", densityM2PerPerson: 1.5, maxTravelSingleExitM: 15, maxTravelMultiExitM: 30 },
  THUONG_MAI: { label: "Thương mại", densityM2PerPerson: 3, maxTravelSingleExitM: 15, maxTravelMultiExitM: 30 },
  AN_UONG: { label: "Ăn uống", densityM2PerPerson: 1.5, maxTravelSingleExitM: 15, maxTravelMultiExitM: 30 },
  KHO: { label: "Kho", densityM2PerPerson: 50, maxTravelSingleExitM: 25, maxTravelMultiExitM: 50 },
  KY_THUAT: { label: "Kỹ thuật", densityM2PerPerson: 50, maxTravelSingleExitM: 25, maxTravelMultiExitM: 50 },
  HANH_LANG: { label: "Hành lang", densityM2PerPerson: 0, maxTravelSingleExitM: 0, maxTravelMultiExitM: 0 },
};

/** Bề rộng lối thoát: mét cho mỗi 100 người, và mức sàn tuyệt đối. */
export const WIDTH_PER_100_PEOPLE_M = 1.0;
export const MIN_EXIT_WIDTH_M = 0.8;

export interface Exit {
  openingId: string;
  name: string;
  /** Plan position of the door centre. */
  at: [number, number];
  widthM: number;
}

/** Doors on the given level, as candidate exits with their plan position. */
export function exitsOnLevel(project: NativeBimProject, levelId: string): Exit[] {
  const exits: Exit[] = [];
  for (const wall of project.walls) {
    if (wall.levelId !== levelId) continue;
    const [sx, sy] = wall.start;
    const [ex, ey] = wall.end;
    const length = Math.hypot(ex - sx, ey - sy);
    if (length === 0) continue;
    for (const opening of wall.openings) {
      if (opening.kind !== "DOOR") continue;
      const t = Math.min(Math.max(opening.offset / length, 0), 1);
      exits.push({
        openingId: opening.id,
        name: opening.name,
        at: [sx + (ex - sx) * t, sy + (ey - sy) * t],
        widthM: opening.width,
      });
    }
  }
  return exits;
}

export function roomArea(room: RoomDatum): number {
  return Math.abs(outlineArea(room.outline));
}

export function occupancyOf(room: RoomDatum, rules = DEFAULT_RULES): number {
  if (room.occupancyOverride !== null) return room.occupancyOverride;
  const rule = rules[room.usage];
  if (!rule || rule.densityM2PerPerson <= 0) return 0;
  return Math.ceil(roomArea(room) / rule.densityM2PerPerson);
}

function pointInPolygon(point: [number, number], polygon: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > point[1] !== yj > point[1]) {
      const x = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (point[0] < x) inside = !inside;
    }
  }
  return inside;
}

/**
 * Exits a room can reach: a door within the room's boundary, or within half a
 * metre of it — a door sits in a wall, so its centre lands on the boundary
 * rather than inside it.
 */
export function exitsForRoom(room: RoomDatum, exits: readonly Exit[]): Exit[] {
  return exits.filter((exit) => {
    if (pointInPolygon(exit.at, room.outline)) return true;
    return distanceToOutline(exit.at, room.outline) <= 0.5;
  });
}

function distanceToOutline(point: [number, number], polygon: readonly [number, number][]): number {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    best = Math.min(best, distanceToSegment(point, polygon[j], polygon[i]));
  }
  return best;
}

function distanceToSegment(
  point: [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

/**
 * Worst-case straight-line distance to the nearest exit: the boundary corner
 * furthest from any exit. Corners are the extremes of a convex room, and for
 * a concave one this understates — noted in the result so the UI can say so.
 */
export function worstTravelDistance(room: RoomDatum, exits: readonly Exit[]): number | null {
  if (exits.length === 0) return null;
  let worst = 0;
  for (const corner of room.outline) {
    let nearest = Infinity;
    for (const exit of exits) {
      nearest = Math.min(nearest, Math.hypot(corner[0] - exit.at[0], corner[1] - exit.at[1]));
    }
    worst = Math.max(worst, nearest);
  }
  return worst;
}

export interface RoomFinding {
  level: "warning" | "serious";
  message: string;
}

export interface RoomEgress {
  room: RoomDatum;
  areaM2: number;
  occupancy: number;
  exits: Exit[];
  travelM: number | null;
  requiredWidthM: number;
  availableWidthM: number;
  findings: RoomFinding[];
}

export function analyseRoom(
  room: RoomDatum,
  allExits: readonly Exit[],
  rules = DEFAULT_RULES,
): RoomEgress {
  const rule = rules[room.usage];
  const exits = exitsForRoom(room, allExits);
  const occupancy = occupancyOf(room, rules);
  const travelM = worstTravelDistance(room, exits);
  const availableWidthM = exits.reduce((sum, exit) => sum + exit.widthM, 0);
  const requiredWidthM =
    occupancy === 0 ? 0 : Math.max(MIN_EXIT_WIDTH_M, (occupancy / 100) * WIDTH_PER_100_PEOPLE_M);

  const findings: RoomFinding[] = [];
  if (exits.length === 0) {
    findings.push({ level: "serious", message: "Không có cửa đi nào thuộc phòng này." });
  }
  const limit = exits.length >= 2 ? rule?.maxTravelMultiExitM : rule?.maxTravelSingleExitM;
  if (travelM !== null && limit && limit > 0 && travelM > limit) {
    findings.push({
      level: "serious",
      message: `Cự ly trực tiếp ${travelM.toFixed(1)} m vượt ngưỡng tham chiếu ${limit} m (${exits.length} lối ra).`,
    });
  }
  if (occupancy > 0 && availableWidthM + 1e-9 < requiredWidthM) {
    findings.push({
      level: "serious",
      message: `Bề rộng lối ra ${availableWidthM.toFixed(2)} m < ${requiredWidthM.toFixed(2)} m cần cho ${occupancy} người.`,
    });
  }
  if (occupancy >= 50 && exits.length < 2) {
    findings.push({
      level: "warning",
      message: `${occupancy} người nhưng chỉ có ${exits.length} lối ra — kiểm tra yêu cầu hai lối thoát.`,
    });
  }

  return { room, areaM2: roomArea(room), occupancy, exits, travelM, requiredWidthM, availableWidthM, findings };
}

export function analyseProject(
  project: NativeBimProject,
  rules = DEFAULT_RULES,
): RoomEgress[] {
  return project.rooms.map((room) =>
    analyseRoom(room, exitsOnLevel(project, room.levelId), rules),
  );
}
