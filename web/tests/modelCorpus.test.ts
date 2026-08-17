// Bộ model chuẩn KT/KC/MEP + file lỗi — viewer/parser phải nhai được model
// thật và KHÔNG CHẾT với file hỏng (kết quả rỗng có kiểm soát, không crash).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseIfc } from "../src/ifc/parseIfc";
import {
  groupInstances,
  meshBytes,
  parseRealGeometry,
} from "../src/ifc/realGeometry";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", "ifc", name), "utf8");

describe("bộ model chuẩn", () => {
  it("KT: 2 tường + quantities đọc được từ cả hai bộ đọc", async () => {
    const plain = parseIfc(fixture("KT.ifc"));
    expect(plain.elements.length).toBe(2);
    expect(
      plain.elements.some((e) => e.properties?.["Qto_WallBaseQuantities.NetSideArea"] === 26.4),
    ).toBe(true);
    const real = await parseRealGeometry(fixture("KT.ifc"));
    expect(real.elements.length).toBe(2);
    expect(real.meshes.length).toBeGreaterThan(0);
  });

  it("KC: 6 cột LẶP gom về một nhóm instancing (1 geometry + 6 ma trận)", async () => {
    const real = await parseRealGeometry(fixture("KC.ifc"));
    expect(real.elements.length).toBe(6);
    const groups = groupInstances(real.meshes);
    // 6 cột cùng geometryId + cùng màu → đúng MỘT nhóm với 6 instance.
    expect(groups.length).toBe(1);
    expect(groups[0].matrices.length).toBe(6);
    // instancing tiết kiệm thật: bytes nhóm << bytes 6 bản sao
    expect(meshBytes([groups[0].template])).toBeLessThan(meshBytes(real.meshes));
  });

  it("MEP: 2 đoạn ống IFCFLOWSEGMENT vào được cả AABB lẫn mesh", async () => {
    const real = await parseRealGeometry(fixture("MEP.ifc"));
    expect(real.elements.length).toBe(2);
    expect(real.elements.every((e) => e.ifcType.includes("FLOWSEGMENT"))).toBe(true);
  });
});

describe("file lỗi — chết có kiểm soát, không crash", () => {
  it("file cụt bị chặn NHANH trước cửa WASM (web-ifc từng quay 18s)", async () => {
    const started = Date.now();
    await expect(parseRealGeometry(fixture("broken-truncated.ifc"))).rejects.toThrow(/cụt/);
    expect(Date.now() - started).toBeLessThan(2000);
  });


  for (const name of [
    "broken-truncated.ifc",
    "broken-empty.ifc",
    "broken-not-ifc.ifc",
    "broken-no-data.ifc",
  ]) {
    it(`${name}: parseIfc trả kết quả rỗng hoặc throw Error thường`, async () => {
      let plainOutcome: string;
      try {
        const parsed = parseIfc(fixture(name));
        plainOutcome = `elements=${parsed.elements.length}`;
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        plainOutcome = "threw";
      }
      expect(plainOutcome).toBeTruthy();

      let realOutcome: string;
      try {
        const real = await parseRealGeometry(fixture(name));
        realOutcome = `meshes=${real.meshes.length}`;
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        realOutcome = "threw";
      }
      expect(realOutcome).toBeTruthy();
    });
  }
});
