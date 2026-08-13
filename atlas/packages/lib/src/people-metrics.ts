// Per-person statistics across projects.
//
// This measures people, so the failure mode is not a wrong pixel — it is a
// number that reads as a verdict. Two rules follow from that and are enforced
// here rather than left to whoever renders the table:
//
//  1. A rate needs a denominator worth dividing by. Below MIN_SAMPLE the rate
//     is null and the caller shows the counts instead. "0% đúng hạn" off one
//     task is not a fact about a person, it is a fact about one task.
//  2. Counts are always available alongside every rate. A rate without its
//     denominator invites comparing someone with 3 items to someone with 90.
//
// Nothing here scores or ranks. It reports what happened; judging is a
// conversation between people who know the context, and the numbers exist to
// start it, not to end it.

/** Below this, rates are withheld — the sample cannot support a percentage. */
export const MIN_SAMPLE = 5;

export interface ProcessTaskFact {
  assigneeUserId: string | null;
  status: "PENDING" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  dueAt: Date | null;
  decidedAt: Date | null;
  isGate: boolean;
}

export interface IssueFact {
  assigneeId: string | null;
  closedAt: Date | null;
  dueDate: Date | null;
}

export interface QaqcFact {
  inspectorUserId: string | null;
  result: "PENDING" | "PASS" | "FAIL" | string;
}

export interface PersonStats {
  userId: string;
  /** Quy trình: bước được giao. */
  tasksAssigned: number;
  tasksDone: number;
  tasksOpen: number;
  tasksOverdueOpen: number;
  tasksDoneOnTime: number;
  tasksDoneLate: number;
  /** Điểm dừng — the steps whose delay blocks a stage. */
  gatesOwned: number;
  gatesOpen: number;
  /** Issues assigned to this person. */
  issuesAssigned: number;
  issuesClosed: number;
  issuesOverdueOpen: number;
  /** Nghiệm thu do người này thực hiện. */
  checksDone: number;
  checksFailed: number;
  /** null when the denominator is below MIN_SAMPLE. */
  onTimeRate: number | null;
  completionRate: number | null;
  failureRate: number | null;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator < MIN_SAMPLE) return null;
  return Math.round((numerator / denominator) * 100);
}

export interface MetricsInput {
  userIds: readonly string[];
  tasks: readonly ProcessTaskFact[];
  issues: readonly IssueFact[];
  checks: readonly QaqcFact[];
  /** Injected so "quá hạn" is testable and not a function of the clock. */
  now: Date;
}

export function personStats(input: MetricsInput): PersonStats[] {
  const { userIds, tasks, issues, checks, now } = input;

  return userIds.map((userId) => {
    const mine = tasks.filter((task) => task.assigneeUserId === userId);
    const done = mine.filter((task) => task.status === "DONE");
    const open = mine.filter((task) => task.status !== "DONE");

    // On time means decided by the due date. A step with no due date cannot be
    // late, so it counts as neither — excluded from the denominator instead of
    // silently scoring as on time.
    const datedDone = done.filter((task) => task.dueAt && task.decidedAt);
    const onTime = datedDone.filter((task) => task.decidedAt! <= task.dueAt!);

    const gates = mine.filter((task) => task.isGate);
    const myIssues = issues.filter((issue) => issue.assigneeId === userId);
    const closedIssues = myIssues.filter((issue) => issue.closedAt !== null);
    const myChecks = checks.filter(
      (check) => check.inspectorUserId === userId && check.result !== "PENDING",
    );
    const failed = myChecks.filter((check) => check.result === "FAIL");

    return {
      userId,
      tasksAssigned: mine.length,
      tasksDone: done.length,
      tasksOpen: open.length,
      tasksOverdueOpen: open.filter((task) => task.dueAt && task.dueAt < now).length,
      tasksDoneOnTime: onTime.length,
      tasksDoneLate: datedDone.length - onTime.length,
      gatesOwned: gates.length,
      gatesOpen: gates.filter((task) => task.status !== "DONE").length,
      issuesAssigned: myIssues.length,
      issuesClosed: closedIssues.length,
      issuesOverdueOpen: myIssues.filter(
        (issue) => !issue.closedAt && issue.dueDate && issue.dueDate < now,
      ).length,
      checksDone: myChecks.length,
      checksFailed: failed.length,
      onTimeRate: rate(onTime.length, datedDone.length),
      completionRate: rate(done.length, mine.length),
      failureRate: rate(failed.length, myChecks.length),
    };
  });
}

/**
 * Why a rate is missing, in words the table can print. Silence would read as
 * "zero", which is the opposite of what a withheld rate means.
 */
export function rateNote(sample: number): string | null {
  if (sample === 0) return "chưa có dữ liệu";
  if (sample < MIN_SAMPLE) return `mẫu quá nhỏ (${sample}/${MIN_SAMPLE})`;
  return null;
}
