// Quantity take-off: net quantities derived from the native model.
//
// Wall volumes come from the same wallPieces the viewport extrudes, so
// openings are already deducted and mitered/butt ends measured exactly.

import type { NativeBimProject } from "../domain/project";
import { wallPieces } from "./wallGeometry";
import { outlineArea } from "./schedules";

export interface QtoRow {
  element: string;
  category: string;
  material: string;
  unit: string;
  quantity: number;
}

function polygonArea(corners: readonly (readonly [number, number])[]): number {
  return outlineArea(corners as [number, number][]);
}

/** Net wall volume: sum of extruded piece volumes (openings excluded). */
export function wallNetVolume(
  project: NativeBimProject,
  wallId: string,
): number {
  const wall = project.walls.find((candidate) => candidate.id === wallId);
  if (!wall) return 0;
  let volume = 0;
  for (const piece of wallPieces(wall, project.walls)) {
    volume += polygonArea(piece.corners) * (piece.zTop - piece.zBottom);
  }
  return volume;
}

/** Full take-off: walls (net, split by type layers), slabs, openings. */
export function qtoRows(project: NativeBimProject): QtoRow[] {
  const rows: QtoRow[] = [];
  for (const wall of project.walls) {
    const volume = wallNetVolume(project, wall.id);
    const wallType = wall.typeId ? project.wallTypeById(wall.typeId) : null;
    if (wallType && wall.thickness > 0) {
      // Split the net volume across layers by thickness share.
      for (const layer of wallType.layers) {
        rows.push({
          element: wall.name,
          category: "Wall",
          material: layer.material,
          unit: "m³",
          quantity: (volume * layer.thickness) / wall.thickness,
        });
      }
    } else {
      rows.push({
        element: wall.name,
        category: "Wall",
        material: "—",
        unit: "m³",
        quantity: volume,
      });
    }
    for (const opening of wall.openings) {
      rows.push({
        element: opening.name,
        category: opening.kind === "DOOR" ? "Door" : "Window",
        material: "—",
        unit: "pcs",
        quantity: 1,
      });
    }
  }
  for (const slab of project.slabs) {
    rows.push({
      element: slab.name,
      category: slab.kind === "FLOOR" ? "Floor slab" : "Roof slab",
      material: "—",
      unit: "m³",
      quantity: outlineArea(slab.outline) * slab.thickness,
    });
  }
  return rows;
}

/** Aggregate rows by category + material for the summary block. */
export function qtoSummary(rows: QtoRow[]): QtoRow[] {
  const groups = new Map<string, QtoRow>();
  for (const row of rows) {
    const key = `${row.category}|${row.material}|${row.unit}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += row.quantity;
    } else {
      groups.set(key, { ...row, element: "Σ" });
    }
  }
  return [...groups.values()];
}

/** CSV export of the take-off (detail + summary). */
export function qtoCsv(project: NativeBimProject): string {
  const rows = qtoRows(project);
  const lines = ["element,category,material,unit,quantity"];
  for (const row of [...rows, ...qtoSummary(rows)]) {
    lines.push(
      `${row.element},${row.category},${row.material},${row.unit},${row.quantity.toFixed(4)}`,
    );
  }
  return lines.join("\n");
}
