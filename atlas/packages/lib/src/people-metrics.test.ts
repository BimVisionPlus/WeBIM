// These numbers get read as judgements about people, so the tests are mostly
// about what the module refuses to say.
import { describe, expect, it } from "vitest";
import {
  MIN_SAMPLE,
  personStats,
  rateNote,
  type IssueFact,
  type ProcessTaskFact,
  type QaqcFact,
} from "./people-metrics";

const NOW = new Date("2026-08-12T00:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function task(over: Partial<ProcessTaskFact> = {}): ProcessTaskFact {
  return {
    assigneeUserId: "u1",
    status: "DONE",
    dueAt: day(1),
    decidedAt: day(0),
    isGate: false,
    ...over,
  };
}

const base = { userIds: ["u1"], issues: [] as IssueFact[], checks: [] as QaqcFact[], now: NOW };

describe("withholding rates", () => {
  it("returns null rather than a percentage below the minimum sample", () => {
    const [stats] = personStats({ ...base, tasks: [task(), task()] });
    expect(stats.tasksDone).toBe(2);
    expect(stats.onTimeRate).toBeNull();
    expect(stats.completionRate).toBeNull();
  });

  it("reports the rate once the sample is large enough", () => {
    const tasks = Array.from({ length: MIN_SAMPLE }, () => task());
    const [stats] = personStats({ ...base, tasks });
    expect(stats.onTimeRate).toBe(100);
    expect(stats.completionRate).toBe(100);
  });

  /** Silence would read as zero, which is the opposite of "we don't know". */
  it("explains a missing rate in words", () => {
    expect(rateNote(0)).toBe("chưa có dữ liệu");
    expect(rateNote(2)).toContain("mẫu quá nhỏ");
    expect(rateNote(MIN_SAMPLE)).toBeNull();
  });

  it("always exposes counts beside every rate", () => {
    const [stats] = personStats({ ...base, tasks: [task()] });
    expect(stats.tasksAssigned).toBe(1);
    expect(stats.tasksDone).toBe(1);
  });
});

describe("on time", () => {
  it("counts a step decided after its due date as late", () => {
    const tasks = [
      ...Array.from({ length: 4 }, () => task({ decidedAt: day(0), dueAt: day(1) })),
      task({ decidedAt: day(5), dueAt: day(1) }),
    ];
    const [stats] = personStats({ ...base, tasks });
    expect(stats.tasksDoneOnTime).toBe(4);
    expect(stats.tasksDoneLate).toBe(1);
    expect(stats.onTimeRate).toBe(80);
  });

  /** A step with no deadline cannot be late; scoring it on time would flatter. */
  it("excludes undated steps from the on-time denominator", () => {
    const tasks = Array.from({ length: 6 }, () => task({ dueAt: null, decidedAt: day(9) }));
    const [stats] = personStats({ ...base, tasks });
    expect(stats.tasksDone).toBe(6);
    expect(stats.tasksDoneOnTime).toBe(0);
    expect(stats.tasksDoneLate).toBe(0);
    expect(stats.onTimeRate).toBeNull();
  });

  it("counts an open step past its date as overdue, not as late-completed", () => {
    const [stats] = personStats({
      ...base,
      tasks: [task({ status: "IN_PROGRESS", dueAt: day(-3), decidedAt: null })],
    });
    expect(stats.tasksOverdueOpen).toBe(1);
    expect(stats.tasksDoneLate).toBe(0);
  });
});

describe("scope", () => {
  it("never attributes another person's work", () => {
    const stats = personStats({
      ...base,
      userIds: ["u1", "u2"],
      tasks: [task({ assigneeUserId: "u2" }), task({ assigneeUserId: null })],
    });
    expect(stats.find((s) => s.userId === "u1")!.tasksAssigned).toBe(0);
    expect(stats.find((s) => s.userId === "u2")!.tasksAssigned).toBe(1);
  });

  it("separates gates from ordinary steps", () => {
    const [stats] = personStats({
      ...base,
      tasks: [task({ isGate: true, status: "PENDING" }), task()],
    });
    expect(stats.gatesOwned).toBe(1);
    expect(stats.gatesOpen).toBe(1);
  });
});

describe("quality checks", () => {
  it("ignores checks still pending — a result that has not happened is not a pass", () => {
    const checks: QaqcFact[] = [
      ...Array.from({ length: 5 }, () => ({ inspectorUserId: "u1", result: "PASS" })),
      { inspectorUserId: "u1", result: "PENDING" },
      { inspectorUserId: "u1", result: "FAIL" },
    ];
    const [stats] = personStats({ ...base, tasks: [], checks });
    expect(stats.checksDone).toBe(6);
    expect(stats.checksFailed).toBe(1);
    expect(stats.failureRate).toBe(17);
  });
});

describe("issues", () => {
  it("counts overdue open issues without counting closed ones", () => {
    const issues: IssueFact[] = [
      { assigneeId: "u1", closedAt: null, dueDate: day(-2) },
      { assigneeId: "u1", closedAt: day(-1), dueDate: day(-5) },
    ];
    const [stats] = personStats({ ...base, tasks: [], issues });
    expect(stats.issuesAssigned).toBe(2);
    expect(stats.issuesClosed).toBe(1);
    expect(stats.issuesOverdueOpen).toBe(1);
  });
});
