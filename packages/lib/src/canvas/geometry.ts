import { z } from "zod";

export const canvasPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

const point = canvasPointSchema;
const line = z.object({ start: point, end: point });

export const markupGeometrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PIN"), point }),
  z.object({ kind: z.literal("RECT"), x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }),
  z.object({ kind: z.literal("CLOUD"), x: z.number().min(0).max(1), y: z.number().min(0).max(1), width: z.number().positive().max(1), height: z.number().positive().max(1) }),
  z.object({ kind: z.literal("ARROW"), ...line.shape }),
  z.object({ kind: z.literal("MEASURE"), ...line.shape }),
  z.object({ kind: z.literal("POLYLINE"), points: z.array(point).min(2).max(2000) }),
  z.object({ kind: z.literal("TEXT"), point, text: z.string().min(1).max(500) }),
]);

export type CanvasPoint = z.infer<typeof canvasPointSchema>;
export type MarkupGeometry = z.infer<typeof markupGeometrySchema>;

export function parseDrawingScale(scale?: string | null): number | null {
  if (!scale) return null;
  const match = scale.trim().match(/^1\s*:\s*([0-9]+(?:[.,][0-9]+)?)$/);
  if (!match) return null;
  const denominator = Number(match[1]!.replace(",", "."));
  return Number.isFinite(denominator) && denominator > 0 ? denominator : null;
}

/** Real-world distance in metres for a normalized two-point measurement. */
export function measurementMetres(
  geometry: Extract<MarkupGeometry, { kind: "MEASURE" }>,
  sheet: { paperWidthMm?: number | null; paperHeightMm?: number | null; scale?: string | null },
): number | null {
  const denominator = parseDrawingScale(sheet.scale);
  if (!denominator || !sheet.paperWidthMm || !sheet.paperHeightMm) return null;
  const dxMm = (geometry.end.x - geometry.start.x) * sheet.paperWidthMm;
  const dyMm = (geometry.end.y - geometry.start.y) * sheet.paperHeightMm;
  return Math.hypot(dxMm, dyMm) * denominator / 1000;
}
