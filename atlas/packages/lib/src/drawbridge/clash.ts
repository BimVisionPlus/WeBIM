/**
 * DrawBridge — clash detection between BIM elements (axis-aligned bbox).
 *
 * This is a deliberately simple AABB overlap pass that runs in-process. For
 * real BIM models we offload to Forge's model-derivative clash service or an
 * IfcOpenShell worker; the result shape stays the same so the UI doesn't
 * change when the engine swaps.
 *
 * Each bbox is [minX, minY, minZ, maxX, maxY, maxZ].
 */

export type ElementForClash = {
  id: string;
  discipline: string | null | undefined;
  category: string;
  bbox: number[]; // length 6
};

export type ClashHit = {
  aId: string;
  bId: string;
  overlap: number; // m³ overlap volume
  /** 0–100 — relative severity scored vs bigger element's volume */
  severity: number;
  category: "HARD" | "CLEARANCE";
};

function vol(bbox: number[]): number {
  if (bbox.length < 6) return 0;
  const dx = Math.max(0, (bbox[3] ?? 0) - (bbox[0] ?? 0));
  const dy = Math.max(0, (bbox[4] ?? 0) - (bbox[1] ?? 0));
  const dz = Math.max(0, (bbox[5] ?? 0) - (bbox[2] ?? 0));
  return dx * dy * dz;
}

function overlapVolume(a: number[], b: number[]): number {
  if (a.length < 6 || b.length < 6) return 0;
  const dx = Math.max(0, Math.min(a[3]!, b[3]!) - Math.max(a[0]!, b[0]!));
  const dy = Math.max(0, Math.min(a[4]!, b[4]!) - Math.max(a[1]!, b[1]!));
  const dz = Math.max(0, Math.min(a[5]!, b[5]!) - Math.max(a[2]!, b[2]!));
  return dx * dy * dz;
}

/**
 * Naive O(n²) sweep — fine up to a few thousand elements per call. For
 * production-scale models, replace with an R-tree (rbush) keyed by bbox.
 */
export function detectClashes(
  elements: ElementForClash[],
  opts: { crossDisciplineOnly?: boolean; minOverlapM3?: number } = {},
): ClashHit[] {
  const crossOnly = opts.crossDisciplineOnly ?? true;
  const minOverlap = opts.minOverlapM3 ?? 0.001;
  const hits: ClashHit[] = [];

  for (let i = 0; i < elements.length; i++) {
    const a = elements[i]!;
    if (a.bbox.length < 6) continue;
    for (let j = i + 1; j < elements.length; j++) {
      const b = elements[j]!;
      if (b.bbox.length < 6) continue;
      if (crossOnly && a.discipline && b.discipline && a.discipline === b.discipline) continue;

      const ov = overlapVolume(a.bbox, b.bbox);
      if (ov < minOverlap) continue;

      const va = vol(a.bbox);
      const vb = vol(b.bbox);
      const sev = Math.min(100, Math.round((ov / Math.max(va, vb, 1e-6)) * 100));
      hits.push({ aId: a.id, bId: b.id, overlap: ov, severity: sev, category: "HARD" });
    }
  }
  return hits.sort((x, y) => y.severity - x.severity);
}
