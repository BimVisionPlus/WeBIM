// The matrix decides which of the engine's findings reach a coordination
// meeting, so the risk is not a missed overlap — it is a hidden one.
import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import type { ClashItem } from "../src/application/clash";
import {
  applyMatrix,
  clashSystems,
  DEFAULT_TOLERANCE_M,
  modelIndex,
  pairKey,
  ruleFor,
  systemsOf,
} from "../src/application/clashMatrix";

const item = (over: Partial<ClashItem> = {}): ClashItem => ({
  aId: "w1",
  aName: "Wall W1",
  bId: "w2",
  bName: "Wall W2",
  kind: "WALL_WALL",
  depth: 0.05,
  ...over,
});

const noModels = () => undefined;

describe("pairKey", () => {
  it("is order-independent, so a cell cannot be set twice with two values", () => {
    expect(pairKey("B", "A")).toBe(pairKey("A", "B"));
  });
});

describe("ruleFor", () => {
  it("defaults to checking everything at 1 mm", () => {
    expect(ruleFor({}, "A", "B")).toEqual({ enabled: true, toleranceM: DEFAULT_TOLERANCE_M });
  });
});

describe("applyMatrix", () => {
  it("keeps everything when nothing has been configured", () => {
    const result = applyMatrix([item(), item({ depth: 0.2 })], {}, noModels);
    expect(result.kept).toHaveLength(2);
    expect(result.suppressedByRule).toBe(0);
  });

  it("drops a pair whose cell is off, and says how many", () => {
    const matrix = { [pairKey("NATIVE_WALL", "NATIVE_WALL")]: { enabled: false, toleranceM: 0.001 } };
    const result = applyMatrix([item(), item()], matrix, noModels);
    expect(result.kept).toHaveLength(0);
    expect(result.suppressedByRule).toBe(2);
  });

  it("applies the cell's own tolerance, not a global one", () => {
    const matrix = { [pairKey("NATIVE_WALL", "NATIVE_SLAB")]: { enabled: true, toleranceM: 0.05 } };
    const shallow = item({ kind: "WALL_SLAB", depth: 0.04 });
    const deep = item({ kind: "WALL_SLAB", depth: 0.06 });
    const result = applyMatrix([shallow, deep], matrix, noModels);
    expect(result.kept).toEqual([deep]);
    expect(result.suppressedByTolerance).toBe(1);
  });

  it("leaves other pairs alone when one cell is off", () => {
    const matrix = { [pairKey("NATIVE_WALL", "NATIVE_WALL")]: { enabled: false, toleranceM: 0.001 } };
    const wallSlab = item({ kind: "WALL_SLAB" });
    expect(applyMatrix([item(), wallSlab], matrix, noModels).kept).toEqual([wallSlab]);
  });

  /** Hiding what it could not classify is how a matrix loses a real clash. */
  it("keeps an item whose systems it cannot resolve, and counts it", () => {
    const orphan = item({ kind: "NATIVE_IFC", bId: "unknown-element" });
    const result = applyMatrix([orphan], {}, noModels);
    expect(result.kept).toEqual([orphan]);
    expect(result.unclassified).toBe(1);
  });
});

describe("systemsOf", () => {
  it("routes a linked element to its own model's system", () => {
    const lookup = modelIndex([
      { name: "KC.ifc", elements: [{ name: "Beam-1" }] as never },
    ]);
    expect(systemsOf(item({ kind: "NATIVE_IFC", bId: "Beam-1" }), lookup)).toEqual([
      "NATIVE_WALL",
      "IFC:KC.ifc",
    ]);
  });

  it("does not let a name in two models flip between them", () => {
    const lookup = modelIndex([
      { name: "KC.ifc", elements: [{ name: "Dup" }] as never },
      { name: "MEP.ifc", elements: [{ name: "Dup" }] as never },
    ]);
    expect(lookup("Dup")).toBe("KC.ifc");
  });
});

describe("clashSystems", () => {
  it("only offers systems the project actually has", () => {
    const empty = NativeBimProject.create("P", "S", "B", "L1");
    expect(clashSystems(empty, [])).toEqual([]);

    empty.addLevel("L1", 0);
    empty.addWall([0, 0, 0], [4, 0, 0]);
    expect(clashSystems(empty, ["KC.ifc"]).map((s) => s.id)).toEqual([
      "NATIVE_WALL",
      "IFC:KC.ifc",
    ]);
  });
});

describe("persistence", () => {
  it("travels with the project, so a team shares one matrix", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.clashMatrix[pairKey("NATIVE_WALL", "NATIVE_SLAB")] = {
      enabled: false,
      toleranceM: 0.05,
    };
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(ruleFor(reloaded.clashMatrix, "NATIVE_SLAB", "NATIVE_WALL")).toEqual({
      enabled: false,
      toleranceM: 0.05,
    });
  });

  /** An untouched matrix must not change the bytes older tooling reads. */
  it("is absent from the JSON until someone changes a cell", () => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    expect(project.toDict()).not.toHaveProperty("clash_matrix");
    project.clashMatrix[pairKey("A", "B")] = { enabled: false, toleranceM: 0 };
    expect(project.toDict()).toHaveProperty("clash_matrix");
  });

  it("reads a half-written cell as enabled rather than silently muting it", () => {
    const raw = JSON.stringify({
      ...NativeBimProject.create("P", "S", "B", "L1").toDict(),
      clash_matrix: { "A|B": {} },
    });
    expect(ruleFor(NativeBimProject.fromJson(raw).clashMatrix, "A", "B")).toEqual({
      enabled: true,
      toleranceM: 0.001,
    });
  });
});

describe("va chạm giữa hai model IFC link (phối hợp bộ môn)", () => {
  it("crossModelClashes bắt cặp KT×KC chồng nhau, bỏ qua chạm mép", async () => {
    const { crossModelClashes } = await import("../src/application/clash");
    const kt = {
      name: "KT.ifc",
      elements: [
        { name: "Tuong KT", ifcType: "IFCWALL", globalId: "g1",
          min: [0, 0, 0] as [number, number, number], max: [4, 0.2, 3] as [number, number, number] },
      ],
    };
    const kc = {
      name: "KC.ifc",
      elements: [
        { name: "Dam KC", ifcType: "IFCBEAM", globalId: "g2",
          min: [1, 0.1, 2.5] as [number, number, number], max: [3, 0.3, 2.9] as [number, number, number] },
        { name: "Cot xa", ifcType: "IFCCOLUMN", globalId: "g3",
          min: [10, 10, 0] as [number, number, number], max: [10.4, 10.4, 3] as [number, number, number] },
      ],
    };
    const clashes = crossModelClashes([kt, kc]);
    expect(clashes).toHaveLength(1);
    expect(clashes[0].kind).toBe("IFC_IFC");
    expect(clashes[0].aName).toContain("KT.ifc");
    expect(clashes[0].bName).toContain("KC.ifc");
  });

  it("systemsOf xếp IFC_IFC vào đúng hai hệ IFC:<model> để ma trận lọc được", async () => {
    const { systemsOf } = await import("../src/application/clashMatrix");
    const systems = systemsOf(
      { aId: "KT.ifc:g1", aName: "x", bId: "KC.ifc:g2", bName: "y", kind: "IFC_IFC", depth: 0.1 },
      () => undefined,
    );
    expect(systems).toEqual(["IFC:KT.ifc", "IFC:KC.ifc"]);
  });
});
