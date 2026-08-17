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

// ── Critical path (CPM trên chuỗi FS) ────────────────────────────────────
//
// Tasks ở đây có NGÀY CỤ THỂ chứ không phải duration trôi nổi, nên CPM làm
// việc trên duration suy từ ngày: forward pass tính sớm-nhất theo chuỗi
// dependsOn (FS), backward pass tính muộn-nhất từ mốc kết thúc dự án; task
// slack = 0 là nằm trên đường găng — trễ nó một ngày là trễ cả dự án.
// Task thiếu ngày đứng ngoài CPM (không bịa duration cho nó).

export interface CriticalPathResult {
  /** Id các task trên đường găng. */
  critical: Set<string>;
  /** Slack (ngày) theo id — 0 = găng. */
  slackByTask: Map<string, number>;
  /** Chu trình phụ thuộc nếu có (a→b→a): CPM bó tay, UI phải nói. */
  cycle: boolean;
}

export function criticalPath(tasks: readonly TaskDatum[]): CriticalPathResult {
  const dated = tasks.filter(
    (task) => parseDay(task.start) !== null && parseDay(task.end) !== null,
  );
  const byId = new Map(dated.map((task) => [task.id, task]));
  const duration = (task: TaskDatum) =>
    Math.max(1, (parseDay(task.end) as number) - (parseDay(task.start) as number) + 1);

  // Topo sort (Kahn) trên dependsOn đã lọc về task có ngày.
  const incoming = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const task of dated) {
    const deps = task.dependsOn.filter((id) => byId.has(id));
    incoming.set(task.id, deps.length);
    for (const dep of deps) {
      successors.set(dep, [...(successors.get(dep) ?? []), task.id]);
    }
  }
  const queue = dated.filter((task) => (incoming.get(task.id) ?? 0) === 0).map((t) => t.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of successors.get(id) ?? []) {
      const left = (incoming.get(next) ?? 1) - 1;
      incoming.set(next, left);
      if (left === 0) queue.push(next);
    }
  }
  if (order.length !== dated.length) {
    return { critical: new Set(), slackByTask: new Map(), cycle: true };
  }

  // Forward: earliest finish; Backward: latest finish.
  const earlyFinish = new Map<string, number>();
  for (const id of order) {
    const task = byId.get(id) as TaskDatum;
    const depFinish = Math.max(
      0,
      ...task.dependsOn.filter((d) => byId.has(d)).map((d) => earlyFinish.get(d) ?? 0),
    );
    earlyFinish.set(id, depFinish + duration(task));
  }
  const projectEnd = Math.max(0, ...earlyFinish.values());
  const lateFinish = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const succ = successors.get(id) ?? [];
    const lf =
      succ.length === 0
        ? projectEnd
        : Math.min(
            ...succ.map(
              (next) => (lateFinish.get(next) ?? projectEnd) - duration(byId.get(next) as TaskDatum),
            ),
          );
    lateFinish.set(id, lf);
  }

  const critical = new Set<string>();
  const slackByTask = new Map<string, number>();
  for (const id of order) {
    const slack = (lateFinish.get(id) as number) - (earlyFinish.get(id) as number);
    slackByTask.set(id, slack);
    if (slack <= 0) critical.add(id);
  }
  return { critical, slackByTask, cycle: false };
}

/** Xuất tasks ra CSV (Excel mở thẳng) — cột khớp với chiều import TSV. */
export function tasksCsv(tasks: readonly TaskDatum[]): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = tasks.map((task) =>
    [task.name, task.category, task.start, task.end, String(task.progress), task.status]
      .map(escape)
      .join(","),
  );
  return ["Tên,Nhóm,Bắt đầu,Kết thúc,Tiến độ %,Trạng thái", ...rows].join("\n");
}

export interface ParsedTaskRow {
  name: string;
  category: string;
  start: string;
  end: string;
  progress: number;
}

/**
 * Parse bảng dán từ Excel (TSV: chọn vùng → Ctrl+C → dán). Cột:
 * Tên | Nhóm | Bắt đầu | Kết thúc | %. Dòng đầu là header thì tự bỏ.
 * Trả kèm danh sách dòng lỗi CÓ SỐ DÒNG — người sửa Excel cần biết sửa đâu.
 */
export function parseTaskPaste(text: string): {
  rows: ParsedTaskRow[];
  errors: string[];
} {
  const rows: ParsedTaskRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  for (let index = 0; index < lines.length; index += 1) {
    const cells = lines[index].split("\t").map((cell) => cell.trim());
    if (index === 0 && /tên|name/i.test(cells[0] ?? "")) continue; // header
    const [name, category = "", start = "", end = "", progressText = "0"] = cells;
    if (!name) {
      errors.push(`Dòng ${index + 1}: thiếu tên hạng mục`);
      continue;
    }
    const normalizeDate = (value: string) => {
      if (!value) return "";
      // Excel VN hay ra dd/mm/yyyy — đổi về ISO; yyyy-mm-dd giữ nguyên.
      const vn = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (vn) return `${vn[3]}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`;
      return Number.isNaN(Date.parse(value)) ? null : value;
    };
    const startIso = normalizeDate(start);
    const endIso = normalizeDate(end);
    if (startIso === null || endIso === null) {
      errors.push(`Dòng ${index + 1} (${name}): ngày không đọc được "${startIso === null ? start : end}"`);
      continue;
    }
    if (startIso && endIso && Date.parse(endIso) < Date.parse(startIso)) {
      errors.push(`Dòng ${index + 1} (${name}): kết thúc trước bắt đầu`);
      continue;
    }
    const progress = Math.min(100, Math.max(0, Number(progressText.replace("%", "")) || 0));
    rows.push({ name, category, start: startIso, end: endIso, progress });
  }
  return { rows, errors };
}
