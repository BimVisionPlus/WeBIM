// Đường thoát nạn thật — quãng đường ĐI ĐƯỢC, không phải đường chim bay.
//
// Đây là phần "3" còn lại của module PCCC: cự ly trước nay đo đường thẳng từ
// góc phòng tới cửa, và màn hình phải tự thú "phòng đạt vẫn có thể trượt khi
// vẽ đường thoát thật". Tệp này vẽ đường thoát thật: mặt bằng được rát thành
// lưới, tường chặn ô (trừ khoảng cửa đi), rồi Dijkstra đa nguồn từ các lối ra
// cho ra trường khoảng cách — chỗ xa nhất trong phòng là ô có giá trị lớn
// nhất. Cửa mở vào hành lang thì cộng thêm đoạn đi dọc hành lang tới lối ra
// kế tiếp, đúng chữ "khoảng cách dọc theo lối đi" của 3.2.5 d).
//
// Sai số của lưới nghiêng về phía AN TOÀN: khoảng cách 8 hướng dài hơn đường
// thẳng tối ưu tối đa ~8%, và tường được nở thêm nửa ô để vách 110 không bị
// "lọt khe" giữa hai tâm ô. Ước lượng dài hơn thực tế một chút nghĩa là sàng
// lọc ngặt hơn một chút — chiều sai đúng cho một công cụ an toàn cháy.
//
// Vẫn chưa mô hình hoá: buồng thang bộ và giới hạn chịu lửa của cấu kiện.
// Caveat trên màn hình thu lại đúng còn hai điều đó.

import type { NativeBimProject, RoomDatum } from "../domain/project";
// Chỉ import TYPE từ pccc — pccc import ngược lại tệp này lúc chạy, nên mọi
// import giá trị ở đây sẽ tạo vòng phụ thuộc thật. Type bị xoá khi biên dịch.
import type { Exit } from "./pccc";

/** Ray-cast chẵn/lẻ — bản riêng để không kéo vòng import với pccc. */
function pointInPolygon(point: [number, number], polygon: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Cạnh ô lưới, mét. 0,15 m đủ mịn cho cửa 0,8 m (5 ô ngang) mà vẫn nhẹ. */
const DEFAULT_CELL_M = 0.15;
/** Trần số ô — vượt thì tự nới ô to ra thay vì treo trình duyệt. */
const MAX_CELLS = 1_200_000;
/** Biên đệm quanh nội dung, mét. */
const PAD_M = 1.0;

export interface EscapeGrid {
  minX: number;
  minY: number;
  cell: number;
  cols: number;
  rows: number;
  /** 1 = tường chặn. */
  blocked: Uint8Array;
}

interface WallBand {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  half: number;
  /** Khoảng cửa đi dọc theo trục tường: [from, to] mét tính từ đầu tường. */
  doorSpans: [number, number][];
  length: number;
}

function wallBands(project: NativeBimProject, levelId: string): WallBand[] {
  const bands: WallBand[] = [];
  for (const wall of project.walls) {
    if (wall.levelId !== levelId) continue;
    const [x1, y1] = wall.start;
    const [x2, y2] = wall.end;
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length === 0) continue;
    bands.push({
      x1,
      y1,
      x2,
      y2,
      half: wall.thickness / 2,
      length,
      // Chỉ cửa ĐI xuyên được tường khi thoát nạn. Cửa sổ không phải lối ra
      // (3.2.13 gọi đó là lối ra khẩn cấp, không tính vào thoát nạn).
      doorSpans: wall.openings
        .filter((opening) => opening.kind === "DOOR")
        .map((opening) => [
          opening.offset - opening.width / 2,
          opening.offset + opening.width / 2,
        ]),
    });
  }
  return bands;
}

/**
 * Lưới vật cản của một cao độ. null khi cao độ trống — lúc đó đường thẳng là
 * ước lượng duy nhất còn lại và người gọi phải nói rõ điều đó.
 */
export function buildEscapeGrid(
  project: NativeBimProject,
  levelId: string,
  cellM = DEFAULT_CELL_M,
): EscapeGrid | null {
  const bands = wallBands(project, levelId);
  const rooms = project.rooms.filter((room) => room.levelId === levelId);
  if (bands.length === 0 && rooms.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const band of bands) {
    minX = Math.min(minX, band.x1, band.x2);
    maxX = Math.max(maxX, band.x1, band.x2);
    minY = Math.min(minY, band.y1, band.y2);
    maxY = Math.max(maxY, band.y1, band.y2);
  }
  for (const room of rooms) {
    for (const [x, y] of room.outline) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  minX -= PAD_M;
  minY -= PAD_M;
  maxX += PAD_M;
  maxY += PAD_M;

  let cell = cellM;
  let cols = Math.ceil((maxX - minX) / cell);
  let rows = Math.ceil((maxY - minY) / cell);
  while (cols * rows > MAX_CELLS) {
    cell *= 2;
    cols = Math.ceil((maxX - minX) / cell);
    rows = Math.ceil((maxY - minY) / cell);
  }

  const blocked = new Uint8Array(cols * rows);

  for (const band of bands) {
    const ux = (band.x2 - band.x1) / band.length;
    const uy = (band.y2 - band.y1) / band.length;
    // Nở nửa ô: tường mỏng hơn bước lưới vẫn phải chặn được một dải ô liền.
    const reach = band.half + cell * 0.5;
    const bMinX = Math.min(band.x1, band.x2) - reach;
    const bMaxX = Math.max(band.x1, band.x2) + reach;
    const bMinY = Math.min(band.y1, band.y2) - reach;
    const bMaxY = Math.max(band.y1, band.y2) + reach;
    const c0 = Math.max(0, Math.floor((bMinX - minX) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((bMaxX - minX) / cell));
    const r0 = Math.max(0, Math.floor((bMinY - minY) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((bMaxY - minY) / cell));

    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const px = minX + (c + 0.5) * cell;
        const py = minY + (r + 0.5) * cell;
        // Chiếu điểm lên trục tường.
        const along = (px - band.x1) * ux + (py - band.y1) * uy;
        const clamped = Math.max(0, Math.min(band.length, along));
        const cx = band.x1 + clamped * ux;
        const cy = band.y1 + clamped * uy;
        const perp = Math.hypot(px - cx, py - cy);
        if (perp > reach) continue;
        // Trong khoảng cửa đi thì để hở — cộng thêm một ô mỗi bên theo trục
        // tường để lối qua cửa rộng ít nhất một dải ô liên tục.
        const inDoor = band.doorSpans.some(
          ([from, to]) => along >= from - cell * 0.5 && along <= to + cell * 0.5,
        );
        if (!inDoor) blocked[r * cols + c] = 1;
      }
    }
  }

  return { minX, minY, cell, cols, rows, blocked };
}

const SQRT2 = Math.SQRT2;

/**
 * Trường khoảng cách Dijkstra đa nguồn trên lưới, 8 hướng, cấm cắt góc
 * (không đi chéo lách qua khe giữa hai ô chặn — người thật không đi xuyên
 * mép tường được).
 */
export function distanceField(
  grid: EscapeGrid,
  seeds: { at: [number, number]; extraM: number }[],
): Float64Array {
  const { cols, rows, cell, blocked } = grid;
  const dist = new Float64Array(cols * rows).fill(Infinity);

  // Heap nhị phân tối giản — mảng chỉ số + so theo dist.
  const heap: number[] = [];
  const push = (index: number) => {
    heap.push(index);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (dist[heap[parent]] <= dist[heap[i]]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = (): number | undefined => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0 && last !== undefined) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < heap.length && dist[heap[l]] < dist[heap[smallest]]) smallest = l;
        if (r < heap.length && dist[heap[r]] < dist[heap[smallest]]) smallest = r;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };

  for (const seed of seeds) {
    const c = Math.round((seed.at[0] - grid.minX) / cell - 0.5);
    const r = Math.round((seed.at[1] - grid.minY) / cell - 0.5);
    // Tâm cửa nằm giữa dải tường; ô đã được cửa khoét hở. Nếu lệch nửa ô thì
    // tìm ô đi được gần nhất trong bán kính 2 ô — cửa hẹp đến đâu cũng phủ.
    let found = -1;
    outer: for (let radius = 0; radius <= 2; radius += 1) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        for (let dc = -radius; dc <= radius; dc += 1) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          if (!blocked[rr * cols + cc]) {
            found = rr * cols + cc;
            break outer;
          }
        }
      }
    }
    if (found === -1) continue;
    if (seed.extraM < dist[found]) {
      dist[found] = seed.extraM;
      push(found);
    }
  }

  while (heap.length > 0) {
    const index = pop();
    if (index === undefined) break;
    const r = Math.floor(index / cols);
    const c = index % cols;
    const base = dist[index];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const next = rr * cols + cc;
        if (blocked[next]) continue;
        // Cấm cắt góc: đi chéo chỉ khi cả hai ô kề trực giao đều thoáng.
        if (dr !== 0 && dc !== 0) {
          if (blocked[r * cols + cc] || blocked[rr * cols + c]) continue;
        }
        const step = dr !== 0 && dc !== 0 ? cell * SQRT2 : cell;
        if (base + step < dist[next]) {
          dist[next] = base + step;
          push(next);
        }
      }
    }
  }

  return dist;
}

export interface RoutedResult {
  /** Chỗ xa nhất trong phòng còn TỚI ĐƯỢC lối ra, mét. null = không đo được. */
  worstM: number | null;
  /** Diện tích trong phòng bị tường chắn, không tới được lối ra nào (m²). */
  unreachableM2: number;
}

/**
 * Cự ly thoát nạn theo đường đi thật cho một phòng.
 *
 * `field` là trường khoảng cách từ các lối ra CỦA PHÒNG (đã cộng đoạn hành
 * lang nếu có). Duyệt mọi ô đi được có tâm nằm trong phòng: giá trị lớn nhất
 * hữu hạn là chỗ xa nhất; ô vô cực là vùng bị tường chắn — một phát hiện
 * riêng, vì "không tới được" nghiêm trọng hơn "xa quá" và không được phép
 * gộp làm một.
 */
export function routedWorstDistance(
  grid: EscapeGrid,
  field: Float64Array,
  room: RoomDatum,
): RoutedResult {
  const { cols, rows, cell, blocked } = grid;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of room.outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const c0 = Math.max(0, Math.floor((minX - grid.minX) / cell));
  const c1 = Math.min(cols - 1, Math.ceil((maxX - grid.minX) / cell));
  const r0 = Math.max(0, Math.floor((minY - grid.minY) / cell));
  const r1 = Math.min(rows - 1, Math.ceil((maxY - grid.minY) / cell));

  let worst = -Infinity;
  let unreachable = 0;
  let sampled = 0;
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const index = r * cols + c;
      if (blocked[index]) continue;
      const px = grid.minX + (c + 0.5) * cell;
      const py = grid.minY + (r + 0.5) * cell;
      if (!pointInPolygon([px, py], room.outline)) continue;
      sampled += 1;
      const d = field[index];
      if (d === Infinity) unreachable += 1;
      else if (d > worst) worst = d;
    }
  }

  if (sampled === 0) return { worstM: null, unreachableM2: 0 };
  return {
    worstM: worst === -Infinity ? null : worst,
    unreachableM2: unreachable * cell * cell,
  };
}

/**
 * Đoạn hành lang: cửa phòng mở vào hành lang thì quãng thoát nạn chưa dừng ở
 * cửa — còn đi dọc hành lang tới lối ra kế tiếp. Trả về mét cộng thêm cho
 * từng lối ra (0 khi cửa không mở vào hành lang nào, hoặc hành lang không có
 * lối ra nào khác để đi tiếp).
 */
export function corridorLegs(
  project: NativeBimProject,
  levelId: string,
  grid: EscapeGrid,
  allExits: readonly Exit[],
  exitsForRoomFn: (room: RoomDatum, exits: readonly Exit[]) => Exit[],
): Map<string, number> {
  const legs = new Map<string, number>();
  const corridors = project.rooms.filter(
    (room) => room.levelId === levelId && room.usage === "HANH_LANG",
  );
  for (const corridor of corridors) {
    const corridorExits = exitsForRoomFn(corridor, allExits);
    if (corridorExits.length < 2) continue;
    for (const entry of corridorExits) {
      // Trường khoảng cách từ MỌI lối ra khác của hành lang → giá trị tại
      // cửa `entry` là quãng ngắn nhất đi tiếp được.
      const others = corridorExits.filter((exit) => exit.openingId !== entry.openingId);
      const field = distanceField(
        grid,
        others.map((exit) => ({ at: exit.at, extraM: 0 })),
      );
      const c = Math.round((entry.at[0] - grid.minX) / grid.cell - 0.5);
      const r = Math.round((entry.at[1] - grid.minY) / grid.cell - 0.5);
      let best = Infinity;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= grid.rows || cc >= grid.cols) continue;
          best = Math.min(best, field[rr * grid.cols + cc]);
        }
      }
      if (Number.isFinite(best)) {
        // Một cửa có thể là lối của nhiều phòng — giữ đoạn ngắn nhất đã thấy.
        const previous = legs.get(entry.openingId);
        if (previous === undefined || best < previous) legs.set(entry.openingId, best);
      }
    }
  }
  return legs;
}
