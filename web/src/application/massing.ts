// Số liệu của khối nghiên cứu — "box khối" ở bước phương án.
//
// Ở giai đoạn này câu hỏi không phải "bao nhiêu m³ bê tông" mà "được bao nhiêu
// m² sàn, và có vượt mật độ không". Nên các số ở đây là *ước lượng của khối*,
// không phải khối lượng thi công — và tệp này nói rõ điều đó thay vì để người
// đọc tưởng nhầm là takeoff.

import type { MassDatum, NativeBimProject } from "../domain/project";
import { outlineArea } from "./schedules";

export interface MassRow {
  mass: MassDatum;
  footprintM2: number;
  /** Diện tích sàn quy đổi = diện tích chân × số tầng. */
  floorAreaM2: number;
  volumeM3: number;
  storeyHeightM: number;
}

export interface MassSummary {
  count: number;
  footprintM2: number;
  floorAreaM2: number;
  volumeM3: number;
}

export function massRow(mass: MassDatum): MassRow {
  const footprintM2 = Math.abs(outlineArea(mass.outline));
  return {
    mass,
    footprintM2,
    floorAreaM2: footprintM2 * mass.storeys,
    volumeM3: footprintM2 * mass.height,
    storeyHeightM: mass.storeys > 0 ? mass.height / mass.storeys : mass.height,
  };
}

export function massRows(project: NativeBimProject): MassRow[] {
  return project.masses.map(massRow);
}

export function massSummary(project: NativeBimProject): MassSummary {
  const rows = massRows(project);
  return {
    count: rows.length,
    footprintM2: rows.reduce((sum, row) => sum + row.footprintM2, 0),
    floorAreaM2: rows.reduce((sum, row) => sum + row.floorAreaM2, 0),
    volumeM3: rows.reduce((sum, row) => sum + row.volumeM3, 0),
  };
}

/**
 * Mật độ xây dựng = tổng diện tích chân khối / diện tích lô, theo phần trăm.
 * Trả null khi chưa nhập diện tích lô — một mật độ tính trên số 0 không phải
 * "0%", nó là không tính được.
 */
export function siteCoverage(
  project: NativeBimProject,
  siteAreaM2: number,
): number | null {
  if (!Number.isFinite(siteAreaM2) || siteAreaM2 <= 0) return null;
  return (massSummary(project).footprintM2 / siteAreaM2) * 100;
}

/** Hệ số sử dụng đất = tổng sàn quy đổi / diện tích lô. */
export function floorAreaRatio(
  project: NativeBimProject,
  siteAreaM2: number,
): number | null {
  if (!Number.isFinite(siteAreaM2) || siteAreaM2 <= 0) return null;
  return massSummary(project).floorAreaM2 / siteAreaM2;
}
