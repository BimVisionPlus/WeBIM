// Minimal IFC4 STEP reader for linked-model clash checking.
//
// Scope (stated honestly in the UI): products whose bodies are
// SweptSolid extrusions — IfcArbitraryClosedProfileDef polylines or
// IfcRectangleProfileDef — with placement chains of translations plus
// optional z-rotations (RefDirection). That covers WeBIM's own exports
// and the common simple-geometry subset of Revit/ifcopenshell output;
// products with breps, mapped items or booleans are skipped and
// counted so the user sees what was not read. Output is one world AABB
// per element — enough for Navisworks-style hard-clash screening, not
// a viewer.

export interface LinkedElement {
  name: string;
  ifcType: string;
  min: [number, number, number];
  max: [number, number, number];
}

export interface ParsedIfc {
  elements: LinkedElement[];
  /** Products seen but skipped (unsupported representation). */
  skipped: number;
}

interface Entity {
  type: string;
  args: string[];
}

const PRODUCT_TYPES = new Set([
  "IFCWALL",
  "IFCWALLSTANDARDCASE",
  "IFCSLAB",
  "IFCCOLUMN",
  "IFCBEAM",
  "IFCMEMBER",
  "IFCPLATE",
  "IFCFOOTING",
]);

/** Split STEP argument list at the top level (respects parens/strings). */
function splitArgs(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = "";
  for (const char of raw) {
    if (inString) {
      current += char;
      if (char === "'") inString = false;
      continue;
    }
    if (char === "'") {
      inString = true;
      current += char;
    } else if (char === "(") {
      depth += 1;
      current += char;
    } else if (char === ")") {
      depth -= 1;
      current += char;
    } else if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseEntities(text: string): Map<number, Entity> {
  const entities = new Map<number, Entity>();
  // Instances may span lines; join then split on ";".
  const body = text.replace(/\r/g, "");
  const pattern = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*?)\)\s*;/g;
  let match;
  while ((match = pattern.exec(body))) {
    entities.set(Number(match[1]), {
      type: match[2],
      args: splitArgs(match[3]),
    });
  }
  return entities;
}

const ref = (value: string | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/^#(\d+)$/);
  return match ? Number(match[1]) : null;
};

const numberList = (value: string): number[] =>
  (value.match(/-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?/g) ?? []).map(Number);

const refList = (value: string): number[] =>
  [...value.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));

interface Transform {
  /** 2D rotation of the local x-axis, radians. */
  rotation: number;
  translation: [number, number, number];
}

function composeTransforms(outer: Transform, inner: Transform): Transform {
  const cos = Math.cos(outer.rotation);
  const sin = Math.sin(outer.rotation);
  return {
    rotation: outer.rotation + inner.rotation,
    translation: [
      outer.translation[0] + cos * inner.translation[0] - sin * inner.translation[1],
      outer.translation[1] + sin * inner.translation[0] + cos * inner.translation[1],
      outer.translation[2] + inner.translation[2],
    ],
  };
}

function axis2PlacementTransform(
  entities: Map<number, Entity>,
  placementId: number | null,
): Transform {
  const identity: Transform = { rotation: 0, translation: [0, 0, 0] };
  if (placementId === null) return identity;
  const placement = entities.get(placementId);
  if (!placement) return identity;
  const location = entities.get(ref(placement.args[0]) ?? -1);
  const point = location ? numberList(location.args[0]) : [0, 0, 0];
  let rotation = 0;
  // IFCAXIS2PLACEMENT3D(loc, axis, refDirection) — refDirection rotates x.
  const refDirectionId = ref(placement.args[placement.args.length - 1]);
  if (refDirectionId !== null) {
    const direction = entities.get(refDirectionId);
    if (direction?.type === "IFCDIRECTION") {
      const [dx, dy] = numberList(direction.args[0]);
      if (dx !== undefined && dy !== undefined && (dx !== 0 || dy !== 0)) {
        rotation = Math.atan2(dy, dx);
      }
    }
  }
  return {
    rotation,
    translation: [point[0] ?? 0, point[1] ?? 0, point[2] ?? 0],
  };
}

function localPlacementTransform(
  entities: Map<number, Entity>,
  placementId: number | null,
): Transform {
  const identity: Transform = { rotation: 0, translation: [0, 0, 0] };
  if (placementId === null) return identity;
  const placement = entities.get(placementId);
  if (!placement || placement.type !== "IFCLOCALPLACEMENT") return identity;
  const parent = localPlacementTransform(entities, ref(placement.args[0]));
  const local = axis2PlacementTransform(entities, ref(placement.args[1]));
  return composeTransforms(parent, local);
}

/** Profile outline in profile coordinates, or null if unsupported. */
function profileOutline(
  entities: Map<number, Entity>,
  profileId: number | null,
): [number, number][] | null {
  const profile = entities.get(profileId ?? -1);
  if (!profile) return null;
  if (profile.type === "IFCARBITRARYCLOSEDPROFILEDEF") {
    const curve = entities.get(ref(profile.args[2]) ?? -1);
    if (!curve || curve.type !== "IFCPOLYLINE") return null;
    return refList(curve.args[0]).map((pointId) => {
      const [x, y] = numberList(entities.get(pointId)?.args[0] ?? "");
      return [x ?? 0, y ?? 0] as [number, number];
    });
  }
  if (profile.type === "IFCRECTANGLEPROFILEDEF") {
    const xDim = Number(profile.args[3]);
    const yDim = Number(profile.args[4]);
    const position = axis2PlacementTransform(entities, ref(profile.args[2]));
    const [cx, cy] = position.translation;
    return [
      [cx - xDim / 2, cy - yDim / 2],
      [cx + xDim / 2, cy - yDim / 2],
      [cx + xDim / 2, cy + yDim / 2],
      [cx - xDim / 2, cy + yDim / 2],
    ];
  }
  return null;
}

/** Extruded solid → AABB in the element's local space, or null. */
function extrudedSolidBounds(
  entities: Map<number, Entity>,
  solid: Entity,
): { min: [number, number, number]; max: [number, number, number] } | null {
  const outline = profileOutline(entities, ref(solid.args[0]));
  if (!outline || outline.length === 0) return null;
  const position = axis2PlacementTransform(entities, ref(solid.args[1]));
  const directionEntity = entities.get(ref(solid.args[2]) ?? -1);
  const direction = directionEntity ? numberList(directionEntity.args[0]) : [0, 0, 1];
  const depth = Number(solid.args[3]) || 0;
  const cos = Math.cos(position.rotation);
  const sin = Math.sin(position.rotation);
  const points = outline.map(([x, y]) => [
    position.translation[0] + cos * x - sin * y,
    position.translation[1] + sin * x + cos * y,
  ]);
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const z0 = position.translation[2];
  const extrusion = [
    (direction[0] ?? 0) * depth,
    (direction[1] ?? 0) * depth,
    (direction[2] ?? 1) * depth,
  ];
  return {
    min: [
      Math.min(...xs) + Math.min(0, extrusion[0]),
      Math.min(...ys) + Math.min(0, extrusion[1]),
      z0 + Math.min(0, extrusion[2]),
    ],
    max: [
      Math.max(...xs) + Math.max(0, extrusion[0]),
      Math.max(...ys) + Math.max(0, extrusion[1]),
      z0 + Math.max(0, extrusion[2]),
    ],
  };
}

export function parseIfc(text: string): ParsedIfc {
  const entities = parseEntities(text);
  const elements: LinkedElement[] = [];
  let skipped = 0;

  for (const entity of entities.values()) {
    if (!PRODUCT_TYPES.has(entity.type)) continue;
    const name = entity.args[2]?.replace(/^'|'$/g, "") || entity.type;
    const placement = localPlacementTransform(entities, ref(entity.args[5]));

    // Product → shape representation → extruded solids.
    const shape = entities.get(ref(entity.args[6]) ?? -1);
    if (!shape || shape.type !== "IFCPRODUCTDEFINITIONSHAPE") {
      skipped += 1;
      continue;
    }
    let found = false;
    for (const representationId of refList(shape.args[2])) {
      const representation = entities.get(representationId);
      if (!representation) continue;
      for (const itemId of refList(representation.args[3] ?? "")) {
        const item = entities.get(itemId);
        if (!item || item.type !== "IFCEXTRUDEDAREASOLID") continue;
        const bounds = extrudedSolidBounds(entities, item);
        if (!bounds) continue;
        const cos = Math.cos(placement.rotation);
        const sin = Math.sin(placement.rotation);
        const corners: [number, number][] = [
          [bounds.min[0], bounds.min[1]],
          [bounds.max[0], bounds.min[1]],
          [bounds.max[0], bounds.max[1]],
          [bounds.min[0], bounds.max[1]],
        ].map(([x, y]) => [
          placement.translation[0] + cos * x - sin * y,
          placement.translation[1] + sin * x + cos * y,
        ]);
        elements.push({
          name,
          ifcType: entity.type,
          min: [
            Math.min(...corners.map((corner) => corner[0])),
            Math.min(...corners.map((corner) => corner[1])),
            placement.translation[2] + bounds.min[2],
          ],
          max: [
            Math.max(...corners.map((corner) => corner[0])),
            Math.max(...corners.map((corner) => corner[1])),
            placement.translation[2] + bounds.max[2],
          ],
        });
        found = true;
      }
    }
    if (!found) skipped += 1;
  }

  return { elements, skipped };
}
