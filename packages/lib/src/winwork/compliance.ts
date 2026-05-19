/**
 * Luật Đấu thầu 22/2023 compliance rules engine.
 *
 * Each rule is a pure function over a bid snapshot: it returns the status
 * (PASS/FAIL/NEEDS_REVIEW/NOT_APPLICABLE) and structured evidence. The
 * caller persists results as BidComplianceCheck rows so an audit trail
 * exists for "the system told you this was failing on YYYY-MM-DD HH:MM".
 *
 * Rules are deliberately small + composable so adding new ones (NĐ 24/2024
 * detail, Thông tư 06/2024 BCT MOIT specifics) is just appending an entry.
 *
 * Sources:
 *   - Luật Đấu thầu 22/2023/QH15
 *   - NĐ 24/2024 (hướng dẫn Luật ĐT) — for thresholds & method picking
 */

export type BidSnapshot = {
  /** Bid identity */
  id: string;
  state: string;
  /** Org submitting bid */
  org: {
    id: string;
    name: string;
    mst: string | null;
  };
  /** Tender opportunity context (may be null if bid was created standalone) */
  opportunity: {
    budgetVnd: bigint | null;
    bidMethod: string | null;
    fundingSource: string | null;
    closingAt: Date | null;
    category: string | null;
    invitorMst: string | null;
  } | null;
  /** Bid economics */
  proposedValueVnd: bigint | null;
  estimatedValueVnd: bigint | null;
  /** Active bid-bond rows (only ACTIVE status) */
  activeBonds: Array<{
    type: "BAO_LANH_DU_THAU" | "BAO_LANH_THUC_HIEN" | "BAO_LANH_TAM_UNG" | "BAO_LANH_BAO_HANH";
    amountVnd: bigint;
    expiresAt: Date;
  }>;
  /** Counts of attached docs by tag (caller groups Attachment.fileName / label) */
  docCounts: {
    /** Hồ sơ năng lực tài chính (báo cáo tài chính 3 năm…) */
    financialCapacity: number;
    /** Hồ sơ kinh nghiệm (hợp đồng tương tự đã thực hiện) */
    experience: number;
    /** Bằng cấp / chứng chỉ nhân sự chủ chốt */
    personnel: number;
    /** Thiết bị thi công đề xuất */
    equipment: number;
    /** Biện pháp tổ chức thi công */
    methodology: number;
    /** Tiến độ thi công */
    schedule: number;
  };
};

export type ComplianceSeverity = "INFO" | "WARNING" | "BLOCKING";
export type ComplianceStatus = "PASS" | "FAIL" | "NOT_APPLICABLE" | "NEEDS_REVIEW";

export type RuleResult = {
  ruleId: string;
  ruleVersion: string;
  ruleTitle: string;
  ruleRef: string;
  severity: ComplianceSeverity;
  status: ComplianceStatus;
  evidence: Record<string, unknown>;
  note?: string;
};

type RuleFn = (bid: BidSnapshot) => RuleResult;

const RULE_VERSION = "LDT-22-2023";

// ─── R1: Bid bond required when budget > 10 tỉ — Luật ĐT 22/2023 Điều 14 k.2
const ruleBidBondRequired: RuleFn = (bid) => {
  const budget = bid.opportunity?.budgetVnd ?? null;
  // Threshold: bid bond is required for any bid (1% – 3% of gói thầu).
  // For "chỉ định thầu" / chào hàng cạnh tranh nhỏ, may be exempted. We mark
  // INFO when bid bond is voluntarily not posted on a < 1 tỉ tender.
  const SMALL_TENDER = 1_000_000_000n;
  const bondAmounts = bid.activeBonds
    .filter((b) => b.type === "BAO_LANH_DU_THAU")
    .reduce((sum, b) => sum + b.amountVnd, 0n);

  if (bondAmounts > 0n) {
    return {
      ruleId: "LDT22-14-1",
      ruleVersion: RULE_VERSION,
      ruleTitle: "Bảo đảm dự thầu (bid bond)",
      ruleRef: "Luật ĐT 22/2023 Điều 14",
      severity: "BLOCKING",
      status: "PASS",
      evidence: { bondAmountVnd: bondAmounts.toString(), budgetVnd: budget?.toString() ?? null },
    };
  }

  if (budget !== null && budget < SMALL_TENDER) {
    return {
      ruleId: "LDT22-14-1",
      ruleVersion: RULE_VERSION,
      ruleTitle: "Bảo đảm dự thầu (bid bond)",
      ruleRef: "Luật ĐT 22/2023 Điều 14",
      severity: "INFO",
      status: "NOT_APPLICABLE",
      evidence: { budgetVnd: budget.toString(), reason: "gói thầu nhỏ < 1 tỉ" },
    };
  }

  return {
    ruleId: "LDT22-14-1",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Bảo đảm dự thầu (bid bond)",
    ruleRef: "Luật ĐT 22/2023 Điều 14",
    severity: "BLOCKING",
    status: "FAIL",
    evidence: { reason: "Chưa có BLDT ACTIVE", budgetVnd: budget?.toString() ?? null },
    note: "Cần bảo lãnh dự thầu (1–3% giá gói thầu) trước khi nộp HSDT.",
  };
};

// ─── R2: Bid bond amount in 1%–3% range of estimated budget — Điều 14 k.4
const ruleBidBondAmountRange: RuleFn = (bid) => {
  const budget = bid.opportunity?.budgetVnd ?? null;
  const bond = bid.activeBonds.find((b) => b.type === "BAO_LANH_DU_THAU");
  if (!bond || !budget || budget === 0n) {
    return {
      ruleId: "LDT22-14-4",
      ruleVersion: RULE_VERSION,
      ruleTitle: "Mức bảo đảm dự thầu (1%–3% giá gói thầu)",
      ruleRef: "Luật ĐT 22/2023 Điều 14 khoản 4",
      severity: "WARNING",
      status: "NOT_APPLICABLE",
      evidence: {},
    };
  }
  // bigint percentage math
  const minBond = (budget * 1n) / 100n;
  const maxBond = (budget * 3n) / 100n;
  const inRange = bond.amountVnd >= minBond && bond.amountVnd <= maxBond;
  return {
    ruleId: "LDT22-14-4",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Mức bảo đảm dự thầu (1%–3% giá gói thầu)",
    ruleRef: "Luật ĐT 22/2023 Điều 14 khoản 4",
    severity: "WARNING",
    status: inRange ? "PASS" : "FAIL",
    evidence: {
      bondVnd: bond.amountVnd.toString(),
      minVnd: minBond.toString(),
      maxVnd: maxBond.toString(),
    },
    note: inRange ? undefined : "Mức BLDT phải nằm trong 1%–3% giá gói thầu.",
  };
};

// ─── R3: Bid bond expiry ≥ tender opening + 30 ngày — Điều 14 k.6
const ruleBidBondExpiry: RuleFn = (bid) => {
  const closing = bid.opportunity?.closingAt ?? null;
  const bond = bid.activeBonds.find((b) => b.type === "BAO_LANH_DU_THAU");
  if (!bond || !closing) {
    return {
      ruleId: "LDT22-14-6",
      ruleVersion: RULE_VERSION,
      ruleTitle: "Hiệu lực BLDT ≥ ngày mở thầu + 30 ngày",
      ruleRef: "Luật ĐT 22/2023 Điều 14 khoản 6",
      severity: "WARNING",
      status: "NOT_APPLICABLE",
      evidence: {},
    };
  }
  const minExpiry = new Date(closing.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ok = bond.expiresAt >= minExpiry;
  return {
    ruleId: "LDT22-14-6",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Hiệu lực BLDT ≥ ngày mở thầu + 30 ngày",
    ruleRef: "Luật ĐT 22/2023 Điều 14 khoản 6",
    severity: "BLOCKING",
    status: ok ? "PASS" : "FAIL",
    evidence: {
      bondExpiresAt: bond.expiresAt.toISOString(),
      requiredAfter: minExpiry.toISOString(),
    },
    note: ok ? undefined : "Gia hạn BLDT để có hiệu lực sau ngày mở thầu ít nhất 30 ngày.",
  };
};

// ─── R4: MST có ─ minimum identity for bidder — Điều 5 k.1
const ruleBidderIdentity: RuleFn = (bid) => {
  const ok = !!bid.org.mst && /^\d{10}(-\d{3})?$/.test(bid.org.mst);
  return {
    ruleId: "LDT22-5-1",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Tư cách hợp lệ nhà thầu (MST)",
    ruleRef: "Luật ĐT 22/2023 Điều 5",
    severity: "BLOCKING",
    status: ok ? "PASS" : "FAIL",
    evidence: { mst: bid.org.mst ?? null },
    note: ok ? undefined : "Tổ chức bên dự thầu phải có MST hợp lệ.",
  };
};

// ─── R5: Conflict of interest — bidder MST ≠ invitor MST — Điều 6
const ruleConflictOfInterest: RuleFn = (bid) => {
  const myMst = bid.org.mst;
  const theirMst = bid.opportunity?.invitorMst ?? null;
  if (!myMst || !theirMst) {
    return {
      ruleId: "LDT22-6-1",
      ruleVersion: RULE_VERSION,
      ruleTitle: "Bảo đảm cạnh tranh trong đấu thầu",
      ruleRef: "Luật ĐT 22/2023 Điều 6",
      severity: "WARNING",
      status: "NEEDS_REVIEW",
      evidence: { myMst, invitorMst: theirMst },
      note: "Thiếu MST bên mời thầu — cần kiểm tra thủ công xung đột lợi ích.",
    };
  }
  const conflict = myMst === theirMst;
  return {
    ruleId: "LDT22-6-1",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Bảo đảm cạnh tranh trong đấu thầu",
    ruleRef: "Luật ĐT 22/2023 Điều 6",
    severity: "BLOCKING",
    status: conflict ? "FAIL" : "PASS",
    evidence: { myMst, invitorMst: theirMst },
    note: conflict ? "Nhà thầu và bên mời thầu cùng MST — vi phạm Điều 6." : undefined,
  };
};

// ─── R6: Hồ sơ năng lực tối thiểu — financial + experience — Điều 9
const ruleCapacityDocs: RuleFn = (bid) => {
  const missing: string[] = [];
  if (bid.docCounts.financialCapacity === 0) missing.push("Báo cáo tài chính / năng lực tài chính");
  if (bid.docCounts.experience === 0) missing.push("Hợp đồng tương tự đã thực hiện");
  if (bid.docCounts.personnel === 0) missing.push("Hồ sơ nhân sự chủ chốt");
  if (bid.docCounts.equipment === 0) missing.push("Thiết bị thi công đề xuất");

  return {
    ruleId: "LDT22-9-1",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Hồ sơ năng lực, kinh nghiệm, nhân sự, thiết bị",
    ruleRef: "Luật ĐT 22/2023 Điều 9",
    severity: "BLOCKING",
    status: missing.length === 0 ? "PASS" : "FAIL",
    evidence: { docCounts: bid.docCounts, missing },
    note: missing.length === 0 ? undefined : `Còn thiếu: ${missing.join(", ")}.`,
  };
};

// ─── R7: Biện pháp + tiến độ — technical proposal completeness — Điều 9 k.2
const ruleTechnicalProposal: RuleFn = (bid) => {
  const missing: string[] = [];
  if (bid.docCounts.methodology === 0) missing.push("Biện pháp tổ chức thi công");
  if (bid.docCounts.schedule === 0) missing.push("Tiến độ thi công");
  return {
    ruleId: "LDT22-9-2",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Đề xuất kỹ thuật & tiến độ",
    ruleRef: "Luật ĐT 22/2023 Điều 9 khoản 2",
    severity: "BLOCKING",
    status: missing.length === 0 ? "PASS" : "FAIL",
    evidence: { missing },
    note: missing.length === 0 ? undefined : `Còn thiếu: ${missing.join(", ")}.`,
  };
};

// ─── R8: Giá dự thầu ≤ giá gói thầu — soft cap, WARN — Điều 43 k.4
const ruleProposedVsBudget: RuleFn = (bid) => {
  const proposed = bid.proposedValueVnd;
  const budget = bid.opportunity?.budgetVnd ?? null;
  if (proposed === null || budget === null) {
    return {
      ruleId: "LDT22-43-4",
      ruleVersion: RULE_VERSION,
      ruleTitle: "Giá dự thầu so với giá gói thầu",
      ruleRef: "Luật ĐT 22/2023 Điều 43 khoản 4",
      severity: "WARNING",
      status: "NOT_APPLICABLE",
      evidence: {},
    };
  }
  const over = proposed > budget;
  return {
    ruleId: "LDT22-43-4",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Giá dự thầu so với giá gói thầu",
    ruleRef: "Luật ĐT 22/2023 Điều 43 khoản 4",
    severity: "WARNING",
    status: over ? "FAIL" : "PASS",
    evidence: {
      proposedVnd: proposed.toString(),
      budgetVnd: budget.toString(),
      deltaPct: budget === 0n ? 0 : Number(((proposed - budget) * 10000n) / budget) / 100,
    },
    note: over ? "Giá dự thầu cao hơn giá gói thầu — khả năng cao bị loại." : undefined,
  };
};

// ─── R9: Margin sanity — không nên < 3% (cảnh báo phá giá) — internal best-practice
const ruleMarginSanity: RuleFn = (bid) => {
  const proposed = bid.proposedValueVnd;
  const estimated = bid.estimatedValueVnd;
  if (proposed === null || estimated === null || estimated === 0n) {
    return {
      ruleId: "ATLAS-MARGIN-1",
      ruleVersion: RULE_VERSION,
      ruleTitle: "Margin tối thiểu (cảnh báo phá giá)",
      ruleRef: "Atlas best-practice",
      severity: "INFO",
      status: "NOT_APPLICABLE",
      evidence: {},
    };
  }
  const marginPct = Number(((proposed - estimated) * 10000n) / estimated) / 100;
  return {
    ruleId: "ATLAS-MARGIN-1",
    ruleVersion: RULE_VERSION,
    ruleTitle: "Margin tối thiểu (cảnh báo phá giá)",
    ruleRef: "Atlas best-practice",
    severity: "WARNING",
    status: marginPct >= 3 ? "PASS" : "FAIL",
    evidence: { marginPct },
    note: marginPct >= 3 ? undefined : `Margin chỉ ${marginPct.toFixed(2)}% — nguy cơ lỗ.`,
  };
};

export const ALL_RULES: RuleFn[] = [
  ruleBidBondRequired,
  ruleBidBondAmountRange,
  ruleBidBondExpiry,
  ruleBidderIdentity,
  ruleConflictOfInterest,
  ruleCapacityDocs,
  ruleTechnicalProposal,
  ruleProposedVsBudget,
  ruleMarginSanity,
];

export function runCompliance(bid: BidSnapshot): RuleResult[] {
  return ALL_RULES.map((rule) => rule(bid));
}

/** True iff no BLOCKING rule is FAIL/NEEDS_REVIEW. Used as a guard on submit. */
export function isComplianceClean(results: RuleResult[]): boolean {
  return !results.some(
    (r) => r.severity === "BLOCKING" && (r.status === "FAIL" || r.status === "NEEDS_REVIEW"),
  );
}

export function summarize(results: RuleResult[]) {
  return {
    total: results.length,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    review: results.filter((r) => r.status === "NEEDS_REVIEW").length,
    na: results.filter((r) => r.status === "NOT_APPLICABLE").length,
    blockingFail: results.filter((r) => r.severity === "BLOCKING" && r.status === "FAIL").length,
    warningFail: results.filter((r) => r.severity === "WARNING" && r.status === "FAIL").length,
  };
}
