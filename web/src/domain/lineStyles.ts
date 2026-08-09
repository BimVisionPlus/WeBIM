// Port of webim/domain/graphics/line_styles.py — keep behaviour identical.

export const LINE_WEIGHTS_MM = [0.13, 0.18, 0.25, 0.35, 0.5, 0.7] as const;

export interface LinePattern {
  name: string;
  /** Alternating draw/gap lengths in paper millimetres; empty = continuous. */
  segmentsMm: readonly number[];
}

function pattern(name: string, segmentsMm: readonly number[] = []): LinePattern {
  if (segmentsMm.some((segment) => segment <= 0)) {
    throw new Error("Line pattern segments must be greater than zero");
  }
  if (segmentsMm.length % 2 !== 0) {
    throw new Error("Line pattern segments must alternate draw and gap lengths");
  }
  return { name, segmentsMm };
}

export const LINE_PATTERNS: ReadonlyMap<string, LinePattern> = new Map([
  ["CONTINUOUS", pattern("Continuous")],
  ["DASHED", pattern("Dashed", [3.0, 2.0])],
  ["DOTTED", pattern("Dotted", [0.5, 1.5])],
  ["DASH_DOT", pattern("Dash Dot", [6.0, 2.0, 0.5, 2.0])],
  ["CENTER", pattern("Center", [12.5, 3.0, 3.0, 3.0])],
  ["HIDDEN", pattern("Hidden", [4.0, 2.0])],
]);

export function validateLineStyle(patternId: string, weightMm: number): void {
  if (!LINE_PATTERNS.has(patternId)) {
    throw new Error(`Unknown line pattern: ${patternId}`);
  }
  if (!LINE_WEIGHTS_MM.includes(weightMm as (typeof LINE_WEIGHTS_MM)[number])) {
    throw new Error(`Unsupported line weight: ${weightMm} mm`);
  }
}

/** Convert millimetres on paper to metres in model space. */
export function paperMmToModelUnits(paperMm: number, viewScale: number): number {
  if (paperMm < 0) {
    throw new Error("Paper length cannot be negative");
  }
  if (viewScale <= 0) {
    throw new Error("View scale denominator must be greater than zero");
  }
  return (paperMm * viewScale) / 1000;
}

/** Visible distances along a line for a paper-space pattern. */
export function dashSpans(
  length: number,
  linePattern: LinePattern,
  viewScale: number,
): Array<[number, number]> {
  if (length <= 0) {
    throw new Error("Line length must be greater than zero");
  }
  if (linePattern.segmentsMm.length === 0) {
    return [[0, length]];
  }
  const cycle = linePattern.segmentsMm.map((value) => paperMmToModelUnits(value, viewScale));
  const spans: Array<[number, number]> = [];
  let distance = 0;
  let index = 0;
  while (distance < length) {
    const segmentEnd = Math.min(distance + cycle[index], length);
    if (index % 2 === 0 && segmentEnd > distance) {
      spans.push([distance, segmentEnd]);
    }
    distance = segmentEnd;
    index = (index + 1) % cycle.length;
  }
  return spans;
}
