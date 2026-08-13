// Một tổng tiền đang giấu mấy dòng chưa có giá thì tệ hơn là không có tổng
// nào, nên phần lớn các test ở đây là về chỗ nó từ chối trả lời.
import { describe, expect, it } from "vitest";
import { NativeBimProject } from "../src/domain/project";
import { buildDemoProject } from "../src/demo/seedProject";
import {
  DEFAULT_MARKUPS,
  estimate,
  priceProject,
  pricingCsv,
  rateKey,
} from "../src/application/pricing";
import { massRows, massSummary, floorAreaRatio, siteCoverage } from "../src/application/massing";
import { planImport, specsForTypes, massSpec } from "../src/application/ifcImport";

describe("áp đơn giá", () => {
  it("chỉ cộng những dòng đã có đơn giá, và đếm phần chưa có", () => {
    const project = buildDemoProject();
    const all = priceProject(project, {});
    expect(all.rows.length).toBeGreaterThan(0);
    expect(all.subtotal).toBe(0);
    expect(all.uncovered).toHaveLength(all.rows.length);
    expect(all.coverage).toBe(0);

    const first = all.rows[0];
    const priced = priceProject(project, { [first.key]: 1_000_000 });
    expect(priced.rows[0].amount).toBeCloseTo(first.quantity * 1_000_000, 6);
    expect(priced.uncovered).toHaveLength(all.rows.length - 1);
    expect(priced.coverage).toBeCloseTo(1 / all.rows.length, 6);
  });

  /** null, không phải 0 — "chưa nhập giá" khác hẳn "miễn phí". */
  it("để thành tiền là null khi chưa có đơn giá", () => {
    const project = buildDemoProject();
    const result = priceProject(project, {});
    for (const row of result.rows) {
      expect(row.rate).toBeNull();
      expect(row.amount).toBeNull();
    }
  });

  it("bỏ qua đơn giá âm hoặc bằng 0 thay vì nhân ra số vô nghĩa", () => {
    const project = buildDemoProject();
    const key = priceProject(project, {}).rows[0].key;
    for (const bad of [0, -5000, Number.NaN]) {
      const row = priceProject(project, { [key]: bad }).rows[0];
      expect(row.rate).toBeNull();
      expect(row.amount).toBeNull();
    }
  });

  it("cộng dồn đúng thứ tự trực tiếp → chung → TNCT → VAT → dự phòng", () => {
    const sums = estimate(1000, {
      overheadPct: 10,
      profitPct: 5,
      vatPct: 8,
      contingencyPct: 10,
    });
    expect(sums.overhead).toBeCloseTo(100, 6);
    expect(sums.profit).toBeCloseTo(55, 6); // 5% của 1100, không phải của 1000
    expect(sums.beforeVat).toBeCloseTo(1155, 6);
    expect(sums.vat).toBeCloseTo(92.4, 6);
    expect(sums.contingency).toBeCloseTo(124.74, 6); // 10% của (1155 + 92.4)
    expect(sums.total).toBeCloseTo(1372.14, 6);
  });

  it("ghi phần chưa có đơn giá vào CSV chứ không lặng lẽ bỏ", () => {
    const project = buildDemoProject();
    const csv = pricingCsv(priceProject(project, {}), DEFAULT_MARKUPS);
    expect(csv).toContain("CHUA CO DON GIA");
    expect(csv).toContain("TONG");
  });

  it("khoá đơn giá đi theo (hạng mục, vật liệu, đơn vị)", () => {
    expect(rateKey({ category: "Wall", material: "Gạch", unit: "m³" })).toBe("Wall|Gạch|m³");
  });

  it("bộ đơn giá đi cùng dự án qua JSON", () => {
    const project = buildDemoProject();
    project.rates["Wall|Gạch|m³"] = 1_800_000;
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(reloaded.rates["Wall|Gạch|m³"]).toBe(1_800_000);
    expect(NativeBimProject.create("P", "S", "B", "L").toDict()).not.toHaveProperty("rates");
  });
});

describe("box khối", () => {
  const square = (size: number) => {
    const project = NativeBimProject.create("P", "S", "B", "L1");
    project.addLevel("Tầng 1", 0);
    project.addMass(
      [
        [0, 0],
        [size, 0],
        [size, size],
        [0, size],
      ],
      { height: 12, storeys: 4 },
    );
    return project;
  };

  it("quy diện tích sàn theo số tầng, không phải theo chiều cao", () => {
    const [row] = massRows(square(10));
    expect(row.footprintM2).toBeCloseTo(100, 6);
    expect(row.floorAreaM2).toBeCloseTo(400, 6);
    expect(row.volumeM3).toBeCloseTo(1200, 6);
    expect(row.storeyHeightM).toBeCloseTo(3, 6);
  });

  /** Mật độ tính trên lô bằng 0 không phải "0%", nó là không tính được. */
  it("trả null cho mật độ và hệ số khi chưa có diện tích lô", () => {
    const project = square(10);
    for (const bad of [0, -1, Number.NaN]) {
      expect(siteCoverage(project, bad)).toBeNull();
      expect(floorAreaRatio(project, bad)).toBeNull();
    }
    expect(siteCoverage(project, 500)).toBeCloseTo(20, 6);
    expect(floorAreaRatio(project, 500)).toBeCloseTo(0.8, 6);
  });

  it("từ chối chiều cao và số tầng vô nghĩa", () => {
    const project = square(10);
    const id = project.masses[0].id;
    expect(() => project.updateMass(id, { height: 0 })).toThrow("greater than zero");
    expect(() => project.updateMass(id, { storeys: 0 })).toThrow("at least 1");
    expect(() => project.updateMass(id, { storeys: 2.5 })).toThrow("at least 1");
    expect(project.masses[0].height).toBe(12);
  });

  it("giữ cao độ khỏi bị xoá khi còn khối, và round-trip qua JSON", () => {
    const project = square(10);
    const level = project.levels[0];
    expect(() => project.removeLevel(level.id)).toThrow();
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    expect(reloaded.masses).toHaveLength(1);
    expect(massSummary(reloaded).floorAreaM2).toBeCloseTo(400, 6);
    expect(reloaded.toDict()).toEqual(project.toDict());
    expect(NativeBimProject.create("P", "S", "B", "L").toDict()).not.toHaveProperty("masses");
  });
});

describe("import IFC", () => {
  const element = (
    name: string,
    ifcType: string,
    min: [number, number, number],
    max: [number, number, number],
  ) => ({ name, ifcType, min, max });

  it("dựng khối từ hộp bao, giữ đúng kích thước đọc được", () => {
    const plan = planImport([element("W1", "IFCWALL", [0, 0, 0], [4, 0.2, 3])]);
    expect(plan.candidates).toHaveLength(1);
    const spec = massSpec(plan.candidates[0]);
    expect(spec.height).toBeCloseTo(3, 6);
    expect(spec.outline).toEqual([
      [0, 0],
      [4, 0],
      [4, 0.2],
      [0, 0.2],
    ]);
  });

  /** Hộp dẹt tuyệt đối không đùn ra khối nào — phải đếm, không được lặng lẽ bỏ. */
  it("tách riêng phần tử có hộp bao suy biến", () => {
    const plan = planImport([
      element("OK", "IFCSLAB", [0, 0, 0], [5, 5, 0.2]),
      element("Dẹt", "IFCANNOTATION", [0, 0, 1], [5, 5, 1]),
    ]);
    expect(plan.candidates.map((c) => c.element.name)).toEqual(["OK"]);
    expect(plan.degenerate.map((e) => e.name)).toEqual(["Dẹt"]);
  });

  it("đếm theo IfcType và chỉ nhập loại được chọn", () => {
    const plan = planImport([
      element("W1", "IFCWALL", [0, 0, 0], [4, 0.2, 3]),
      element("W2", "IFCWALL", [0, 1, 0], [4, 1.2, 3]),
      element("S1", "IFCSLAB", [0, 0, 0], [5, 5, 0.2]),
    ]);
    expect(plan.byType).toEqual([
      { ifcType: "IFCWALL", count: 2 },
      { ifcType: "IFCSLAB", count: 1 },
    ]);
    expect(specsForTypes(plan, new Set(["IFCSLAB"]))).toHaveLength(1);
    expect(specsForTypes(plan, new Set())).toHaveLength(0);
  });
});

describe("markup trên bản vẽ", () => {
  it("ghi theo tỉ lệ trang và đi cùng dự án", () => {
    const project = buildDemoProject();
    const doc = project.documents[0];
    project.addMarkup(
      doc.id,
      {
        kind: "CLOUD",
        page: 1,
        from: [0.1, 0.2],
        to: [0.4, 0.5],
        text: "",
        color: "#e06c75",
        author: "sophie",
      },
      "2026-08-13T00:00:00.000Z",
    );
    const reloaded = NativeBimProject.fromJson(JSON.stringify(project.toDict()));
    const restored = reloaded.documents.find((d) => d.id === doc.id)!.markups!;
    expect(restored).toHaveLength(1);
    expect(restored[0].from).toEqual([0.1, 0.2]);
    expect(restored[0].page).toBe(1);
    expect(reloaded.toDict()).toEqual(project.toDict());
  });

  it("vắng mặt khỏi JSON cho tới khi có dấu đầu tiên", () => {
    const project = buildDemoProject();
    const dict = project.toDict() as { documents: Record<string, unknown>[] };
    for (const doc of dict.documents) {
      expect(doc).not.toHaveProperty("markups");
    }
  });

  it("xoá được một dấu mà không đụng dấu khác", () => {
    const project = buildDemoProject();
    const doc = project.documents[0];
    const base = {
      kind: "RECT" as const,
      page: 0,
      from: [0, 0] as [number, number],
      to: [1, 1] as [number, number],
      text: "",
      color: "#fff",
      author: "a",
    };
    const first = project.addMarkup(doc.id, base, "t1");
    project.addMarkup(doc.id, base, "t2");
    project.removeMarkup(doc.id, first.id);
    expect(project.documents[0].markups).toHaveLength(1);
    expect(project.documents[0].markups![0].at).toBe("t2");
  });
});
