// Derived schedule tables: pure computations over the native project.

import type { NativeBimProject } from "../domain/project";

export interface WallScheduleRow {
  name: string;
  level: string;
  length: number;
  thickness: number;
  height: number;
  openings: number;
}

export interface OpeningScheduleRow {
  name: string;
  kind: string;
  wall: string;
  level: string;
  width: number;
  height: number;
  sillHeight: number;
}

export interface SlabScheduleRow {
  name: string;
  kind: string;
  level: string;
  area: number;
  thickness: number;
  topElevation: number;
}

function levelName(project: NativeBimProject, levelId: string): string {
  return project.levelById(levelId)?.name ?? "—";
}

export function wallScheduleRows(project: NativeBimProject): WallScheduleRow[] {
  return project.walls.map((wall) => ({
    name: wall.name,
    level: levelName(project, wall.levelId),
    length: Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]),
    thickness: wall.thickness,
    height: wall.height,
    openings: wall.openings.length,
  }));
}

export function openingScheduleRows(project: NativeBimProject): OpeningScheduleRow[] {
  const rows: OpeningScheduleRow[] = [];
  for (const wall of project.walls) {
    for (const opening of wall.openings) {
      rows.push({
        name: opening.name,
        kind: opening.kind === "DOOR" ? "Door" : "Window",
        wall: wall.name,
        level: levelName(project, wall.levelId),
        width: opening.width,
        height: opening.height,
        sillHeight: opening.sillHeight,
      });
    }
  }
  return rows.sort((first, second) => first.name.localeCompare(second.name));
}

/** Shoelace area of a plan outline polygon. */
export function outlineArea(outline: readonly [number, number][]): number {
  let doubled = 0;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    doubled += outline[j][0] * outline[i][1] - outline[i][0] * outline[j][1];
  }
  return Math.abs(doubled) / 2;
}

export function slabScheduleRows(project: NativeBimProject): SlabScheduleRow[] {
  return project.slabs.map((slab) => ({
    name: slab.name,
    kind: slab.kind === "FLOOR" ? "Floor" : "Roof",
    level: levelName(project, slab.levelId),
    area: outlineArea(slab.outline),
    thickness: slab.thickness,
    topElevation: project.slabTopZ(slab),
  }));
}
