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
