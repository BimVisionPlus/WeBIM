// Browser-side IFC4 export of the native grid model.
//
// Mirrors webim/tools/grid/__init__.py finalize_grid_axis_annotations:
// axes are grouped per system into parallel families (1 degree tolerance);
// two families export as a RECTANGULAR IfcGrid (U/V), three as TRIANGULAR
// (U/V/W); anything else keeps each axis as an IfcAnnotation with
// ObjectType WEBIM_GRID_AXIS.

// Walls export as IfcWall with a SweptSolid body: the plan footprint from
// wallFootprint (mitered against joined walls) extruded by the wall height —
// the browser counterpart of create_2pt_wall in webim/core/wall.py, plus
// corner joins.

import { wallFootprint } from "../application/wallGeometry";
import type { GridDatum, NativeBimProject, Point3D, WallDatum } from "../domain/project";

const GUID_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

export function ifcGuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // 128 bits -> 22 chars of base 64; the leading char only carries 4 bits.
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  let guid = "";
  for (let index = 0; index < 21; index += 1) {
    guid = GUID_ALPHABET[Number(value & 63n)] + guid;
    value >>= 6n;
  }
  return GUID_ALPHABET[Number(value & 3n)] + guid;
}

function real(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("IFC real values must be finite");
  }
  if (Number.isInteger(value)) {
    return `${value}.`;
  }
  return String(Number(value.toPrecision(12)));
}

function text(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

class StepFile {
  private lines: string[] = [];
  private nextId = 1;

  add(entity: string, args: string[]): string {
    const ref = `#${this.nextId}`;
    this.lines.push(`${ref}=${entity}(${args.join(",")});`);
    this.nextId += 1;
    return ref;
  }

  render(fileName: string, timestamp: string): string {
    return [
      "ISO-10303-21;",
      "HEADER;",
      "FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');",
      `FILE_NAME(${text(fileName)},${text(timestamp)},('WeBIM Web'),('WeBIM'),'WeBIM Web','WeBIM Web','');`,
      "FILE_SCHEMA(('IFC4'));",
      "ENDSEC;",
      "DATA;",
      ...this.lines,
      "ENDSEC;",
      "END-ISO-10303-21;",
      "",
    ].join("\n");
  }
}

interface AxisFamily {
  angle: number;
  axes: GridDatum[];
}

function axisAngle(axis: GridDatum): number {
  const angle = Math.atan2(axis.end[1] - axis.start[1], axis.end[0] - axis.start[0]);
  return ((angle % Math.PI) + Math.PI) % Math.PI;
}

function anglesAreParallel(first: number, second: number, toleranceDegrees = 1.0): boolean {
  const difference = Math.abs(first - second);
  const smallest = Math.min(difference, Math.PI - difference);
  return smallest <= (toleranceDegrees * Math.PI) / 180;
}

export function groupAxisFamilies(axes: readonly GridDatum[]): AxisFamily[] {
  const families: AxisFamily[] = [];
  for (const axis of axes) {
    const angle = axisAngle(axis);
    const family = families.find((candidate) => anglesAreParallel(angle, candidate.angle));
    if (family) {
      family.axes.push(axis);
    } else {
      families.push({ angle, axes: [axis] });
    }
  }
  return families;
}

export function exportProjectToIfc(
  project: NativeBimProject,
  options: { fileName?: string; timestamp?: string } = {},
): string {
  const step = new StepFile();
  const fileName = options.fileName ?? `${project.name}.ifc`;
  const timestamp = options.timestamp ?? new Date().toISOString();

  const origin = step.add("IFCCARTESIANPOINT", ["(0.,0.,0.)"]);
  const worldPlacement = step.add("IFCAXIS2PLACEMENT3D", [origin, "$", "$"]);
  const context = step.add("IFCGEOMETRICREPRESENTATIONCONTEXT", [
    "$",
    "'Model'",
    "3",
    "1.E-05",
    worldPlacement,
    "$",
  ]);
  const lengthUnit = step.add("IFCSIUNIT", ["*", ".LENGTHUNIT.", "$", ".METRE."]);
  const angleUnit = step.add("IFCSIUNIT", ["*", ".PLANEANGLEUNIT.", "$", ".RADIAN."]);
  const areaUnit = step.add("IFCSIUNIT", ["*", ".AREAUNIT.", "$", ".SQUARE_METRE."]);
  const volumeUnit = step.add("IFCSIUNIT", ["*", ".VOLUMEUNIT.", "$", ".CUBIC_METRE."]);
  const units = step.add("IFCUNITASSIGNMENT", [
    `(${[lengthUnit, angleUnit, areaUnit, volumeUnit].join(",")})`,
  ]);
  const ifcProject = step.add("IFCPROJECT", [
    text(ifcGuid()),
    "$",
    text(project.name),
    "$",
    "$",
    "$",
    "$",
    `(${context})`,
    units,
  ]);

  const sitePlacement = step.add("IFCLOCALPLACEMENT", ["$", worldPlacement]);
  const site = step.add("IFCSITE", [
    text(ifcGuid()),
    "$",
    text(project.siteName),
    "$",
    "$",
    sitePlacement,
    "$",
    "$",
    ".ELEMENT.",
    "$",
    "$",
    "$",
    "$",
    "$",
  ]);
  const buildingPlacement = step.add("IFCLOCALPLACEMENT", [sitePlacement, worldPlacement]);
  const building = step.add("IFCBUILDING", [
    text(ifcGuid()),
    "$",
    text(project.buildingName),
    "$",
    "$",
    buildingPlacement,
    "$",
    "$",
    ".ELEMENT.",
    "$",
    "$",
    "$",
  ]);
  const storeyPlacement = step.add("IFCLOCALPLACEMENT", [buildingPlacement, worldPlacement]);
  const storey = step.add("IFCBUILDINGSTOREY", [
    text(ifcGuid()),
    "$",
    text(project.storeyName),
    "$",
    "$",
    storeyPlacement,
    "$",
    "$",
    ".ELEMENT.",
    "0.",
  ]);
  step.add("IFCRELAGGREGATES", [text(ifcGuid()), "$", "$", "$", ifcProject, `(${site})`]);
  step.add("IFCRELAGGREGATES", [text(ifcGuid()), "$", "$", "$", site, `(${building})`]);
  step.add("IFCRELAGGREGATES", [text(ifcGuid()), "$", "$", "$", building, `(${storey})`]);

  const polyline = (start: Point3D, end: Point3D): string => {
    const first = step.add("IFCCARTESIANPOINT", [
      `(${real(start[0])},${real(start[1])},${real(start[2])})`,
    ]);
    const second = step.add("IFCCARTESIANPOINT", [
      `(${real(end[0])},${real(end[1])},${real(end[2])})`,
    ]);
    return step.add("IFCPOLYLINE", [`(${first},${second})`]);
  };

  const containedProducts: string[] = [];
  const systems = new Map<string, GridDatum[]>();
  for (const axis of project.gridAxes) {
    const group = systems.get(axis.systemName);
    if (group) {
      group.push(axis);
    } else {
      systems.set(axis.systemName, [axis]);
    }
  }

  for (const [systemName, axes] of systems) {
    const families = groupAxisFamilies(axes);
    if (families.length === 2 || families.length === 3) {
      const axisRefs = families.map((family) =>
        family.axes.map((axis) =>
          step.add("IFCGRIDAXIS", [
            text(axis.name),
            polyline(axis.start, axis.end),
            ".T.",
          ]),
        ),
      );
      const gridPlacement = step.add("IFCLOCALPLACEMENT", [storeyPlacement, worldPlacement]);
      const grid = step.add("IFCGRID", [
        text(ifcGuid()),
        "$",
        text(systemName),
        "$",
        "$",
        gridPlacement,
        "$",
        `(${axisRefs[0].join(",")})`,
        `(${axisRefs[1].join(",")})`,
        families.length === 3 ? `(${axisRefs[2].join(",")})` : "$",
        families.length === 3 ? ".TRIANGULAR." : ".RECTANGULAR.",
      ]);
      containedProducts.push(grid);
    } else {
      for (const axis of axes) {
        const representation = step.add("IFCSHAPEREPRESENTATION", [
          context,
          "'Annotation'",
          "'Curve3D'",
          `(${polyline(axis.start, axis.end)})`,
        ]);
        const shape = step.add("IFCPRODUCTDEFINITIONSHAPE", [
          "$",
          "$",
          `(${representation})`,
        ]);
        const annotationPlacement = step.add("IFCLOCALPLACEMENT", [
          storeyPlacement,
          worldPlacement,
        ]);
        const annotation = step.add("IFCANNOTATION", [
          text(ifcGuid()),
          "$",
          text(axis.name),
          text("Standalone grid datum; group into IfcGrid for exchange"),
          "'WEBIM_GRID_AXIS'",
          annotationPlacement,
          shape,
        ]);
        containedProducts.push(annotation);
      }
    }
  }

  for (const wall of project.walls) {
    containedProducts.push(addWall(step, wall, project.walls, context, storeyPlacement));
  }

  if (containedProducts.length > 0) {
    step.add("IFCRELCONTAINEDINSPATIALSTRUCTURE", [
      text(ifcGuid()),
      "$",
      "$",
      "$",
      `(${containedProducts.join(",")})`,
      storey,
    ]);
  }

  return step.render(fileName, timestamp);
}

function addWall(
  step: StepFile,
  wall: WallDatum,
  walls: readonly WallDatum[],
  context: string,
  storeyPlacement: string,
): string {
  // Placement at the storey origin lifted to the wall base; the profile is
  // the world-XY footprint polygon, mitered against joined walls.
  const location = step.add("IFCCARTESIANPOINT", [`(0.,0.,${real(wall.start[2])})`]);
  const axisPlacement = step.add("IFCAXIS2PLACEMENT3D", [location, "$", "$"]);
  const wallPlacement = step.add("IFCLOCALPLACEMENT", [storeyPlacement, axisPlacement]);

  const corners = wallFootprint(wall, walls);
  const profilePoints = [...corners, corners[0]].map((corner) =>
    step.add("IFCCARTESIANPOINT", [`(${real(corner[0])},${real(corner[1])})`]),
  );
  const outerCurve = step.add("IFCPOLYLINE", [`(${profilePoints.join(",")})`]);
  const profile = step.add("IFCARBITRARYCLOSEDPROFILEDEF", [".AREA.", "$", outerCurve]);
  const solidPosition = step.add("IFCAXIS2PLACEMENT3D", [
    step.add("IFCCARTESIANPOINT", ["(0.,0.,0.)"]),
    "$",
    "$",
  ]);
  const extrudeDirection = step.add("IFCDIRECTION", ["(0.,0.,1.)"]);
  const solid = step.add("IFCEXTRUDEDAREASOLID", [
    profile,
    solidPosition,
    extrudeDirection,
    real(wall.height),
  ]);
  const representation = step.add("IFCSHAPEREPRESENTATION", [
    context,
    "'Body'",
    "'SweptSolid'",
    `(${solid})`,
  ]);
  const shape = step.add("IFCPRODUCTDEFINITIONSHAPE", ["$", "$", `(${representation})`]);
  return step.add("IFCWALL", [
    text(ifcGuid()),
    "$",
    text(wall.name),
    "$",
    "$",
    wallPlacement,
    shape,
    "$",
    ".STANDARD.",
  ]);
}
