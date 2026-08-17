// So sánh hai phiên bản bản vẽ PDF — kiểu overlay kinh điển của dân bản vẽ:
// nét CHỈ CÓ Ở BẢN CŨ hiện đỏ (đã xoá), nét CHỈ CÓ Ở BẢN MỚI hiện xanh
// (mới thêm), nét giữ nguyên chìm xám nhạt. Một cái nhìn là thấy revision
// này đổi gì — không phải dò hai tờ giấy đặt cạnh nhau.
//
// Thuần pixel (Uint8ClampedArray RGBA) để test không cần canvas thật.

/** Một pixel có "mực" khi đủ tối — bản vẽ là nét đen trên nền trắng. */
const INK_LUMA = 200;

function hasInk(pixels: Uint8ClampedArray, index: number): boolean {
  const r = pixels[index];
  const g = pixels[index + 1];
  const b = pixels[index + 2];
  const alpha = pixels[index + 3];
  if (alpha < 16) return false; // trong suốt = giấy
  return 0.299 * r + 0.587 * g + 0.114 * b < INK_LUMA;
}

export interface DiffStats {
  /** Pixel mực chỉ có ở bản cũ (đã xoá). */
  removed: number;
  /** Pixel mực chỉ có ở bản mới (mới thêm). */
  added: number;
  /** Pixel mực có ở cả hai. */
  unchanged: number;
}

/**
 * Trộn hai bitmap CÙNG KÍCH THƯỚC thành ảnh diff. Ghi kết quả vào buffer
 * `out` (RGBA, cùng kích thước) và trả thống kê — số pixel added/removed
 * là con số nói "revision này đổi nhiều cỡ nào" trước cả khi nhìn.
 */
export function blendDiff(
  oldPixels: Uint8ClampedArray,
  newPixels: Uint8ClampedArray,
  out: Uint8ClampedArray,
): DiffStats {
  const stats: DiffStats = { removed: 0, added: 0, unchanged: 0 };
  for (let index = 0; index < out.length; index += 4) {
    const inkOld = hasInk(oldPixels, index);
    const inkNew = hasInk(newPixels, index);
    if (inkOld && inkNew) {
      out[index] = 176; out[index + 1] = 180; out[index + 2] = 188; out[index + 3] = 255;
      stats.unchanged += 1;
    } else if (inkOld) {
      out[index] = 224; out[index + 1] = 76; out[index + 2] = 76; out[index + 3] = 255;
      stats.removed += 1;
    } else if (inkNew) {
      out[index] = 64; out[index + 1] = 145; out[index + 2] = 255; out[index + 3] = 255;
      stats.added += 1;
    } else {
      out[index] = 255; out[index + 1] = 255; out[index + 2] = 255; out[index + 3] = 255;
    }
  }
  return stats;
}

/**
 * Tỉ lệ đo trên bản vẽ: người dùng CALIBRATE bằng một đoạn đã biết chiều
 * dài thật ("đoạn này là 5 m") — từ đó mọi khoảng cách pixel quy ra mét.
 * Không đoán tỉ lệ từ khung tên: khung tên nói 1:100 nhưng file có thể đã
 * bị scale khi in — đo đoạn thật là nguồn sự thật duy nhất.
 */
export function scaleFromCalibration(
  pixelDistance: number,
  realMetres: number,
): number | null {
  if (!(pixelDistance > 0) || !(realMetres > 0)) return null;
  return realMetres / pixelDistance;
}

export function measure(
  a: [number, number],
  b: [number, number],
  metresPerPixel: number,
): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]) * metresPerPixel;
}
