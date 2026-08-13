// 4D shows a building at a date. The failure that matters is a frame that
// looks complete while the model is not — or a plan that silently omits half
// the model and still ends on a finished building.
import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { buildDemoProject } from "../src/demo/seedProject";
import {
  auditSequence,
  builtAt,
  dateAtDay,
  parseDate,
  planTimeline,
  projectAt,
} from "../src/application/fourD";

const at = (iso: string) => new Date(`${iso}T00:00:00Z`);

function sequenced() {
  const project = NativeBimProject.create("P", "S", "B", "L1");
  project.addLevel("L1", 0);
  const a = project.addWall([0, 0, 0], [4, 0, 0]);
  const b = project.addWall([4, 0, 0], [4, 4, 0]);
  const first = project.addTask("Giai đoạn 1", "", "2026-01-01", "2026-01-10");
  const second = project.addTask("Giai đoạn 2", "", "2026-01-11", "2026-01-20");
  first.elementIds = [a.id];
  second.elementIds = [b.id];
  return { project, a, b };
}

describe("parseDate", () => {
  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(parseDate("2026-01-01")).toEqual(at("2026-01-01"));
    expect(parseDate("01/01/2026")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
});

describe("planTimeline", () => {
  it("spans the earliest start to the latest end", () => {
    const timeline = planTimeline(sequenced().project)!;
    expect(timeline.start).toEqual(at("2026-01-01"));
    expect(timeline.end).toEqual(at("2026-01-20"));
    expect(timeline.days).toBe(19);
  });

  it("is null when no task carries dates — the module shows a hint instead", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addTask("Không ngày");
    expect(planTimeline(project)).toBeNull();
  });

  it("never yields a zero-day span, so the scrubber still moves", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addTask("Một ngày", "", "2026-01-01", "2026-01-01");
    expect(planTimeline(project)!.days).toBe(1);
  });

  it("clamps the scrubber to the timeline", () => {
    const timeline = planTimeline(sequenced().project)!;
    expect(dateAtDay(timeline, -5)).toEqual(timeline.start);
    expect(dateAtDay(timeline, 999)).toEqual(timeline.end);
  });
});

describe("builtAt", () => {
  /** A half-built wall has no honest geometry; showing it whole overstates. */
  it("counts an element as built only once its task has finished", () => {
    const { project, a } = sequenced();
    const during = builtAt(project, at("2026-01-05"));
    expect(during.built.has(a.id)).toBe(false);
    expect(during.inProgress.has(a.id)).toBe(true);

    const after = builtAt(project, at("2026-01-10"));
    expect(after.built.has(a.id)).toBe(true);
    expect(after.inProgress.has(a.id)).toBe(false);
  });

  it("builds nothing before the plan starts and everything after it ends", () => {
    const { project } = sequenced();
    expect(builtAt(project, at("2025-12-31")).built.size).toBe(0);
    expect(builtAt(project, at("2026-02-01")).built.size).toBe(2);
  });

  it("ignores tasks that name no elements", () => {
    const { project } = sequenced();
    project.addTask("Xin phép", "", "2026-01-01", "2026-01-02");
    expect(builtAt(project, at("2026-02-01")).built.size).toBe(2);
  });
});

describe("projectAt", () => {
  it("returns a real project the viewer can call methods on", () => {
    const { project, a } = sequenced();
    const filtered = projectAt(project, new Set([a.id]));
    expect(filtered.walls).toHaveLength(1);
    expect(typeof filtered.slabTopZ).toBe("function");
  });

  it("does not mutate the original", () => {
    const { project, a } = sequenced();
    projectAt(project, new Set([a.id]));
    expect(project.walls).toHaveLength(2);
  });

  it("drops dimensions, so an empty first frame is not a finished drawing", () => {
    const project = buildDemoProject();
    expect(project.dimensions.length).toBeGreaterThan(0);
    expect(projectAt(project, new Set()).dimensions).toHaveLength(0);
  });
});

describe("auditSequence", () => {
  /** Otherwise the last frame looks finished either way. */
  it("names elements no task claims", () => {
    const { project } = sequenced();
    const orphan = project.addWall([0, 8, 0], [4, 8, 0]);
    expect(auditSequence(project).unscheduled).toEqual([orphan.id]);
  });

  it("lists tasks that build nothing without calling them broken", () => {
    const { project } = sequenced();
    project.addTask("Xin phép", "", "2026-01-01", "2026-01-02");
    expect(auditSequence(project).tasksWithoutElements).toEqual(["Xin phép"]);
  });

  it("catches a reference to a deleted element", () => {
    const { project } = sequenced();
    project.tasks[0].elementIds = ["đã-xoá"];
    expect(auditSequence(project).danglingElementIds).toEqual(["đã-xoá"]);
  });
});

describe("the demo sequence", () => {
  it("covers every element, so the simulation ends on the whole building", () => {
    const project = buildDemoProject();
    const audit = auditSequence(project);
    expect(audit.unscheduled).toEqual([]);
    expect(audit.danglingElementIds).toEqual([]);
  });

  it("builds up rather than appearing at once", () => {
    const project = buildDemoProject();
    const timeline = planTimeline(project)!;
    const early = builtAt(project, dateAtDay(timeline, 30)).built.size;
    const late = builtAt(project, timeline.end).built.size;
    expect(early).toBeGreaterThan(0);
    expect(late).toBeGreaterThan(early);
  });
});
