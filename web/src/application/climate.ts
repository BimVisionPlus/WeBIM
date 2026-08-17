// Microclimate / solar-orientation analysis from the native model.
//
// Preliminary envelope screening in the spirit of QCVN 09:2017/BXD:
// per-orientation façade and glazing areas and window-to-wall ratios,
// with shading guidance tuned to Vietnam's hot-humid climate (east and
// especially west façades take the heaviest radiation). This is an
// early-design screen, NOT an OTTV/energy calculation — the UI says so.
//
// Orientation convention: +Y is North. Each wall's exterior face is the
// footprint-normal pointing away from the centroid of all wall
// midpoints — a heuristic that is exact for perimeter walls of convex
// plans and reasonable elsewhere.

import type { NativeBimProject, WallDatum } from "../domain/project";

export const ORIENTATIONS = [
  "Bắc",
  "Đông Bắc",
  "Đông",
  "Đông Nam",
  "Nam",
  "Tây Nam",
  "Tây",
  "Tây Bắc",
] as const;

export type Orientation = (typeof ORIENTATIONS)[number];

export interface FacadeRow {
  orientation: Orientation;
  wallCount: number;
  /** Gross façade area, m² (length × height). */
  wallArea: number;
  windowArea: number;
  doorArea: number;
  /** Window-to-wall ratio (0 when no façade area). */
  wwr: number;
}

export interface ClimateFinding {
  severity: "info" | "warning";
  text: string;
}

/** Compass sector of a plan normal vector, +Y = North. */
export function compassSector(normalX: number, normalY: number): Orientation {
  const bearing = (Math.atan2(normalX, normalY) * 180) / Math.PI;
  const index = Math.round(((bearing + 360) % 360) / 45) % 8;
  return ORIENTATIONS[index];
}

/** The wall's exterior-face normal: points away from the plan centroid. */
export function exteriorNormal(
  wall: WallDatum,
  centroid: [number, number],
): [number, number] {
  const directionX = wall.end[0] - wall.start[0];
  const directionY = wall.end[1] - wall.start[1];
  const length = Math.hypot(directionX, directionY) || 1;
  const normalX = -directionY / length;
  const normalY = directionX / length;
  const midX = (wall.start[0] + wall.end[0]) / 2;
  const midY = (wall.start[1] + wall.end[1]) / 2;
  const outward =
    normalX * (midX - centroid[0]) + normalY * (midY - centroid[1]) >= 0;
  return outward ? [normalX, normalY] : [-normalX, -normalY];
}

export function facadeByOrientation(project: NativeBimProject): FacadeRow[] {
  const walls = project.walls;
  if (walls.length === 0) return [];
  let centroidX = 0;
  let centroidY = 0;
  for (const wall of walls) {
    centroidX += (wall.start[0] + wall.end[0]) / 2;
    centroidY += (wall.start[1] + wall.end[1]) / 2;
  }
  const centroid: [number, number] = [
    centroidX / walls.length,
    centroidY / walls.length,
  ];

  const rows = new Map<Orientation, FacadeRow>();
  for (const wall of walls) {
    const [normalX, normalY] = exteriorNormal(wall, centroid);
    const orientation = compassSector(normalX, normalY);
    const length = Math.hypot(
      wall.end[0] - wall.start[0],
      wall.end[1] - wall.start[1],
    );
    const row =
      rows.get(orientation) ??
      ({
        orientation,
        wallCount: 0,
        wallArea: 0,
        windowArea: 0,
        doorArea: 0,
        wwr: 0,
      } as FacadeRow);
    row.wallCount += 1;
    row.wallArea += length * wall.height;
    for (const opening of wall.openings) {
      const area = opening.width * opening.height;
      if (opening.kind === "WINDOW") row.windowArea += area;
      else row.doorArea += area;
    }
    rows.set(orientation, row);
  }
  for (const row of rows.values()) {
    row.wwr = row.wallArea > 0 ? row.windowArea / row.wallArea : 0;
  }
  return ORIENTATIONS.filter((orientation) => rows.has(orientation)).map(
    (orientation) => rows.get(orientation)!,
  );
}

/** Screening guidance for Vietnam's hot-humid climate. */
export function climateFindings(rows: FacadeRow[]): ClimateFinding[] {
  const findings: ClimateFinding[] = [];
  if (rows.length === 0) {
    return [{ severity: "info", text: "Chưa có tường để phân tích." }];
  }
  const totalWall = rows.reduce((sum, row) => sum + row.wallArea, 0);
  const totalWindow = rows.reduce((sum, row) => sum + row.windowArea, 0);
  const overall = totalWall > 0 ? totalWindow / totalWall : 0;
  findings.push({
    severity: "info",
    text: `WWR toàn công trình: ${(overall * 100).toFixed(1)}% (kính ${totalWindow.toFixed(1)} m² / mặt đứng ${totalWall.toFixed(1)} m²).`,
  });

  const WEST_FACING: Orientation[] = ["Tây", "Tây Nam", "Tây Bắc"];
  for (const row of rows) {
    if (WEST_FACING.includes(row.orientation) && row.wwr > 0.3) {
      findings.push({
        severity: "warning",
        text: `Hướng ${row.orientation}: WWR ${(row.wwr * 100).toFixed(1)}% > 30% — bức xạ chiều lớn nhất ở khí hậu Việt Nam; khuyến nghị che nắng ngang/chớp đứng hoặc giảm diện tích kính (định hướng OTTV theo QCVN 09:2017/BXD).`,
      });
    }
    if (row.orientation === "Đông" && row.wwr > 0.4) {
      findings.push({
        severity: "warning",
        text: `Hướng Đông: WWR ${(row.wwr * 100).toFixed(1)}% > 40% — cân nhắc che nắng buổi sáng.`,
      });
    }
    if (row.wwr > 0.6) {
      findings.push({
        severity: "warning",
        text: `Hướng ${row.orientation}: WWR ${(row.wwr * 100).toFixed(1)}% > 60% — vượt ngưỡng sàng lọc cho mọi hướng; cần tính OTTV đầy đủ.`,
      });
    }
  }
  if (findings.every((finding) => finding.severity === "info")) {
    findings.push({
      severity: "info",
      text: "Không hướng nào vượt ngưỡng sàng lọc WWR — vẫn cần kiểm tra OTTV khi công trình thuộc phạm vi QCVN 09:2017/BXD.",
    });
  }
  return findings;
}

// ── OTTV ước tính theo QCVN 09:2017/BXD ──────────────────────────────────
//
// OTTV (Overall Thermal Transfer Value) là chỉ tiêu vỏ bao che của QCVN
// 09:2017/BXD — công trình thuộc phạm vi phải có OTTV tường ≤ 60 W/m².
// Bản ước tính này dùng công thức rút gọn ba thành phần:
//
//   OTTV = (Aw·Uw·TDeq + Af·Uf·ΔT + Af·SC·ESM·SF) / (Aw + Af)
//
// với hệ số MẶC ĐỊNH khai báo rõ (U tường, U kính, SHGC, bức xạ theo
// hướng cho khí hậu VN). Model chưa có lớp vật liệu kính/tường thật, nên
// đây là SÀNG LỌC phương án — đổi kính, đổi WWR thấy OTTV đổi — không
// phải hồ sơ thẩm tra. UI phải nói câu đó.

export interface OttvAssumptions {
  /** U-value tường (W/m²K) — tường gạch trát hai mặt chưa cách nhiệt. */
  wallU: number;
  /** Chênh nhiệt tương đương qua tường đặc (K). */
  wallTdeq: number;
  /** U-value kính (W/m²K) — kính đơn phổ thông. */
  glassU: number;
  /** Chênh nhiệt qua kính (K). */
  glassDt: number;
  /** SHGC kính (kính đơn ~0.85; Low-E ~0.4). */
  shgc: number;
  /** Bức xạ mặt trời trung bình theo hướng (W/m²) — vĩ độ VN. */
  solarByOrientation: Record<Orientation, number>;
}

export const DEFAULT_OTTV_ASSUMPTIONS: OttvAssumptions = {
  wallU: 2.5,
  wallTdeq: 12,
  glassU: 5.8,
  glassDt: 5,
  shgc: 0.85,
  solarByOrientation: {
    "Bắc": 80, "Đông Bắc": 110, "Đông": 150, "Đông Nam": 130,
    "Nam": 100, "Tây Nam": 150, "Tây": 190, "Tây Bắc": 130,
  },
};

export interface OttvRow {
  orientation: Orientation;
  ottv: number;
  grossArea: number;
}

export interface OttvResult {
  rows: OttvRow[];
  /** OTTV trung bình trọng số theo diện tích — con số so với ngưỡng 60. */
  overall: number;
  limit: number;
  pass: boolean;
}

/** OTTV ước tính từ bảng mặt đứng theo hướng (facadeByOrientation). */
export function estimateOttv(
  rows: FacadeRow[],
  assumptions: OttvAssumptions = DEFAULT_OTTV_ASSUMPTIONS,
): OttvResult | null {
  const out: OttvRow[] = [];
  let weighted = 0;
  let total = 0;
  for (const row of rows) {
    const glassArea = row.windowArea;
    const opaqueArea = Math.max(0, row.wallArea - row.windowArea - row.doorArea);
    const gross = opaqueArea + glassArea;
    if (gross <= 0) continue;
    const conductionWalls = opaqueArea * assumptions.wallU * assumptions.wallTdeq;
    const conductionGlass = glassArea * assumptions.glassU * assumptions.glassDt;
    const solar =
      glassArea * assumptions.shgc * assumptions.solarByOrientation[row.orientation];
    const ottv = (conductionWalls + conductionGlass + solar) / gross;
    out.push({ orientation: row.orientation, ottv, grossArea: gross });
    weighted += ottv * gross;
    total += gross;
  }
  if (total === 0) return null;
  const overall = weighted / total;
  return { rows: out, overall, limit: 60, pass: overall <= 60 };
}
