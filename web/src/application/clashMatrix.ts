// Which systems are checked against which, and how close is too close.
//
// The clash engine finds every geometric overlap; a coordination meeting
// wants a fraction of them. Navisworks calls this the clash matrix: a grid of
// system × system, each cell either off or carrying its own tolerance —
// structure through architecture is a real problem at 5 mm, two ducts in the
// same shaft only at 50 mm, and architecture against itself is usually noise
// you have already accepted.
//
// This wraps `clash.ts` rather than changing it: the engine keeps reporting
// everything, and the matrix decides what survives. That way turning a cell
// back on cannot miss a clash the engine never looked for.

import type { ClashMatrix, ClashRule, NativeBimProject } from "../domain/project";
import type { LinkedElement } from "../ifc/parseIfc";
import type { ClashItem } from "./clash";

/** Native geometry is two systems; every linked IFC model is one more. */
export const NATIVE_SYSTEMS = [
  { id: "NATIVE_WALL", label: "Tường (native)" },
  { id: "NATIVE_SLAB", label: "Sàn / mái (native)" },
] as const;

export interface ClashSystem {
  id: string;
  label: string;
}

/** Cell defaults, applied to any pair the project has not overridden. */
export const DEFAULT_TOLERANCE_M = 0.001;

export type { ClashMatrix, ClashRule } from "../domain/project";

/** Order-independent, so A×B and B×A are the same cell. */
export function pairKey(a: string, b: string): string {
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
}

export function ruleFor(matrix: ClashMatrix, a: string, b: string): ClashRule {
  return matrix[pairKey(a, b)] ?? { enabled: true, toleranceM: DEFAULT_TOLERANCE_M };
}

/**
 * Systems present in this project right now. A linked model is named by its
 * file, which in practice is the discipline — KT, KC, MEP — so the matrix
 * ends up labelled the way the coordinator already thinks.
 */
export function clashSystems(
  project: NativeBimProject,
  linkedModelNames: readonly string[],
): ClashSystem[] {
  const systems: ClashSystem[] = [];
  if (project.walls.length > 0) systems.push({ ...NATIVE_SYSTEMS[0] });
  if (project.slabs.length > 0) systems.push({ ...NATIVE_SYSTEMS[1] });
  for (const name of linkedModelNames) {
    systems.push({ id: `IFC:${name}`, label: name });
  }
  return systems;
}

/**
 * Which system an item's two sides belong to.
 *
 * `clash.ts` reports its kind, and for linked elements it puts the model's
 * element name on the B side — so the caller passes a lookup from element
 * name to model name, which is the only thing it knows and we do not.
 */
export function systemsOf(
  item: ClashItem,
  modelOfElement: (elementName: string) => string | undefined,
): [string, string] | null {
  switch (item.kind) {
    case "WALL_WALL":
      return ["NATIVE_WALL", "NATIVE_WALL"];
    case "SLAB_SLAB":
      return ["NATIVE_SLAB", "NATIVE_SLAB"];
    case "WALL_SLAB":
      return ["NATIVE_WALL", "NATIVE_SLAB"];
    case "NATIVE_IFC": {
      // aName is a native element, bName is "<element> (<IfcType>)".
      const native = item.aName.toLowerCase().startsWith("slab") ? "NATIVE_SLAB" : "NATIVE_WALL";
      const model = modelOfElement(item.bId);
      return model ? [native, `IFC:${model}`] : null;
    }
    case "IFC_IFC": {
      // Hai phía đều là model link — id mang tiền tố "<model>:" do clash.ts đặt.
      const modelA = item.aId.split(":")[0];
      const modelB = item.bId.split(":")[0];
      return modelA && modelB ? [`IFC:${modelA}`, `IFC:${modelB}`] : null;
    }
    default:
      return null;
  }
}

export interface MatrixFilterResult {
  kept: ClashItem[];
  /** How many the matrix removed, and why — a filter that hides silently lies. */
  suppressedByRule: number;
  suppressedByTolerance: number;
  /** Items whose systems could not be resolved are kept, never dropped. */
  unclassified: number;
}

/**
 * Apply the matrix. An item whose systems cannot be determined is *kept*:
 * a coordination tool that quietly drops what it failed to classify is worse
 * than one that shows a row too many.
 */
export function applyMatrix(
  items: readonly ClashItem[],
  matrix: ClashMatrix,
  modelOfElement: (elementName: string) => string | undefined,
): MatrixFilterResult {
  const kept: ClashItem[] = [];
  let suppressedByRule = 0;
  let suppressedByTolerance = 0;
  let unclassified = 0;

  for (const item of items) {
    const systems = systemsOf(item, modelOfElement);
    if (!systems) {
      unclassified += 1;
      kept.push(item);
      continue;
    }
    const rule = ruleFor(matrix, systems[0], systems[1]);
    if (!rule.enabled) {
      suppressedByRule += 1;
      continue;
    }
    if (item.depth <= rule.toleranceM) {
      suppressedByTolerance += 1;
      continue;
    }
    kept.push(item);
  }

  return { kept, suppressedByRule, suppressedByTolerance, unclassified };
}

/** Build the element-name → model-name lookup the filter needs. */
export function modelIndex(
  linked: readonly { name: string; elements: readonly LinkedElement[] }[],
): (elementName: string) => string | undefined {
  const index = new Map<string, string>();
  for (const model of linked) {
    for (const element of model.elements) {
      // First model wins: a name in two models is ambiguous, and guessing
      // differently on each pass would make the matrix look unstable.
      if (!index.has(element.name)) index.set(element.name, model.name);
    }
  }
  return (elementName: string) => index.get(elementName);
}
