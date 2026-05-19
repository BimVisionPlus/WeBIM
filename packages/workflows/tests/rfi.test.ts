import { describe, it, expect } from "vitest";
import { rfiWorkflow } from "../src/rfi";
import { canTransition, nextStates, isTerminal } from "../src/types";

describe("RFI workflow", () => {
  it("starts in DRAFT", () => {
    expect(rfiWorkflow.initial).toBe("DRAFT");
  });

  it("DRAFT→OPEN allowed for nhà thầu chính", () => {
    const r = canTransition(rfiWorkflow, "DRAFT", "OPEN", {
      userId: "u1",
      orgRoles: ["NHA_THAU_CHINH"],
    });
    expect(r.ok).toBe(true);
  });

  it("DRAFT→OPEN rejected for CĐT (wrong role)", () => {
    const r = canTransition(rfiWorkflow, "DRAFT", "OPEN", {
      userId: "u1",
      orgRoles: ["CHU_DAU_TU"],
    });
    expect(r.ok).toBe(false);
  });

  it("OPEN→ANSWERED requires non-empty answer payload", () => {
    const ok = canTransition(rfiWorkflow, "OPEN", "ANSWERED", {
      userId: "u1",
      orgRoles: ["TU_VAN_THIET_KE"],
    }, { answer: "Cao độ là +36.450" });
    expect(ok.ok).toBe(true);

    const bad = canTransition(rfiWorkflow, "OPEN", "ANSWERED", {
      userId: "u1",
      orgRoles: ["TU_VAN_THIET_KE"],
    }, {});
    expect(bad.ok).toBe(false);
  });

  it("isAdmin bypasses role check", () => {
    const r = canTransition(rfiWorkflow, "DRAFT", "OPEN", {
      userId: "u1",
      orgRoles: [],
      isAdmin: true,
    });
    expect(r.ok).toBe(true);
  });

  it("terminal states have no outgoing transitions", () => {
    expect(isTerminal(rfiWorkflow, "CLOSED")).toBe(true);
    expect(nextStates(rfiWorkflow, "CLOSED")).toHaveLength(0);
  });

  it("disallowed transition is rejected", () => {
    const r = canTransition(rfiWorkflow, "CLOSED", "OPEN", {
      userId: "u1",
      orgRoles: ["NHA_THAU_CHINH"],
      isAdmin: true,
    });
    expect(r.ok).toBe(false);
  });
});
