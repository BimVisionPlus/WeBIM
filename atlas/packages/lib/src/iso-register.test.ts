// The register is read as a compliance statement, so these test the findings
// an auditor would raise — and that a clean register raises none.
import { describe, expect, it } from "vitest";
import { auditRegister, type IsoDocRow, type ProcessRow } from "./iso-register";

const NOW = new Date("2026-08-12T00:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

function doc(over: Partial<IsoDocRow> = {}): IsoDocRow {
  return {
    id: "d1",
    code: "QT-TK-05",
    title: "Phát hành hồ sơ",
    version: "01",
    status: "EFFECTIVE",
    effectiveAt: day(-100),
    reviewDueAt: day(100),
    supersedesId: null,
    processTemplateId: "t1",
    kind: "QUY_TRINH",
    ...over,
  };
}

const process = (over: Partial<ProcessRow> = {}): ProcessRow => ({
  id: "t1",
  name: "Phát hành hồ sơ",
  isoCode: "QT-TK-05",
  ...over,
});

describe("a clean register", () => {
  it("raises nothing", () => {
    const audit = auditRegister([doc()], [process()], NOW);
    expect(audit.findings).toEqual([]);
    expect(audit.effective).toBe(1);
  });
});

describe("review dates", () => {
  it("flags an effective document past its review date", () => {
    const audit = auditRegister([doc({ reviewDueAt: day(-1) })], [process()], NOW);
    expect(audit.overdueReview).toBe(1);
    expect(audit.findings[0].message).toContain("Quá hạn soát xét");
  });

  it("does not chase a withdrawn document", () => {
    const audit = auditRegister(
      [doc({ status: "WITHDRAWN", reviewDueAt: day(-1) })],
      [process()],
      NOW,
    );
    expect(audit.overdueReview).toBe(0);
  });

  it("leaves a document with no review date alone", () => {
    expect(auditRegister([doc({ reviewDueAt: null })], [process()], NOW).findings).toEqual([]);
  });
});

describe("versions", () => {
  /** Whichever version a reader picks, half the company follows the other. */
  it("is serious when two versions of one code are both effective", () => {
    const audit = auditRegister(
      [doc({ id: "a", version: "01" }), doc({ id: "b", version: "02" })],
      [process()],
      NOW,
    );
    const finding = audit.findings.find((f) => f.message.includes("cùng hiệu lực"))!;
    expect(finding.level).toBe("serious");
    expect(finding.message).toContain("01, 02");
  });

  it("is fine when the older version is marked superseded", () => {
    const audit = auditRegister(
      [
        doc({ id: "a", version: "01", status: "SUPERSEDED" }),
        doc({ id: "b", version: "02", supersedesId: "a" }),
      ],
      [process()],
      NOW,
    );
    expect(audit.findings).toEqual([]);
  });

  it("catches a predecessor left effective under its replacement", () => {
    const audit = auditRegister(
      [doc({ id: "a", version: "01" }), doc({ id: "b", version: "02", supersedesId: "a" })],
      [process()],
      NOW,
    );
    expect(audit.findings.some((f) => f.message.includes("vẫn để hiệu lực"))).toBe(true);
  });
});

describe("drift between the binder and the system", () => {
  it("flags a running process with no ISO document", () => {
    const audit = auditRegister([], [process({ isoCode: "QT-XX-99" })], NOW);
    expect(audit.findings).toHaveLength(1);
    expect(audit.findings[0].message).toContain("không có tài liệu ISO");
  });

  it("flags a registered procedure nothing executes", () => {
    const audit = auditRegister([doc({ processTemplateId: null })], [], NOW);
    expect(audit.findings.some((f) => f.message.includes("chưa có quy trình chạy được"))).toBe(true);
  });

  it("accepts a match by code even without an explicit link", () => {
    const audit = auditRegister([doc({ processTemplateId: null })], [process()], NOW);
    expect(audit.findings).toEqual([]);
  });

  /** A form is not something the system runs; asking for one would be noise. */
  it("does not expect a form to be executable", () => {
    const audit = auditRegister(
      [doc({ kind: "BIEU_MAU", code: "BM-TK-05-01", processTemplateId: null })],
      [],
      NOW,
    );
    expect(audit.findings).toEqual([]);
  });
});
