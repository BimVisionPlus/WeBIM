// Diff hai bản vẽ — pixel thuần, ba màu ba nghĩa, thống kê nói mức thay đổi.

import { describe, expect, it } from "vitest";
import { blendDiff, measure, scaleFromCalibration } from "../src/application/pdfDiff";

/** Bitmap 2×2 RGBA từ danh sách 'mực' (true = nét đen). */
function bitmap(ink: boolean[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(ink.length * 4);
  ink.forEach((isInk, i) => {
    const v = isInk ? 0 : 255;
    out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
  });
  return out;
}

describe("blendDiff", () => {
  it("cũ-riêng đỏ, mới-riêng xanh, chung xám, nền trắng — đếm đúng", () => {
    const oldPage = bitmap([true, true, false, false]);
    const newPage = bitmap([true, false, true, false]);
    const out = new Uint8ClampedArray(16);
    const stats = blendDiff(oldPage, newPage, out);
    expect(stats).toEqual({ unchanged: 1, removed: 1, added: 1 });
    expect([out[0], out[1], out[2]]).toEqual([176, 180, 188]); // chung: xám
    expect(out[4]).toBe(224); // cũ-riêng: đỏ
    expect(out[10]).toBe(255); // mới-riêng: xanh (kênh B)
    expect([out[12], out[13], out[14]]).toEqual([255, 255, 255]); // nền
  });

  it("pixel trong suốt là giấy, không phải mực", () => {
    const transparent = new Uint8ClampedArray([0, 0, 0, 0]);
    const ink = bitmap([true]);
    const out = new Uint8ClampedArray(4);
    const stats = blendDiff(transparent, ink, out);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(0);
  });
});

describe("đo có calibrate", () => {
  it("calibrate 100px = 5m → đoạn 40px = 2m", () => {
    const scale = scaleFromCalibration(100, 5);
    expect(scale).toBe(0.05);
    expect(measure([0, 0], [40, 0], scale!)).toBeCloseTo(2);
    expect(measure([0, 0], [30, 40], scale!)).toBeCloseTo(2.5); // 3-4-5
  });

  it("calibrate rác (0 px, số âm) trả null thay vì chia cho 0", () => {
    expect(scaleFromCalibration(0, 5)).toBeNull();
    expect(scaleFromCalibration(100, -1)).toBeNull();
  });
});
