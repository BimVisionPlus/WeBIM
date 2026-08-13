// IMPORT IFC — đưa phần tử của file IFC vào model native để sửa được.
//
// Điều phải nói trước, vì nó quyết định toàn bộ thiết kế của tệp này: bộ đọc
// IFC của WeBIM (`ifc/parseIfc.ts`) chỉ dựng được **hộp bao** (AABB) của mỗi
// phần tử, từ thân SweptSolid. Nó không đọc mặt cong, không đọc BooleanResult,
// không giữ lỗ mở, không giữ vật liệu theo lớp.
//
// Nên import trung thực là: mỗi phần tử IFC thành một **khối** — vì thứ đọc
// được đúng là một cái hộp. Biến nó thành tường sẽ là bịa: bịa ra trục tường,
// bịa ra chiều dày, bịa ra lỗ mở đã mất. Khối thì nói đúng cái nó là — một
// hình để nghiên cứu, có thể sửa, không giả vờ là cấu kiện đã thiết kế.
//
// Muốn giữ hình học thật thì đường đúng là **link** file (Check va chạm) chứ
// không phải import: link giữ nguyên file gốc và dùng nó ở mức AABB cho việc
// nó làm được, thay vì nuốt nó vào một mô hình nghèo hơn.

import type { LinkedElement } from "../ifc/parseIfc";

export interface ImportCandidate {
  element: LinkedElement;
  ifcType: string;
  footprintM2: number;
  heightM: number;
}

export interface ImportPlan {
  /** Phần tử dựng được thành khối. */
  candidates: ImportCandidate[];
  /** Phần tử có hộp bao suy biến — không dựng được khối nào có nghĩa. */
  degenerate: LinkedElement[];
  /** Số phần tử theo từng IfcType, để chọn nhập cái gì. */
  byType: { ifcType: string; count: number }[];
}

const MIN_EXTENT_M = 0.001;

export function planImport(elements: readonly LinkedElement[]): ImportPlan {
  const candidates: ImportCandidate[] = [];
  const degenerate: LinkedElement[] = [];

  for (const element of elements) {
    const dx = element.max[0] - element.min[0];
    const dy = element.max[1] - element.min[1];
    const dz = element.max[2] - element.min[2];
    if (dx < MIN_EXTENT_M || dy < MIN_EXTENT_M || dz < MIN_EXTENT_M) {
      // Một hộp dẹt tuyệt đối không đùn ra khối nào — đếm và nói, đừng lặng lẽ bỏ.
      degenerate.push(element);
      continue;
    }
    candidates.push({
      element,
      ifcType: element.ifcType,
      footprintM2: dx * dy,
      heightM: dz,
    });
  }

  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    counts.set(candidate.ifcType, (counts.get(candidate.ifcType) ?? 0) + 1);
  }

  return {
    candidates,
    degenerate,
    byType: [...counts.entries()]
      .map(([ifcType, count]) => ({ ifcType, count }))
      .sort((a, b) => b.count - a.count || a.ifcType.localeCompare(b.ifcType)),
  };
}

export interface MassSpec {
  name: string;
  outline: [number, number][];
  height: number;
}

/** Hộp bao → mặt bằng chữ nhật + chiều cao, đúng thứ đọc được. */
export function massSpec(candidate: ImportCandidate): MassSpec {
  const [minX, minY] = candidate.element.min;
  const [maxX, maxY] = candidate.element.max;
  return {
    name: candidate.element.name || candidate.ifcType,
    outline: [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ],
    height: candidate.heightM,
  };
}

export function specsForTypes(
  plan: ImportPlan,
  types: ReadonlySet<string>,
): MassSpec[] {
  return plan.candidates
    .filter((candidate) => types.has(candidate.ifcType))
    .map(massSpec);
}
