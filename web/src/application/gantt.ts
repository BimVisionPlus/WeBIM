// Gantt layout for the Plan module — pure date/position math, rendered
// as SVG by the UI. Days are the unit; tasks without dates are listed
// but get no bar.

import type { NativeBimProject, TaskDatum } from "../domain/project";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GanttBar {
  task: TaskDatum;
  row: number;
  /** Day offsets from chart start; null when the task has no dates. */
  startDay: number | null;
  endDay: number | null;
}

export interface GanttLink {
  fromRow: number;
  fromEndDay: number;
  toRow: number;
  toStartDay: number;
  /** True when the successor starts before the dependency ends. */
  violated: boolean;
}

export interface GanttChart {
  startDate: string;
  endDate: string;
  totalDays: number;
  bars: GanttBar[];
  links: GanttLink[];
  /** Day offset of `today`, when it falls inside the range. */
  todayDay: number | null;
  /**
   * Tasks whose end precedes their start. `addTask` refuses these, but a
   * project arriving over sync or from someone else's JSON can still carry
   * one — and letting it into the range stretches the chart across the
   * reversed interval until every real bar sits off-screen. Excluded from
   * the range and named here so the UI can say which row is wrong instead of
   * showing an empty chart.
   */
  reversed: TaskDatum[];
}

function parseDay(value: string): number | null {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : Math.floor(time / DAY_MS);
}

export function ganttChart(
  project: NativeBimProject,
  today: string,
): GanttChart | null {
  const tasks = project.tasks;
  const dated = tasks
    .map((task) => ({ task, start: parseDay(task.start), end: parseDay(task.end) }))
    .filter((entry) => entry.start !== null || entry.end !== null);
  if (dated.length === 0) return null;

  const isReversed = (entry: { start: number | null; end: number | null }) =>
    entry.start !== null && entry.end !== null && entry.end < entry.start;
  const reversed = dated.filter(isReversed).map((entry) => entry.task);
  const usable = dated.filter((entry) => !isReversed(entry));
  if (usable.length === 0) return null;

  const days = usable.flatMap((entry) =>
    [entry.start, entry.end].filter((day): day is number => day !== null),
  );
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days, minDay + 1);

  const rowByTask = new Map<string, number>();
  const bars: GanttBar[] = tasks.map((task, row) => {
    rowByTask.set(task.id, row);
    const start = parseDay(task.start);
    const end = parseDay(task.end);
    if (start !== null && end !== null && end < start) {
      // Listed as a row, but given no bar: there is no honest span to draw.
      return { task, row, startDay: null, endDay: null };
    }
    return {
      task,
      row,
      startDay: start !== null ? start - minDay : null,
      // A dated task always spans at least one day so the bar is visible.
      endDay: end !== null ? Math.max(end - minDay, (start ?? end) - minDay) + 1 : null,
    };
  });

  const links: GanttLink[] = [];
  for (const bar of bars) {
    for (const dependencyId of bar.task.dependsOn) {
      const fromRow = rowByTask.get(dependencyId);
      if (fromRow === undefined) continue;
      const from = bars[fromRow];
      if (from.endDay === null || bar.startDay === null) continue;
      links.push({
        fromRow,
        fromEndDay: from.endDay,
        toRow: bar.row,
        toStartDay: bar.startDay,
        violated: bar.startDay < from.endDay,
      });
    }
  }

  const todayDayAbsolute = parseDay(today);
  const todayDay =
    todayDayAbsolute !== null &&
    todayDayAbsolute >= minDay &&
    todayDayAbsolute <= maxDay
      ? todayDayAbsolute - minDay
      : null;

  return {
    startDate: new Date(minDay * DAY_MS).toISOString().slice(0, 10),
    endDate: new Date(maxDay * DAY_MS).toISOString().slice(0, 10),
    totalDays: maxDay - minDay + 1,
    bars,
    links,
    todayDay,
    reversed,
  };
}

/** Week tick positions (day offsets) for the time axis. */
export function weekTicks(chart: GanttChart): { day: number; label: string }[] {
  const startMs = Date.parse(chart.startDate);
  const ticks: { day: number; label: string }[] = [];
  for (let day = 0; day <= chart.totalDays; day += 1) {
    const date = new Date(startMs + day * DAY_MS);
    if (date.getUTCDay() === 1 || day === 0) {
      ticks.push({
        day,
        label: `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      });
    }
  }
  return ticks;
}
