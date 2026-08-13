// PCCC — sàng lọc thoát nạn theo QCVN 06:2022/BXD (Sửa đổi 1:2023).
//
// Số liệu ở đây được trích từ bản hợp nhất QCVN 06:2022/BXD + Sửa đổi 1:2023
// (Thông tư 06/2022/TT-BXD; Sửa đổi ban hành theo Thông tư 09/2023/TT-BXD,
// hiệu lực 01/12/2023). Mỗi hằng số ghi rõ điều/bảng nguồn ngay tại chỗ.
//
// Bản trước của tệp này dùng số tự đặt và cấu trúc sai: nó gắn cự ly thoát
// nạn vào *công năng phòng*. Quy chuẩn không làm thế — cự ly phụ thuộc
// **bậc chịu lửa**, **vị trí cửa** (giữa hai lối ra hay hành lang cụt) và
// **mật độ dòng người trên đường thoát nạn**. Công năng chỉ quyết định số
// người (Bảng G.9). Sửa cấu trúc, không chỉ sửa số.
//
// VẪN LÀ SÀNG LỌC, KHÔNG PHẢI THẨM DUYỆT. Cự ly tính theo đường thẳng, không
// phải đường đi thực tế vòng qua vách; buồng thang, hành lang và bậc chịu lửa
// của từng cấu kiện chưa được mô hình hoá.

import {
  DEFAULT_FIRE_SETTINGS,
  type FireGrade,
  type FireSettings,
  type NativeBimProject,
  type RoomDatum,
  type RoomUsage,
} from "../domain/project";
import { outlineArea } from "./schedules";

export { DEFAULT_FIRE_SETTINGS };
export type { FireGrade, FireSettings };

// ─────────────────────────────────────────────────────────────────────────────
// Bảng G.9 — Hệ số không gian sàn (m²/người)
//
// G.3: "Số lượng người lớn nhất trong một gian phòng, một tầng hoặc nhà là số
// lượng người lớn nhất theo thiết kế được duyệt. Khi thiết kế không chỉ rõ giá
// trị này, số lượng người lớn nhất được tính bằng tỉ số giữa diện tích sàn …
// chia cho hệ số không gian sàn (m²/người) quy định tại Bảng G.9."
//
// Vì vậy số người nhập tay luôn thắng bảng — bảng chỉ là đường lui.
// ─────────────────────────────────────────────────────────────────────────────

export interface UsageRule {
  label: string;
  /** Hệ số không gian sàn, m²/người. null = Bảng G.9 không có dòng tương ứng. */
  floorSpaceFactorM2: number | null;
  /** Dòng của Bảng G.9, để đối chiếu lại với văn bản. */
  source: string;
}

export const USAGE_RULES: Record<RoomUsage, UsageRule> = {
  HOI_TRUONG: {
    label: "Hội trường, khiêu vũ, bar, karaoke",
    floorSpaceFactorM2: 1.0,
    source: "Bảng G.9",
  },
  HOP: {
    label: "Phòng họp, phòng đọc, phòng học",
    floorSpaceFactorM2: 1.5,
    source: "Bảng G.9",
  },
  AN_UONG: {
    label: "Phòng ăn, căng-tin",
    floorSpaceFactorM2: 1.5,
    source: "Bảng G.9",
  },
  TRIEN_LAM: {
    label: "Triển lãm",
    floorSpaceFactorM2: 1.5,
    source: "Bảng G.9",
  },
  SANH: {
    label: "Sảnh, khu tiếp đón",
    floorSpaceFactorM2: 3.0,
    source: "Bảng G.9",
  },
  THUONG_MAI: {
    label: "Chợ, TTTM, siêu thị",
    floorSpaceFactorM2: 3.0,
    source: "Bảng G.9",
  },
  BAO_TANG: {
    label: "Bảo tàng",
    floorSpaceFactorM2: 5.0,
    source: "Bảng G.9",
  },
  VAN_PHONG: {
    label: "Văn phòng",
    floorSpaceFactorM2: 6.0,
    source: "Bảng G.9",
  },
  BEP: {
    label: "Bếp, thư viện",
    floorSpaceFactorM2: 7.0,
    source: "Bảng G.9",
  },
  O: {
    label: "Phòng ngủ",
    floorSpaceFactorM2: 8.0,
    source: "Bảng G.9",
  },
  PHONG_KHACH: {
    label: "Phòng khách",
    floorSpaceFactorM2: 10.0,
    source: "Bảng G.9",
  },
  KHO: {
    label: "Kho, nơi chứa đồ",
    floorSpaceFactorM2: 30.0,
    source: "Bảng G.9",
  },
  DE_XE: {
    // Bảng G.9 ghi nhà để xe theo *2 người trên một ô đỗ*, không theo m²/người.
    // WeBIM chưa có khái niệm ô đỗ, nên quy đổi ra diện tích ở đây là bịa.
    label: "Nhà để xe",
    floorSpaceFactorM2: null,
    source: "Bảng G.9 tính 2 người/ô đỗ — nhập số người theo số ô",
  },
  KY_THUAT: {
    // Bảng G.9 không có dòng cho phòng kỹ thuật. Đoán một hệ số ở đây là bịa;
    // để null và buộc nhập số người nếu phòng có người làm việc.
    label: "Phòng kỹ thuật",
    floorSpaceFactorM2: null,
    source: "Bảng G.9 không có dòng tương ứng",
  },
  HANH_LANG: {
    // CHÚ THÍCH của G.3: diện tích sàn không kể cầu thang bộ, thang máy, khu
    // vệ sinh và các phần phụ trợ khác.
    label: "Hành lang, lối đi",
    floorSpaceFactorM2: null,
    source: "G.3 — không tính vào diện tích sàn",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Chiều rộng lối ra thoát nạn
// ─────────────────────────────────────────────────────────────────────────────

/**
 * G.2.1.1 — định mức người thoát nạn trên 1 m chiều rộng lối ra, theo bậc
 * chịu lửa. Đây là *sức chứa*: chiều rộng cần = số người / định mức.
 */
export const PEOPLE_PER_METRE: Record<FireGrade, number> = {
  I: 165,
  II: 165,
  III: 115,
  IV: 115,
  V: 80,
};

/**
 * 3.2.5 c) — gian phòng có mặt đồng thời từ 50 người trở lên phải có không ít
 * hơn hai lối ra thoát nạn.
 */
export const TWO_EXITS_ABOVE = 50;
/**
 * 3.2.5 d) — gian phòng dưới 50 người vẫn phải có hai lối ra nếu khoảng cách
 * dọc lối đi từ chỗ xa nhất tới lối ra vượt quá 25 m.
 */
export const TWO_EXITS_BEYOND_M = 25;

/** 3.2.9 — chiều rộng thông thuỷ tối thiểu của lối ra thoát nạn. */
export const MIN_WIDTH_M = 0.8;
export const MIN_WIDTH_CROWDED_M = 1.2;
/** 3.2.9 — ngưỡng người khiến tối thiểu nâng lên 1,2 m (trừ nhóm F1.3). */
export const CROWDED_THRESHOLD = 50;
/** 3.2.9 — chiều cao thông thuỷ tối thiểu. */
export const MIN_CLEAR_HEIGHT_M = 1.9;

/**
 * Chiều rộng lối ra thoát nạn cần cho `occupancy` người.
 * G.2.1.1 (sức chứa theo bậc chịu lửa) kết hợp 3.2.9 (mức sàn tuyệt đối).
 */
export function requiredExitWidthM(
  occupancy: number,
  settings: FireSettings,
): number {
  if (occupancy <= 0) return 0;
  const byCapacity = occupancy / PEOPLE_PER_METRE[settings.grade];
  const floor =
    occupancy > CROWDED_THRESHOLD && settings.group !== "F1.3"
      ? MIN_WIDTH_CROWDED_M
      : MIN_WIDTH_M;
  return Math.max(byCapacity, floor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cự ly giới hạn tới lối ra thoát nạn gần nhất
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bảng G.1 — nhà ở (F1.2, F1.3): từ cửa căn hộ/phòng ở tới lối ra gần nhất.
 * Khoá theo bậc chịu lửa + cấp nguy hiểm cháy kết cấu.
 * Giá trị: [giữa hai buồng thang / lối ra ngoài, hành lang cụt].
 */
const TABLE_G1: Record<string, [number, number]> = {
  "I|S0": [40, 25],
  "II|S0": [40, 25],
  "II|S1": [30, 20],
  "III|S0": [30, 20],
  "III|S1": [25, 15],
  "IV|S0": [25, 15],
  "IV|S1": [20, 10],
  "IV|S2": [20, 10],
  "V|S0": [20, 10],
  "V|S1": [20, 10],
  "V|S2": [20, 10],
  "V|S3": [20, 10],
};

/**
 * Bảng G.2a — nhà công cộng, theo bậc chịu lửa × mật độ dòng người.
 * Cột: ≤2 · >2–3 · >3–4 · >4–5 · >5 (người/m²).
 */
const TABLE_G2A = {
  betweenExits: {
    "I,II,III": [60, 50, 40, 35, 20],
    IV: [40, 35, 30, 25, 15],
    V: [30, 25, 20, 15, 10],
  },
  deadEnd: {
    "I,II,III": [30, 25, 20, 15, 10],
    IV: [20, 15, 15, 10, 7],
    V: [15, 10, 10, 5, 5],
  },
} as const;

/**
 * Bảng G.2a has no column for zero or negative mật độ dòng người, and the
 * naive `<= 2` test hands those the *first* column — the loosest limit in the
 * table. A screening tool must not turn a typo into permission, so anything
 * outside the table falls to the strictest column instead.
 */
function densityColumn(flowDensity: number): number {
  if (!Number.isFinite(flowDensity) || flowDensity <= 0) return 4;
  if (flowDensity <= 2) return 0;
  if (flowDensity <= 3) return 1;
  if (flowDensity <= 4) return 2;
  if (flowDensity <= 5) return 3;
  return 4;
}

/** True when the flow density is a number Bảng G.2a can actually be read at. */
export function isUsableFlowDensity(flowDensity: number): boolean {
  return Number.isFinite(flowDensity) && flowDensity > 0;
}

function gradeRow(grade: FireGrade): "I,II,III" | "IV" | "V" {
  if (grade === "IV") return "IV";
  if (grade === "V") return "V";
  return "I,II,III";
}

export interface TravelLimit {
  metres: number;
  source: string;
}

/**
 * Cự ly giới hạn cho phép. `deadEnd` = cửa phòng mở vào hành lang cụt hoặc
 * sảnh chung; ngược lại là bố trí giữa hai lối ra.
 *
 * Phòng có từ hai lối ra trở lên được coi là "giữa hai lối ra"; một lối ra
 * đơn độc lấy cột hành lang cụt — hướng an toàn hơn khi chưa mô hình hoá
 * hành lang.
 */
export function travelLimit(settings: FireSettings, exitCount: number): TravelLimit {
  const deadEnd = exitCount < 2;
  if (settings.group === "F1.2" || settings.group === "F1.3") {
    const row = TABLE_G1[`${settings.grade}|${settings.structureClass}`];
    if (!row) {
      return { metres: 20, source: "Bảng G.1 — không có dòng, lấy giá trị nhỏ nhất" };
    }
    return { metres: deadEnd ? row[1] : row[0], source: "Bảng G.1" };
  }
  const table = deadEnd ? TABLE_G2A.deadEnd : TABLE_G2A.betweenExits;
  const metres = table[gradeRow(settings.grade)][densityColumn(settings.flowDensity)];
  return {
    metres,
    source: isUsableFlowDensity(settings.flowDensity)
      ? `Bảng G.2a (bậc ${settings.grade}, mật độ ${settings.flowDensity} người/m²)`
      : `Bảng G.2a (bậc ${settings.grade}, mật độ chưa nhập — lấy cột ngặt nhất)`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hình học
// ─────────────────────────────────────────────────────────────────────────────

export interface Exit {
  openingId: string;
  name: string;
  at: [number, number];
  widthM: number;
}

export function exitsOnLevel(project: NativeBimProject, levelId: string): Exit[] {
  const exits: Exit[] = [];
  for (const wall of project.walls) {
    if (wall.levelId !== levelId) continue;
    const [sx, sy] = wall.start;
    const [ex, ey] = wall.end;
    const length = Math.hypot(ex - sx, ey - sy);
    if (length === 0) continue;
    for (const opening of wall.openings) {
      if (opening.kind !== "DOOR") continue;
      const t = Math.min(Math.max(opening.offset / length, 0), 1);
      exits.push({
        openingId: opening.id,
        name: opening.name,
        at: [sx + (ex - sx) * t, sy + (ey - sy) * t],
        widthM: opening.width,
      });
    }
  }
  return exits;
}

export function roomArea(room: RoomDatum): number {
  return Math.abs(outlineArea(room.outline));
}

export interface Occupancy {
  people: number;
  /** Nguồn: thiết kế duyệt (nhập tay) hay suy ra từ Bảng G.9. */
  from: "thiết kế" | "Bảng G.9" | "không xác định";
}

/** G.3 — thiết kế được duyệt trước, Bảng G.9 chỉ là đường lui. */
export function occupancyOf(room: RoomDatum): Occupancy {
  if (room.occupancyOverride !== null) {
    return { people: room.occupancyOverride, from: "thiết kế" };
  }
  const factor = USAGE_RULES[room.usage]?.floorSpaceFactorM2;
  if (factor === null || factor === undefined || factor <= 0) {
    return { people: 0, from: "không xác định" };
  }
  return { people: Math.ceil(roomArea(room) / factor), from: "Bảng G.9" };
}

function pointInPolygon(point: [number, number], polygon: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > point[1] !== yj > point[1]) {
      const x = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (point[0] < x) inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(
  point: [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

function distanceToOutline(point: [number, number], polygon: readonly [number, number][]): number {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    best = Math.min(best, distanceToSegment(point, polygon[j], polygon[i]));
  }
  return best;
}

export function exitsForRoom(room: RoomDatum, exits: readonly Exit[]): Exit[] {
  return exits.filter(
    (exit) => pointInPolygon(exit.at, room.outline) || distanceToOutline(exit.at, room.outline) <= 0.5,
  );
}

/** Đường chéo lớn nhất của mặt bằng phòng — dùng cho 3.2.8. */
export function largestDiagonalM(room: RoomDatum): number {
  let best = 0;
  for (let i = 0; i < room.outline.length; i += 1) {
    for (let j = i + 1; j < room.outline.length; j += 1) {
      best = Math.max(
        best,
        Math.hypot(room.outline[i][0] - room.outline[j][0], room.outline[i][1] - room.outline[j][1]),
      );
    }
  }
  return best;
}

/**
 * 3.2.8 — hai lối ra phải cách nhau ≥ nửa đường chéo lớn nhất (≥ 1/3 nếu nhà
 * được bảo vệ toàn bộ bằng Sprinkler), và khoảng cách đo giữa hai cạnh xa
 * nhất phải ≥ 7 m.
 *
 * WeBIM ghi cửa như một điểm trên tường nên "hai cạnh xa nhất" được xấp xỉ
 * bằng khoảng cách tâm cộng nửa bề rộng mỗi cửa. Xấp xỉ theo hướng rộng hơn
 * thực tế, nên không tạo ra cảnh báo giả.
 */
export function exitSeparation(
  room: RoomDatum,
  exits: readonly Exit[],
  settings: FireSettings,
): { requiredM: number; actualM: number } | null {
  if (exits.length < 2) return null;
  let actual = 0;
  for (let i = 0; i < exits.length; i += 1) {
    for (let j = i + 1; j < exits.length; j += 1) {
      const centres = Math.hypot(exits[i].at[0] - exits[j].at[0], exits[i].at[1] - exits[j].at[1]);
      actual = Math.max(actual, centres + exits[i].widthM / 2 + exits[j].widthM / 2);
    }
  }
  const diagonal = largestDiagonalM(room);
  const fraction = settings.sprinklered ? 1 / 3 : 1 / 2;
  return { requiredM: Math.max(diagonal * fraction, 7), actualM: actual };
}

export function worstTravelDistance(room: RoomDatum, exits: readonly Exit[]): number | null {
  if (exits.length === 0) return null;
  let worst = 0;
  for (const corner of room.outline) {
    let nearest = Infinity;
    for (const exit of exits) {
      nearest = Math.min(nearest, Math.hypot(corner[0] - exit.at[0], corner[1] - exit.at[1]));
    }
    worst = Math.max(worst, nearest);
  }
  return worst;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface RoomFinding {
  level: "warning" | "serious";
  message: string;
  /** Điều/bảng của quy chuẩn, để người đọc tra ngược. */
  clause: string;
}

export interface RoomEgress {
  room: RoomDatum;
  areaM2: number;
  occupancy: Occupancy;
  exits: Exit[];
  travelM: number | null;
  limit: TravelLimit;
  requiredWidthM: number;
  availableWidthM: number;
  separation: { requiredM: number; actualM: number } | null;
  findings: RoomFinding[];
}

export function analyseRoom(
  room: RoomDatum,
  allExits: readonly Exit[],
  settings: FireSettings = DEFAULT_FIRE_SETTINGS,
): RoomEgress {
  const exits = exitsForRoom(room, allExits);
  const occupancy = occupancyOf(room);
  const travelM = worstTravelDistance(room, exits);
  const limit = travelLimit(settings, exits.length);
  const availableWidthM = exits.reduce((sum, exit) => sum + exit.widthM, 0);
  const requiredWidthM = requiredExitWidthM(occupancy.people, settings);
  const separation = exitSeparation(room, exits, settings);

  const findings: RoomFinding[] = [];

  if (exits.length === 0) {
    findings.push({
      level: "serious",
      message: "Không có cửa đi nào thuộc phòng này.",
      clause: "3.2.1",
    });
  }

  if (occupancy.from === "không xác định" && roomArea(room) > 0) {
    findings.push({
      level: "warning",
      message: `Bảng G.9 không có hệ số cho công năng này — phải nhập số người theo thiết kế.`,
      clause: "G.3",
    });
  }

  // 3.2.5 c) và d) — số lối ra, tách khỏi cự ly.
  if (exits.length === 1) {
    if (occupancy.people >= TWO_EXITS_ABOVE) {
      findings.push({
        level: "serious",
        message: `${occupancy.people} người nhưng chỉ có một lối ra thoát nạn.`,
        clause: "3.2.5 c)",
      });
    } else if (travelM !== null && travelM > TWO_EXITS_BEYOND_M) {
      findings.push({
        level: "serious",
        message: `Chỗ xa nhất cách lối ra ${travelM.toFixed(1)} m > ${TWO_EXITS_BEYOND_M} m — phòng dưới 50 người vẫn phải có hai lối ra.`,
        clause: "3.2.5 d)",
      });
    }
  }

  if (travelM !== null && travelM > limit.metres) {
    findings.push({
      level: "serious",
      message: `Cự ly trực tiếp ${travelM.toFixed(1)} m > ${limit.metres} m cho phép.`,
      clause: limit.source,
    });
  }

  if (occupancy.people > 0 && availableWidthM + 1e-9 < requiredWidthM) {
    findings.push({
      level: "serious",
      message: `Bề rộng lối ra ${availableWidthM.toFixed(2)} m < ${requiredWidthM.toFixed(2)} m cần cho ${occupancy.people} người.`,
      clause: "G.2.1.1 + 3.2.9",
    });
  }

  if (separation && separation.actualM + 1e-9 < separation.requiredM) {
    findings.push({
      level: "serious",
      message: `Hai lối ra cách nhau ${separation.actualM.toFixed(1)} m < ${separation.requiredM.toFixed(1)} m yêu cầu.`,
      clause: "3.2.8",
    });
  }

  return {
    room,
    areaM2: roomArea(room),
    occupancy,
    exits,
    travelM,
    limit,
    requiredWidthM,
    availableWidthM,
    separation,
    findings,
  };
}

/** Defaults to the project's own fire settings — never to a silent guess. */
export function analyseProject(
  project: NativeBimProject,
  settings: FireSettings = project.fireSettings,
): RoomEgress[] {
  return project.rooms.map((room) =>
    analyseRoom(room, exitsOnLevel(project, room.levelId), settings),
  );
}
