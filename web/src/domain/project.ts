// Port of webim/domain/project.py — same JSON schema (version 4) so project
// files round-trip with the WeBIM Blender add-on.

import { validateLineStyle } from "./lineStyles";

export type Point3D = [number, number, number];

export interface GridDatum {
  id: string;
  name: string;
  start: Point3D;
  end: Point3D;
  systemName: string;
  headType: string;
  headScale: number;
  linePattern: string;
  lineWeightMm: number;
}

/**
 * How a wall end joins a neighbour: MITER shares corner points, BUTT lets
 * the older wall run through while this pair butts, SQUARE disallows the
 * join entirely (plain square end, no connection relationship).
 */
export type WallJoinType = "MITER" | "BUTT" | "SQUARE";

const WALL_JOIN_TYPES: readonly WallJoinType[] = ["MITER", "BUTT", "SQUARE"];

function validateJoinType(value: string): WallJoinType {
  if (!WALL_JOIN_TYPES.includes(value as WallJoinType)) {
    throw new Error(`Unknown wall join type: ${value}`);
  }
  return value as WallJoinType;
}

/**
 * Native wall element. Web-first extension: serialized under a "walls" key
 * the Python add-on ignores on load (its wall tool is still IFC-legacy).
 */
export interface WallDatum {
  id: string;
  name: string;
  start: Point3D;
  end: Point3D;
  thickness: number;
  height: number;
  joinStart: WallJoinType;
  joinEnd: WallJoinType;
}

export type ViewType = "FLOOR_PLAN" | "SECTION" | "ELEVATION";

export interface TechnicalView {
  id: string;
  name: string;
  viewType: ViewType;
  scale: number;
  orthoScale: number;
}

export function uuid4Hex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function letterLabel(index: number): string {
  let label = "";
  let value = index + 1;
  while (value) {
    const remainder = (value - 1) % 26;
    value = Math.floor((value - 1) / 26);
    label = String.fromCharCode(65 + remainder) + label;
  }
  return label;
}

function pointsEqual(a: Point3D, b: Point3D): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function makeGridDatum(data: GridDatum): GridDatum {
  validateLineStyle(data.linePattern, data.lineWeightMm);
  return data;
}

export class NativeBimProject {
  id: string;
  name: string;
  siteName: string;
  buildingName: string;
  storeyName: string;
  gridAxes: GridDatum[];
  views: TechnicalView[];
  walls: WallDatum[];

  constructor(
    id: string,
    name: string,
    siteName: string,
    buildingName: string,
    storeyName: string,
    gridAxes: GridDatum[] = [],
    views: TechnicalView[] = [],
    walls: WallDatum[] = [],
  ) {
    this.id = id;
    this.name = name;
    this.siteName = siteName;
    this.buildingName = buildingName;
    this.storeyName = storeyName;
    this.gridAxes = gridAxes;
    this.views = views;
    this.walls = walls;
  }

  static create(
    name: string,
    siteName: string,
    buildingName: string,
    storeyName: string,
  ): NativeBimProject {
    return new NativeBimProject(uuid4Hex(), name, siteName, buildingName, storeyName);
  }

  toDict(): Record<string, unknown> {
    return {
      schema_version: 4,
      id: this.id,
      name: this.name,
      site_name: this.siteName,
      building_name: this.buildingName,
      storey_name: this.storeyName,
      grid_axes: this.gridAxes.map((axis) => ({
        id: axis.id,
        name: axis.name,
        start: [...axis.start],
        end: [...axis.end],
        system_name: axis.systemName,
        head_type: axis.headType,
        head_scale: axis.headScale,
        line_pattern: axis.linePattern,
        line_weight_mm: axis.lineWeightMm,
      })),
      views: this.views.map((view) => ({
        id: view.id,
        name: view.name,
        view_type: view.viewType,
        scale: view.scale,
        ortho_scale: view.orthoScale,
      })),
      walls: this.walls.map((wall) => ({
        id: wall.id,
        name: wall.name,
        start: [...wall.start],
        end: [...wall.end],
        thickness: wall.thickness,
        height: wall.height,
        join_start: wall.joinStart,
        join_end: wall.joinEnd,
      })),
    };
  }

  static fromJson(value: string): NativeBimProject {
    const data = JSON.parse(value);
    return new NativeBimProject(
      data.id,
      data.name,
      data.site_name,
      data.building_name,
      data.storey_name,
      data.grid_axes.map((axis: Record<string, unknown>) =>
        makeGridDatum({
          id: axis.id as string,
          name: axis.name as string,
          start: axis.start as Point3D,
          end: axis.end as Point3D,
          systemName: axis.system_name as string,
          headType: (axis.head_type as string) ?? "CIRCLE",
          headScale: (axis.head_scale as number) ?? 1.0,
          linePattern: (axis.line_pattern as string) ?? "CENTER",
          lineWeightMm: (axis.line_weight_mm as number) ?? 0.25,
        }),
      ),
      (data.views ?? []).map((view: Record<string, unknown>) => ({
        id: view.id as string,
        name: view.name as string,
        viewType: view.view_type as ViewType,
        scale: (view.scale as number) ?? 100,
        orthoScale: (view.ortho_scale as number) ?? 20.0,
      })),
      (data.walls ?? []).map((wall: Record<string, unknown>) => ({
        id: wall.id as string,
        name: wall.name as string,
        start: wall.start as Point3D,
        end: wall.end as Point3D,
        thickness: (wall.thickness as number) ?? 0.2,
        height: (wall.height as number) ?? 3.0,
        joinStart: validateJoinType((wall.join_start as string) ?? "MITER"),
        joinEnd: validateJoinType((wall.join_end as string) ?? "MITER"),
      })),
    );
  }

  addView(name: string, viewType: string, scale = 100, orthoScale = 20.0): TechnicalView {
    const normalizedType = viewType.toUpperCase() as ViewType;
    if (!["FLOOR_PLAN", "SECTION", "ELEVATION"].includes(normalizedType)) {
      throw new Error(`Unsupported technical view type: ${viewType}`);
    }
    if (scale <= 0) {
      throw new Error("View scale denominator must be greater than zero");
    }
    if (orthoScale <= 0) {
      throw new Error("Camera ortho scale must be greater than zero");
    }
    const view: TechnicalView = {
      id: uuid4Hex(),
      name,
      viewType: normalizedType,
      scale,
      orthoScale,
    };
    this.views.push(view);
    return view;
  }

  updateView(
    viewId: string,
    changes: { name?: string; scale?: number; orthoScale?: number },
  ): TechnicalView {
    const index = this.views.findIndex((view) => view.id === viewId);
    if (index === -1) {
      throw new Error(`Unknown TechnicalView: ${viewId}`);
    }
    const view = this.views[index];
    const updated: TechnicalView = {
      ...view,
      name: changes.name ?? view.name,
      scale: changes.scale ?? view.scale,
      orthoScale: changes.orthoScale ?? view.orthoScale,
    };
    if (updated.scale <= 0) {
      throw new Error("View scale denominator must be greater than zero");
    }
    if (updated.orthoScale <= 0) {
      throw new Error("Camera ortho scale must be greater than zero");
    }
    this.views[index] = updated;
    return updated;
  }

  removeView(viewId: string): TechnicalView {
    const index = this.views.findIndex((view) => view.id === viewId);
    if (index === -1) {
      throw new Error(`Unknown TechnicalView: ${viewId}`);
    }
    return this.views.splice(index, 1)[0];
  }

  addGridAxis(
    start: Point3D,
    end: Point3D,
    options: {
      systemName?: string;
      headType?: string;
      headScale?: number;
      linePattern?: string;
      lineWeightMm?: number;
    } = {},
  ): GridDatum {
    if (pointsEqual(start, end)) {
      throw new Error("A grid axis requires two different points");
    }
    const headScale = options.headScale ?? 1.0;
    if (headScale <= 0) {
      throw new Error("Grid head scale must be greater than zero");
    }
    const axis = makeGridDatum({
      id: uuid4Hex(),
      name: letterLabel(this.gridAxes.length),
      start,
      end,
      systemName: options.systemName ?? "Default Grid",
      headType: options.headType ?? "CIRCLE",
      headScale,
      linePattern: options.linePattern ?? "CENTER",
      lineWeightMm: options.lineWeightMm ?? 0.25,
    });
    this.gridAxes.push(axis);
    return axis;
  }

  updateGridAxis(
    axisId: string,
    changes: {
      start?: Point3D;
      end?: Point3D;
      headType?: string;
      headScale?: number;
      linePattern?: string;
      lineWeightMm?: number;
    },
  ): GridDatum {
    const index = this.gridAxes.findIndex((axis) => axis.id === axisId);
    if (index === -1) {
      throw new Error(`Unknown GridDatum: ${axisId}`);
    }
    const axis = this.gridAxes[index];
    const updated = makeGridDatum({
      ...axis,
      start: changes.start ?? axis.start,
      end: changes.end ?? axis.end,
      headType: changes.headType ?? axis.headType,
      headScale: changes.headScale ?? axis.headScale,
      linePattern: changes.linePattern ?? axis.linePattern,
      lineWeightMm: changes.lineWeightMm ?? axis.lineWeightMm,
    });
    if (pointsEqual(updated.start, updated.end)) {
      throw new Error("A grid axis requires two different points");
    }
    if (updated.headScale <= 0) {
      throw new Error("Grid head scale must be greater than zero");
    }
    this.gridAxes[index] = updated;
    return updated;
  }

  addWall(
    start: Point3D,
    end: Point3D,
    options: {
      thickness?: number;
      height?: number;
      joinStart?: WallJoinType;
      joinEnd?: WallJoinType;
    } = {},
  ): WallDatum {
    if (pointsEqual(start, end)) {
      throw new Error("Wall endpoints must be different");
    }
    const thickness = options.thickness ?? 0.2;
    const height = options.height ?? 3.0;
    if (thickness <= 0) {
      throw new Error("Wall thickness must be greater than zero");
    }
    if (height <= 0) {
      throw new Error("Wall height must be greater than zero");
    }
    const wall: WallDatum = {
      id: uuid4Hex(),
      name: `W${this.walls.length + 1}`,
      start,
      end,
      thickness,
      height,
      joinStart: validateJoinType(options.joinStart ?? "MITER"),
      joinEnd: validateJoinType(options.joinEnd ?? "MITER"),
    };
    this.walls.push(wall);
    return wall;
  }

  updateWall(
    wallId: string,
    changes: {
      start?: Point3D;
      end?: Point3D;
      thickness?: number;
      height?: number;
      joinStart?: WallJoinType;
      joinEnd?: WallJoinType;
    },
  ): WallDatum {
    const index = this.walls.findIndex((wall) => wall.id === wallId);
    if (index === -1) {
      throw new Error(`Unknown WallDatum: ${wallId}`);
    }
    const wall = this.walls[index];
    const updated: WallDatum = {
      ...wall,
      start: changes.start ?? wall.start,
      end: changes.end ?? wall.end,
      thickness: changes.thickness ?? wall.thickness,
      height: changes.height ?? wall.height,
      joinStart: validateJoinType(changes.joinStart ?? wall.joinStart),
      joinEnd: validateJoinType(changes.joinEnd ?? wall.joinEnd),
    };
    if (pointsEqual(updated.start, updated.end)) {
      throw new Error("Wall endpoints must be different");
    }
    if (updated.thickness <= 0) {
      throw new Error("Wall thickness must be greater than zero");
    }
    if (updated.height <= 0) {
      throw new Error("Wall height must be greater than zero");
    }
    this.walls[index] = updated;
    return updated;
  }

  removeWall(wallId: string): WallDatum {
    const index = this.walls.findIndex((wall) => wall.id === wallId);
    if (index === -1) {
      throw new Error(`Unknown WallDatum: ${wallId}`);
    }
    return this.walls.splice(index, 1)[0];
  }

  removeGridAxis(axisId: string): GridDatum {
    const index = this.gridAxes.findIndex((axis) => axis.id === axisId);
    if (index === -1) {
      throw new Error(`Unknown GridDatum: ${axisId}`);
    }
    return this.gridAxes.splice(index, 1)[0];
  }
}
