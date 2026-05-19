/**
 * CodeGuard runner — evaluate a declarative `check` spec against a payload.
 *
 * A CodeRule may carry a `check` JSON like:
 *   { dimension: "corridor_width_m", op: ">=", value: 1.5 }
 *
 * Callers gather measurements for the target entity (Sheet/Submittal/Acceptance)
 * into a flat `measurements: Record<string, number | string | boolean>` map
 * and call `runRule(rule, measurements)`.
 *
 * Rules without a `check` spec are returned as NEEDS_REVIEW — they still
 * exist in the library and surface in the UI, but require manual verification.
 */

export type CheckSpec =
  | { dimension: string; op: ">=" | "<=" | "==" | ">" | "<"; value: number }
  | { field: string; equals: string | number | boolean }
  | { allOf: CheckSpec[] }
  | { anyOf: CheckSpec[] }
  | Record<string, unknown>; // forward-compatible

export type Measurements = Record<string, number | string | boolean | null | undefined>;

export type RunResult = {
  status: "PASS" | "FAIL" | "NOT_APPLICABLE" | "NEEDS_REVIEW";
  evidence: Record<string, unknown>;
  note?: string;
};

export function runCheck(spec: CheckSpec | undefined | null, m: Measurements): RunResult {
  if (!spec || typeof spec !== "object") {
    return { status: "NEEDS_REVIEW", evidence: { reason: "no_machine_check_spec" } };
  }

  // allOf / anyOf composites
  if ("allOf" in spec && Array.isArray((spec as any).allOf)) {
    const subs = (spec as any).allOf.map((s: CheckSpec) => runCheck(s, m));
    const failed = subs.find((r: RunResult) => r.status === "FAIL");
    if (failed) return { ...failed, evidence: { ...failed.evidence, composite: "allOf" } };
    const review = subs.find((r: RunResult) => r.status === "NEEDS_REVIEW");
    if (review) return review;
    return { status: "PASS", evidence: { composite: "allOf", count: subs.length } };
  }
  if ("anyOf" in spec && Array.isArray((spec as any).anyOf)) {
    const subs = (spec as any).anyOf.map((s: CheckSpec) => runCheck(s, m));
    if (subs.some((r: RunResult) => r.status === "PASS")) {
      return { status: "PASS", evidence: { composite: "anyOf" } };
    }
    if (subs.every((r: RunResult) => r.status === "NEEDS_REVIEW")) {
      return { status: "NEEDS_REVIEW", evidence: { composite: "anyOf" } };
    }
    return { status: "FAIL", evidence: { composite: "anyOf" } };
  }

  if ("dimension" in spec && "op" in spec && "value" in spec) {
    const dim = (spec as any).dimension as string;
    const op = (spec as any).op as ">=" | "<=" | "==" | ">" | "<";
    const expected = (spec as any).value as number;
    const actual = m[dim];
    if (actual === undefined || actual === null) {
      return {
        status: "NEEDS_REVIEW",
        evidence: { dim, op, expected, actual: null },
        note: `Thiếu số đo "${dim}" — cần nhập thủ công.`,
      };
    }
    if (typeof actual !== "number") {
      return { status: "NEEDS_REVIEW", evidence: { dim, actual, reason: "not_a_number" } };
    }
    const ok =
      op === ">=" ? actual >= expected
      : op === "<=" ? actual <= expected
      : op === "==" ? actual === expected
      : op === ">" ? actual > expected
      : actual < expected;
    return {
      status: ok ? "PASS" : "FAIL",
      evidence: { dim, op, expected, actual },
      note: ok ? undefined : `Giá trị ${dim}=${actual} không thoả ${op} ${expected}.`,
    };
  }

  if ("field" in spec && "equals" in spec) {
    const f = (spec as any).field as string;
    const v = (spec as any).equals;
    const actual = m[f];
    if (actual === undefined) return { status: "NEEDS_REVIEW", evidence: { f, expected: v } };
    return {
      status: actual === v ? "PASS" : "FAIL",
      evidence: { f, expected: v, actual },
    };
  }

  return { status: "NEEDS_REVIEW", evidence: { reason: "unrecognized_check_shape" } };
}
