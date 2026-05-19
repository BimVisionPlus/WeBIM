import { describe, it, expect } from "vitest";
import { ncrWorkflow } from "../src/ncr";
import { canTransition } from "../src/types";

describe("NCR workflow (NĐ 06/2021 Điều 12)", () => {
  it("starts in DRAFT", () => {
    expect(ncrWorkflow.initial).toBe("DRAFT");
  });

  it("rejects unknown transitions", () => {
    const r = canTransition(ncrWorkflow, "DRAFT", "CLOSED", {
      userId: "u1",
      orgRoles: ["TU_VAN_GIAM_SAT"],
      isAdmin: true,
    });
    expect(r.ok).toBe(false);
  });

  it("has terminal CLOSED state", () => {
    expect(ncrWorkflow.terminal).toContain("CLOSED");
  });
});
