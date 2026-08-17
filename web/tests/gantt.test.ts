import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { ganttChart } from "../src/application/gantt";

/**
 * The Gantt honestly spans min(date)…max(date), so one row with its end
 * before its start stretches the chart across the reversed interval and
 * pushes every real bar off-screen. The chart then reads as "no plan".
 * addTask refuses such a row, but sync and someone else's JSON do not.
 */
describe("a task whose end precedes its start", () => {
  it("is refused at the door", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    expect(() => project.addTask("Lùi", "", "2026-12-31", "2026-01-01")).toThrow(
      "trước ngày bắt đầu",
    );
    expect(() => project.addTask("Cùng ngày", "", "2026-05-05", "2026-05-05")).not.toThrow();
    // Either end may be blank: an undated task is a normal thing to plan.
    expect(() => project.addTask("Chưa có ngày", "", "", "2026-01-01")).not.toThrow();
  });

  it("cannot be introduced by an edit either", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    const task = project.addTask("A", "", "2026-03-01", "2026-03-10");
    expect(() => project.updateTask(task.id, { end: "2026-02-01" })).toThrow(
      "trước ngày bắt đầu",
    );
    expect(project.tasks[0].end).toBe("2026-03-10");
  });

  it("keeps the rest of the chart readable when one slips in anyway", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addTask("Thật", "", "2026-09-01", "2026-09-30");
    const bad = project.addTask("Lùi", "", "2026-09-05", "2026-09-06");
    // Bypass the guard the way a synced project would.
    bad.start = "2026-12-31";
    bad.end = "2026-01-01";

    const chart = ganttChart(project, "2026-09-15")!;
    expect(chart.reversed.map((task) => task.name)).toEqual(["Lùi"]);
    // Range is September only — not the whole of 2026.
    expect(chart.startDate).toBe("2026-09-01");
    expect(chart.endDate).toBe("2026-09-30");
    expect(chart.totalDays).toBe(30);
    // The reversed row is listed, but with no bar to draw.
    const reversedBar = chart.bars.find((bar) => bar.task.name === "Lùi")!;
    expect(reversedBar.startDay).toBeNull();
    expect(reversedBar.endDay).toBeNull();
    // And the real task still gets one.
    expect(chart.bars.find((bar) => bar.task.name === "Thật")!.startDay).toBe(0);
  });
});

describe("critical path (CPM)", () => {
  const task = (id: string, start: string, end: string, deps: string[] = []) => ({
    id, name: id, category: "", assignee: "", status: "IN_PROGRESS" as const,
    start, end, progress: 0, dependsOn: deps,
  });

  it("chuỗi dài nhất là đường găng, nhánh ngắn có slack", async () => {
    const { criticalPath } = await import("../src/application/gantt");
    // A(5d) → B(10d) → D(2d) và A → C(3d) → D: găng là A-B-D
    const result = criticalPath([
      task("A", "2026-01-01", "2026-01-05"),
      task("B", "2026-01-06", "2026-01-15", ["A"]),
      task("C", "2026-01-06", "2026-01-08", ["A"]),
      task("D", "2026-01-16", "2026-01-17", ["B", "C"]),
    ]);
    expect(result.cycle).toBe(false);
    expect([...result.critical].sort()).toEqual(["A", "B", "D"]);
    expect(result.slackByTask.get("C")).toBe(7); // 10 - 3
  });

  it("chu trình phụ thuộc được gọi tên thay vì treo", async () => {
    const { criticalPath } = await import("../src/application/gantt");
    const result = criticalPath([
      task("A", "2026-01-01", "2026-01-05", ["B"]),
      task("B", "2026-01-06", "2026-01-10", ["A"]),
    ]);
    expect(result.cycle).toBe(true);
  });

  it("task không ngày đứng ngoài CPM, không bịa duration", async () => {
    const { criticalPath } = await import("../src/application/gantt");
    const result = criticalPath([
      task("A", "2026-01-01", "2026-01-05"),
      task("X", "", ""),
    ]);
    expect(result.critical.has("A")).toBe(true);
    expect(result.slackByTask.has("X")).toBe(false);
  });
});

describe("import Excel (dán TSV)", () => {
  it("parse header + dd/mm/yyyy + báo lỗi CÓ SỐ DÒNG", async () => {
    const { parseTaskPaste } = await import("../src/application/gantt");
    const pasted = [
      "Tên\tNhóm\tBắt đầu\tKết thúc\t%",
      "Móng\tKết cấu\t01/02/2026\t28/02/2026\t80",
      "Thân\tKết cấu\t2026-03-01\t2026-05-31\t20%",
      "\tThiếu tên\t01/03/2026\t02/03/2026\t0",
      "Ngược\tX\t10/03/2026\t01/03/2026\t0",
    ].join("\n");
    const { rows, errors } = parseTaskPaste(pasted);
    expect(rows).toHaveLength(2);
    expect(rows[0].start).toBe("2026-02-01"); // dd/mm → ISO
    expect(rows[1].progress).toBe(20); // "20%" → 20
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("Dòng 4");
    expect(errors[1]).toContain("kết thúc trước bắt đầu");
  });
});
