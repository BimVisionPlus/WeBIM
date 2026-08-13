// 4D — the model as it stands on a given date.
//
// A construction sequence is the plan and the model saying the same thing:
// each task names the elements it builds, and the viewer shows only what has
// been built by the date on the scrubber. That makes the plan checkable —
// an element nobody scheduled, or a task that builds nothing, both show up.
//
// This computes sets of element ids; the viewer renders a project filtered to
// them, so nothing here knows about three.js.

import { NativeBimProject } from "../domain/project";

/** Midnight-safe parse of the "YYYY-MM-DD" the Plan module stores. */
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface Timeline {
  start: Date;
  end: Date;
  /** Whole days from start to end, at least 1 so a one-day plan still scrubs. */
  days: number;
}

/** The span the plan covers, or null when no task carries usable dates. */
export function planTimeline(project: NativeBimProject): Timeline | null {
  const starts: Date[] = [];
  const ends: Date[] = [];
  for (const task of project.tasks) {
    const start = parseDate(task.start);
    const end = parseDate(task.end);
    if (start) starts.push(start);
    if (end) ends.push(end);
  }
  if (starts.length === 0 || ends.length === 0) return null;
  const start = new Date(Math.min(...starts.map((date) => date.getTime())));
  const end = new Date(Math.max(...ends.map((date) => date.getTime())));
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  return { start, end, days };
}

export function dateAtDay(timeline: Timeline, day: number): Date {
  const clamped = Math.max(0, Math.min(timeline.days, day));
  return new Date(timeline.start.getTime() + clamped * 86_400_000);
}

/**
 * Elements built by `at`.
 *
 * A task counts as building its elements once it has *finished*: a half-built
 * wall has no honest geometry, and showing it whole while the task is still
 * running would overstate progress on exactly the date someone is checking.
 * Tasks in progress are reported separately so the UI can show them another
 * way rather than silently rounding them up or down.
 */
export function builtAt(
  project: NativeBimProject,
  at: Date,
): { built: Set<string>; inProgress: Set<string> } {
  const built = new Set<string>();
  const inProgress = new Set<string>();

  for (const task of project.tasks) {
    const ids = task.elementIds ?? [];
    if (ids.length === 0) continue;
    const start = parseDate(task.start);
    const end = parseDate(task.end);
    if (end && end <= at) {
      for (const id of ids) built.add(id);
    } else if (start && start <= at) {
      for (const id of ids) inProgress.add(id);
    }
  }
  return { built, inProgress };
}

/**
 * A project containing only the given elements.
 *
 * Round-tripped through the project's own JSON rather than assembled by hand:
 * the viewer calls methods on it (slabTopZ), so it has to be the real class,
 * and re-deriving it from the serialised form is the only way to get that
 * without either mutating the original or duplicating its constructor logic.
 *
 * Callers should memoise on the id set — this is not free, and a scrubber
 * drags across many frames.
 */
export function projectAt(
  project: NativeBimProject,
  ids: ReadonlySet<string>,
): NativeBimProject {
  const dict = project.toDict() as Record<string, unknown>;
  const keep = (row: unknown) => ids.has((row as { id: string }).id);
  return NativeBimProject.fromJson(
    JSON.stringify({
      ...dict,
      walls: (dict.walls as unknown[]).filter(keep),
      slabs: (dict.slabs as unknown[]).filter(keep),
      // Dimensions and grids are drawing furniture, not built work; keeping
      // them would make the empty first frame look like a finished drawing.
      dimensions: [],
    }),
  );
}

export interface SequenceAudit {
  /** Elements no task claims — they would never appear in the simulation. */
  unscheduled: string[];
  /** Tasks with dates but no elements — timeline-only, which is often fine. */
  tasksWithoutElements: string[];
  /** Tasks naming an element that no longer exists. */
  danglingElementIds: string[];
}

/**
 * What the sequence does not cover. A 4D view that silently omits half the
 * model looks like a finished building on the last day either way; this is
 * how you find out it did not.
 */
export function auditSequence(project: NativeBimProject): SequenceAudit {
  const elementIds = new Set<string>([
    ...project.walls.map((wall) => wall.id),
    ...project.slabs.map((slab) => slab.id),
  ]);
  const claimed = new Set<string>();
  const dangling: string[] = [];
  const withoutElements: string[] = [];

  for (const task of project.tasks) {
    const ids = task.elementIds ?? [];
    if (ids.length === 0) {
      withoutElements.push(task.name);
      continue;
    }
    for (const id of ids) {
      if (elementIds.has(id)) claimed.add(id);
      else dangling.push(id);
    }
  }

  return {
    unscheduled: [...elementIds].filter((id) => !claimed.has(id)),
    tasksWithoutElements: withoutElements,
    danglingElementIds: dangling,
  };
}
