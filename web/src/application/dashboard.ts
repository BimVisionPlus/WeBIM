// Numbers for the coordination dashboard.
//
// Pure aggregation over the project: the charts render what these return and
// compute nothing themselves, so what the dashboard claims is testable
// without a browser.

import type { NativeBimProject } from "../domain/project";
import { qtoRows } from "./qto";
import { clashReport, externalClashes, type ClashItem } from "./clash";
import { applyMatrix, modelIndex, systemsOf } from "./clashMatrix";
import type { LinkedElement } from "../ifc/parseIfc";

export interface Counted {
  label: string;
  value: number;
}

export interface LinkedModelLike {
  name: string;
  elements: readonly LinkedElement[];
}

/** Headline counts — the row of stat tiles, not a chart. */
export function modelTotals(project: NativeBimProject) {
  const openings = project.walls.reduce((sum, wall) => sum + wall.openings.length, 0);
  return {
    grids: project.gridAxes.length,
    levels: project.levels.length,
    walls: project.walls.length,
    openings,
    slabs: project.slabs.length,
    views: project.views.length,
    sheets: project.sheets.length,
  };
}

export interface ClashBreakdown {
  reported: number;
  suppressed: number;
  /** Reported clashes per system pair, biggest first. */
  byPair: Counted[];
}

/**
 * Clash counts after the matrix, plus how many it hid.
 *
 * The suppressed figure is carried through deliberately: a dashboard that
 * shows only what survived the filter tells a coordinator the model is
 * cleaner than it is.
 */
export function clashBreakdown(
  project: NativeBimProject,
  linked: readonly LinkedModelLike[],
  systemLabel: (systemId: string) => string,
): ClashBreakdown {
  const all: ClashItem[] = [
    ...clashReport(project),
    ...linked.flatMap((model) => externalClashes(project, model.elements)),
  ];
  const lookup = modelIndex(linked);
  const filtered = applyMatrix(all, project.clashMatrix, lookup);

  const counts = new Map<string, number>();
  for (const item of filtered.kept) {
    const systems = systemsOf(item, lookup);
    const label = systems
      ? systems[0] === systems[1]
        ? `${systemLabel(systems[0])} × chính nó`
        : `${systemLabel(systems[0])} × ${systemLabel(systems[1])}`
      : "Chưa phân loại";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return {
    reported: filtered.kept.length,
    suppressed: filtered.suppressedByRule + filtered.suppressedByTolerance,
    byPair: [...counts]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };
}

export const DOCUMENT_STATUS_ORDER = ["WIP", "SHARED", "PUBLISHED", "ARCHIVED"] as const;

/** CDE documents by status, always in workflow order — it is an ordinal scale. */
export function documentsByStatus(project: NativeBimProject): Counted[] {
  return DOCUMENT_STATUS_ORDER.map((status) => ({
    label: status,
    value: project.documents.filter((document) => document.status === status).length,
  }));
}

export const TASK_STATUS_ORDER = ["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

export function tasksByStatus(project: NativeBimProject): Counted[] {
  return TASK_STATUS_ORDER.map((status) => ({
    label: status,
    value: project.tasks.filter((task) => task.status === status).length,
  }));
}

/**
 * Mean progress across tasks, 0–100.
 *
 * Unweighted on purpose: WeBIM has no cost or man-hour per task to weight by,
 * and inventing one would make the headline number look more authoritative
 * than the data behind it.
 */
export function planProgress(project: NativeBimProject): number {
  if (project.tasks.length === 0) return 0;
  const total = project.tasks.reduce((sum, task) => sum + (task.progress ?? 0), 0);
  return Math.round(total / project.tasks.length);
}

/** Concrete, brick, plaster… — volume by material, biggest first. */
export function volumeByMaterial(project: NativeBimProject, limit = 8): Counted[] {
  const totals = new Map<string, number>();
  for (const row of qtoRows(project)) {
    if (row.unit !== "m³" || row.material === "—") continue;
    totals.set(row.material, (totals.get(row.material) ?? 0) + row.quantity);
  }
  const sorted = [...totals]
    .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  // Never invent a ninth colour: the tail folds into one row.
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1).reduce((sum, row) => sum + row.value, 0);
  return [...head, { label: "Khác", value: Math.round(rest * 100) / 100 }];
}

/** Openings by kind — small enough to be a pair of tiles rather than a chart. */
export function openingsByKind(project: NativeBimProject): Counted[] {
  const openings = project.walls.flatMap((wall) => wall.openings);
  return [
    { label: "Cửa đi", value: openings.filter((o) => o.kind === "DOOR").length },
    { label: "Cửa sổ", value: openings.filter((o) => o.kind === "WINDOW").length },
  ];
}
