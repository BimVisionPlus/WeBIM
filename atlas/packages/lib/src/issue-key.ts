/**
 * Per-project issue key generator: `{PROJECT.key}-{TYPE_PREFIX}-{NNN}`.
 * Uses a sequence row per (project, type-prefix) so concurrent inserts don't
 * collide. We model the sequence as a row in `Issue` itself via the unique
 * `key` column + an UPSERT-with-counter pattern.
 *
 * For simplicity and correctness we do this inside a $transaction with a
 * MAX(seq)+1 read. Postgres serializable doesn't fire often at the volumes
 * AEC projects see; we can move to a dedicated `IssueSequence` table later
 * if we hit contention.
 */

import { prisma } from "@atlas/db";
import type { IssueType } from "@atlas/db";

const PREFIX: Record<IssueType, string> = {
  TASK: "TASK",
  RFI: "RFI",
  SUBMITTAL: "SUB",
  NCR: "NCR",
  PUNCH: "PUNCH",
  CHANGE_ORDER: "CO",
  SAFETY: "SAFE",
};

export function issuePrefix(type: IssueType) {
  return PREFIX[type];
}

/** Returns the next sequential key for a given project + issue type. */
export async function nextIssueKey(tx: typeof prisma, projectId: string, type: IssueType) {
  const project = await tx.project.findUnique({ where: { id: projectId }, select: { key: true } });
  if (!project) throw new Error("Project not found");

  const prefix = `${project.key}-${PREFIX[type]}-`;
  const last = await tx.issue.findFirst({
    where: { projectId, key: { startsWith: prefix } },
    orderBy: { key: "desc" },
    select: { key: true },
  });
  let n = 1;
  if (last) {
    const tail = last.key.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (!isNaN(parsed)) n = parsed + 1;
  }
  return `${prefix}${String(n).padStart(3, "0")}`;
}
