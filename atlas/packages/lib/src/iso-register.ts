// Findings against an ISO document register.
//
// A register that only lists documents is a spreadsheet with a database
// behind it. What makes it worth having is the checks an auditor would run
// anyway, run continuously:
//
//   - a review date that has passed
//   - two effective versions of the same code
//   - a chain where the superseded predecessor is still marked effective
//   - a procedure in the binder that nothing executes, and a process the
//     binder never approved — drift between the rules and the system
//
// Pure over plain rows so it is testable without a database.

export type IsoStatus = "DRAFT" | "EFFECTIVE" | "SUPERSEDED" | "WITHDRAWN";

export interface IsoDocRow {
  id: string;
  code: string;
  title: string;
  version: string;
  status: IsoStatus;
  effectiveAt: Date | null;
  reviewDueAt: Date | null;
  supersedesId: string | null;
  processTemplateId: string | null;
  kind: string;
}

export interface ProcessRow {
  id: string;
  name: string;
  isoCode: string | null;
}

export type FindingLevel = "warning" | "serious";

export interface Finding {
  level: FindingLevel;
  code: string;
  message: string;
}

export interface RegisterAudit {
  findings: Finding[];
  effective: number;
  overdueReview: number;
}

/**
 * `now` is injected: an audit whose result depends on the wall clock cannot
 * be tested, and this one is read as a compliance statement.
 */
export function auditRegister(
  documents: readonly IsoDocRow[],
  processes: readonly ProcessRow[],
  now: Date,
): RegisterAudit {
  const findings: Finding[] = [];
  const effective = documents.filter((doc) => doc.status === "EFFECTIVE");

  // Review overdue.
  const overdue = effective.filter((doc) => doc.reviewDueAt && doc.reviewDueAt < now);
  for (const doc of overdue) {
    findings.push({
      level: "warning",
      code: doc.code,
      message: `Quá hạn soát xét (${doc.reviewDueAt!.toISOString().slice(0, 10)}).`,
    });
  }

  // Two effective versions of one code — whichever a reader picks, half the
  // company is following the other.
  const byCode = new Map<string, IsoDocRow[]>();
  for (const doc of effective) {
    byCode.set(doc.code, [...(byCode.get(doc.code) ?? []), doc]);
  }
  for (const [code, docs] of byCode) {
    if (docs.length > 1) {
      findings.push({
        level: "serious",
        code,
        message: `Có ${docs.length} phiên bản cùng hiệu lực (${docs
          .map((doc) => doc.version)
          .join(", ")}).`,
      });
    }
  }

  // A superseded predecessor left effective.
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  for (const doc of documents) {
    if (!doc.supersedesId) continue;
    const previous = byId.get(doc.supersedesId);
    if (!previous) continue;
    if (doc.status === "EFFECTIVE" && previous.status === "EFFECTIVE") {
      findings.push({
        level: "serious",
        code: previous.code,
        message: `Bản ${previous.version} đã bị ${doc.code} v${doc.version} thay thế nhưng vẫn để hiệu lực.`,
      });
    }
  }

  // Drift between the binder and the system, in both directions.
  const registeredProcedureCodes = new Set(
    documents.filter((doc) => doc.kind === "QUY_TRINH").map((doc) => doc.code),
  );
  const linkedTemplateIds = new Set(
    documents.map((doc) => doc.processTemplateId).filter((id): id is string => Boolean(id)),
  );

  for (const process of processes) {
    if (linkedTemplateIds.has(process.id)) continue;
    if (process.isoCode && registeredProcedureCodes.has(process.isoCode)) continue;
    findings.push({
      level: "warning",
      code: process.isoCode ?? process.name,
      message: "Quy trình đang chạy nhưng không có tài liệu ISO nào tương ứng.",
    });
  }

  const runnableCodes = new Set(
    processes.map((process) => process.isoCode).filter((code): code is string => Boolean(code)),
  );
  for (const doc of effective) {
    if (doc.kind !== "QUY_TRINH") continue;
    if (doc.processTemplateId || runnableCodes.has(doc.code)) continue;
    findings.push({
      level: "warning",
      code: doc.code,
      message: "Quy trình trong danh mục nhưng chưa có quy trình chạy được trên hệ thống.",
    });
  }

  return { findings, effective: effective.length, overdueReview: overdue.length };
}
