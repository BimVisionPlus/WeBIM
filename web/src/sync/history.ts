// Lịch sử phiên và undo/redo AN TOÀN TRONG CỘNG TÁC.
//
// Undo kiểu snapshot ("quay cả dự án về trạng thái trước") là sai ngay khi có
// người thứ hai: nó hoàn tác cả những gì đồng nghiệp vừa làm trong lúc mình
// gõ Ctrl+Z. Kiến trúc sync của WeBIM vốn là LWW theo TỪNG PHẦN TỬ, nên undo
// đúng của nó cũng phải theo từng phần tử:
//
//   - Mỗi commit cục bộ ghi lại các phần tử ĐÃ ĐỔI, kèm trạng thái trước và
//     sau (JSON từng phần tử — đúng đơn vị mà sync đã dùng).
//   - Undo áp trạng-thái-trước trở lại, NHƯNG chỉ cho phần tử mà trạng thái
//     hiện tại vẫn đúng bằng trạng-thái-sau của bước đó. Phần tử đã bị người
//     khác sửa tiếp thì bỏ qua và ĐẾM RA — hoàn tác của tôi không được phép
//     nuốt chỉnh sửa mới hơn của người khác, và việc bỏ qua phải được nói ra
//     chứ không lặng lẽ.
//   - Undo tự nó là một chỉnh sửa: nó commit và broadcast như mọi thao tác,
//     nên các máy khác nhận nó qua đúng đường sync thường.
//
// Toàn bộ ở đây là hàm thuần trên ProjectDict — store gọi, test kiểm.

import {
  collectElements,
  META_ID,
  SYNCED_COLLECTIONS,
  type ElementRecord,
  type ProjectDict,
} from "./syncEngine";

/** Một phần tử trong một bước: trạng thái trước và sau (null = không tồn tại). */
export interface ElementPatch {
  id: string;
  collection: string;
  before: string | null;
  after: string | null;
}

export interface UndoEntry {
  label: string;
  at: string;
  patches: ElementPatch[];
}

export interface HistoryItem {
  at: string;
  label: string;
  /** Số phần tử chạm tới. */
  count: number;
  kind: "local" | "remote" | "undo" | "redo";
}

/** So hai snapshot phần tử → danh sách patch trước/sau. */
export function diffElements(
  previous: Map<string, ElementRecord>,
  next: Map<string, ElementRecord>,
): ElementPatch[] {
  const patches: ElementPatch[] = [];
  for (const [id, record] of next) {
    const before = previous.get(id);
    if (before?.json !== record.json) {
      patches.push({
        id,
        collection: record.collection,
        before: before?.json ?? null,
        after: record.json,
      });
    }
  }
  for (const [id, record] of previous) {
    if (!next.has(id)) {
      patches.push({ id, collection: record.collection, before: record.json, after: null });
    }
  }
  return patches;
}

export interface ApplyResult {
  project: ProjectDict;
  /** Patch đã áp — trở thành entry redo (đảo trước/sau). */
  applied: ElementPatch[];
  /** Patch bị bỏ qua vì phần tử đã bị sửa tiếp sau bước này. */
  skipped: ElementPatch[];
}

/**
 * Áp chiều "trước" của một bước lên dự án hiện tại.
 *
 * Điều kiện áp từng patch: trạng thái hiện tại của phần tử phải đúng bằng
 * `after` của bước — tức là chưa ai chạm vào nó kể từ đó. Sai điều kiện thì
 * patch vào danh sách skipped, phần tử giữ nguyên.
 */
export function applyUndo(project: ProjectDict, entry: UndoEntry): ApplyResult {
  const current = collectElements(project);
  const applied: ElementPatch[] = [];
  const skipped: ElementPatch[] = [];
  const wanted = new Map<string, { collection: string; json: string | null }>();

  for (const patch of entry.patches) {
    const now = current.get(patch.id)?.json ?? null;
    if (now !== patch.after) {
      skipped.push(patch);
      continue;
    }
    applied.push(patch);
    wanted.set(patch.id, { collection: patch.collection, json: patch.before });
  }

  if (applied.length === 0) {
    return { project, applied, skipped };
  }

  // Dựng lại dict: meta trước, rồi từng collection — giữ thứ tự dòng hiện
  // có, phần tử khôi phục mà hiện không còn thì nối vào cuối collection.
  const metaPatch = wanted.get(META_ID);
  let result: ProjectDict;
  if (metaPatch && metaPatch.json) {
    const restoredMeta = JSON.parse(metaPatch.json) as ProjectDict;
    result = { ...restoredMeta };
  } else {
    const meta = { ...project };
    for (const collection of SYNCED_COLLECTIONS) delete meta[collection];
    result = meta;
  }

  for (const collection of SYNCED_COLLECTIONS) {
    const rows: unknown[] = [];
    for (const row of (project[collection] as { id: string }[]) ?? []) {
      const change = wanted.get(row.id);
      if (change === undefined) {
        rows.push(row);
      } else if (change.json !== null) {
        rows.push(JSON.parse(change.json));
      }
      // change.json === null → phần tử bị xoá bởi undo: bỏ dòng.
    }
    for (const [id, change] of wanted) {
      if (id === META_ID || change.collection !== collection || change.json === null) continue;
      if (!rows.some((row) => (row as { id: string }).id === id)) {
        rows.push(JSON.parse(change.json));
      }
    }
    result[collection] = rows;
  }

  return { project: result, applied, skipped };
}

/** Entry redo = các patch đã áp, đảo chiều trước/sau. */
export function invert(entry: UndoEntry, applied: ElementPatch[]): UndoEntry {
  return {
    label: entry.label,
    at: entry.at,
    patches: applied.map((patch) => ({
      id: patch.id,
      collection: patch.collection,
      before: patch.after,
      after: patch.before,
    })),
  };
}
