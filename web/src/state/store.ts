import { useSyncExternalStore } from "react";
import { NativeBimProject, type Point3D } from "../domain/project";
import { exportProjectToIfc } from "../export/ifcGrid";
import { SyncEngine } from "../sync/syncEngine";

export type ToolId =
  | "SELECT"
  | "GRID"
  | "WALL"
  | "DOOR"
  | "WINDOW"
  | "FLOOR"
  | "ROOF"
  | "DIM";

export interface Selection {
  kind:
    | "grid"
    | "view"
    | "wall"
    | "opening"
    | "level"
    | "sheet"
    | "slab"
    | "schedule"
    | "walltype"
    | "dimension";
  id: string;
}

const STORAGE_KEY = "webim.native_project";
const ACTIVE_VIEW_KEY = "webim.active_view";

function defaultProject(): NativeBimProject {
  const project = NativeBimProject.create(
    "WeBIM Project",
    "Default Site",
    "Main Building",
    "Ground Floor",
  );
  const level = project.addLevel("Level 1", 0);
  project.addView("Level 1", "FLOOR_PLAN", 100, 40, level.id);
  project.addWallType("Generic 200", [
    { name: "Core", material: "Concrete", thickness: 0.2 },
  ]);
  project.addWallType("Brick 220 + Plaster", [
    { name: "Finish", material: "Plaster", thickness: 0.01 },
    { name: "Core", material: "Brick", thickness: 0.2 },
    { name: "Finish", material: "Plaster", thickness: 0.01 },
  ]);
  return project;
}

class AppStore {
  project: NativeBimProject;
  activeTool: ToolId = "SELECT";
  selection: Selection | null = null;
  activeViewId: string | null = null;
  /** When set, the viewport shows this sheet's paper space instead of a view. */
  activeSheetId: string | null = null;
  /** When set, the main area shows this schedule's table. */
  activeScheduleId: string | null = null;
  snapIncrement = 0.1;
  pendingStart: Point3D | null = null;
  statusMessage = "Ready";

  private version = 0;
  private listeners = new Set<() => void>();

  constructor() {
    this.project = this.restore() ?? defaultProject();
    const storedView = localStorage.getItem(ACTIVE_VIEW_KEY);
    if (storedView && this.project.views.some((view) => view.id === storedView)) {
      this.activeViewId = storedView;
    } else {
      this.activeViewId = this.project.views[0]?.id ?? null;
    }
  }

  private restore(): NativeBimProject | null {
    try {
      const payload = localStorage.getItem(STORAGE_KEY);
      return payload ? NativeBimProject.fromJson(payload) : null;
    } catch (error) {
      console.warn("Could not restore stored project", error);
      return null;
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  /** Wired up after construction; broadcasts persisted commits to peers. */
  sync: SyncEngine | null = null;

  private commit(persist = true): void {
    this.version += 1;
    if (persist) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.project.toDict()));
      if (this.activeViewId) {
        localStorage.setItem(ACTIVE_VIEW_KEY, this.activeViewId);
      }
      this.sync?.onLocalCommit();
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Replace the project with a merged state received from a peer. */
  applyRemoteProject(projectDict: Record<string, unknown>): void {
    this.project = NativeBimProject.fromJson(JSON.stringify(projectDict));
    if (!this.project.views.some((view) => view.id === this.activeViewId)) {
      this.activeViewId = this.project.views[0]?.id ?? null;
    }
    this.pendingStart = null;
    this.statusMessage = "Synced changes from a collaborator";
    this.version += 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.project.toDict()));
    for (const listener of this.listeners) {
      listener();
    }
  }

  get activeView() {
    if (this.activeSheetId || this.activeScheduleId) return null;
    return this.project.views.find((view) => view.id === this.activeViewId) ?? null;
  }

  get activeSchedule() {
    return (
      this.project.schedules.find(
        (schedule) => schedule.id === this.activeScheduleId,
      ) ?? null
    );
  }

  get activeSheet() {
    if (this.activeScheduleId) return null;
    return this.project.sheets.find((sheet) => sheet.id === this.activeSheetId) ?? null;
  }

  /** Level shown by the active floor plan (first level as fallback). */
  get activeLevel() {
    const view = this.activeView;
    if (view?.viewType === "FLOOR_PLAN" && view.levelId) {
      return this.project.levelById(view.levelId) ?? this.project.levels[0] ?? null;
    }
    return this.project.levels[0] ?? null;
  }

  /** Paper-size annotations convert from the 1:100 baseline into model units. */
  get annotationViewFactor(): number {
    const view = this.activeView;
    return view ? Math.max(view.scale, 1) / 100 : 1;
  }

  setTool(tool: ToolId): void {
    if (tool !== "SELECT" && this.activeView?.viewType !== "FLOOR_PLAN") {
      this.statusMessage = "Drawing tools need an active floor plan view";
      this.commit(false);
      return;
    }
    this.activeTool = tool;
    this.pendingStart = null;
    this.statusMessage =
      tool === "GRID"
        ? "Grid: click two points per axis. Esc cancels, Enter exits."
        : tool === "WALL"
          ? "Wall: click two points per wall. Esc cancels, Enter exits."
          : tool === "DOOR" || tool === "WINDOW"
            ? `${tool === "DOOR" ? "Door" : "Window"}: click on a wall to place. Esc exits.`
            : tool === "FLOOR" || tool === "ROOF"
              ? `${tool === "FLOOR" ? "Floor" : "Roof"}: click two opposite corners. Esc cancels.`
              : tool === "DIM"
                ? "Dimension: click two points, then place the line. Esc cancels."
                : "Ready";
    this.commit(false);
  }

  setStatus(message: string): void {
    this.statusMessage = message;
    this.commit(false);
  }

  setPendingStart(point: Point3D | null): void {
    this.pendingStart = point;
    this.commit(false);
  }

  setSnapIncrement(value: number): void {
    if (value > 0) {
      this.snapIncrement = value;
      this.commit(false);
    }
  }

  select(selection: Selection | null): void {
    this.selection = selection;
    this.commit(false);
  }

  addGridAxis(start: Point3D, end: Point3D): void {
    const axis = this.project.addGridAxis(start, end);
    this.statusMessage = `Grid ${axis.name} created`;
    this.commit();
  }

  updateGridAxis(axisId: string, changes: Parameters<NativeBimProject["updateGridAxis"]>[1]): void {
    this.project.updateGridAxis(axisId, changes);
    this.commit();
  }

  removeGridAxis(axisId: string): void {
    this.project.removeGridAxis(axisId);
    if (this.selection?.kind === "grid" && this.selection.id === axisId) {
      this.selection = null;
    }
    this.commit();
  }

  wallThickness = 0.2;
  wallHeight = 3.0;

  addWall(start: Point3D, end: Point3D): void {
    const wall = this.project.addWall(start, end, {
      thickness: this.wallThickness,
      height: this.wallHeight,
      levelId: this.activeLevel?.id,
    });
    this.statusMessage = `Wall ${wall.name} created`;
    this.commit();
  }

  updateWall(wallId: string, changes: Parameters<NativeBimProject["updateWall"]>[1]): void {
    this.project.updateWall(wallId, changes);
    this.commit();
  }

  removeWall(wallId: string): void {
    this.project.removeWall(wallId);
    if (this.selection?.kind === "wall" && this.selection.id === wallId) {
      this.selection = null;
    }
    this.commit();
  }

  addDimension(start: [number, number], end: [number, number], offset: number): void {
    const view = this.activeView;
    if (!view || view.viewType !== "FLOOR_PLAN") {
      this.setStatus("Dimensions need an active floor plan view");
      return;
    }
    try {
      const dimension = this.project.addDimension(view.id, start, end, offset);
      this.selection = { kind: "dimension", id: dimension.id };
      this.statusMessage = "Dimension placed";
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  updateDimension(
    dimensionId: string,
    changes: Parameters<NativeBimProject["updateDimension"]>[1],
  ): void {
    this.project.updateDimension(dimensionId, changes);
    this.commit();
  }

  removeDimension(dimensionId: string): void {
    this.project.removeDimension(dimensionId);
    if (this.selection?.kind === "dimension" && this.selection.id === dimensionId) {
      this.selection = null;
    }
    this.commit();
  }

  addWallType(): void {
    const wallType = this.project.addWallType();
    this.selection = { kind: "walltype", id: wallType.id };
    this.commit();
  }

  updateWallType(
    typeId: string,
    changes: Parameters<NativeBimProject["updateWallType"]>[1],
  ): void {
    try {
      this.project.updateWallType(typeId, changes);
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  removeWallType(typeId: string): void {
    try {
      this.project.removeWallType(typeId);
      if (this.selection?.kind === "walltype" && this.selection.id === typeId) {
        this.selection = null;
      }
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  addSlab(kind: "FLOOR" | "ROOF", cornerA: Point3D, cornerB: Point3D): void {
    const [x0, y0] = cornerA;
    const [x1, y1] = cornerB;
    if (x0 === x1 || y0 === y1) {
      this.setStatus("Slab corners must span a rectangle");
      return;
    }
    const outline: [number, number][] = [
      [Math.min(x0, x1), Math.min(y0, y1)],
      [Math.max(x0, x1), Math.min(y0, y1)],
      [Math.max(x0, x1), Math.max(y0, y1)],
      [Math.min(x0, x1), Math.max(y0, y1)],
    ];
    const slab = this.project.addSlab(kind, outline, {
      levelId: this.activeLevel?.id,
      zOffset: kind === "ROOF" ? this.wallHeight : 0,
    });
    this.selection = { kind: "slab", id: slab.id };
    this.statusMessage = `${kind === "FLOOR" ? "Floor" : "Roof"} ${slab.name} created`;
    this.commit();
  }

  updateSlab(slabId: string, changes: Parameters<NativeBimProject["updateSlab"]>[1]): void {
    this.project.updateSlab(slabId, changes);
    this.commit();
  }

  removeSlab(slabId: string): void {
    this.project.removeSlab(slabId);
    if (this.selection?.kind === "slab" && this.selection.id === slabId) {
      this.selection = null;
    }
    this.commit();
  }

  addOpening(wallId: string, kind: "DOOR" | "WINDOW", offset: number): void {
    const opening = this.project.addOpening(wallId, kind, offset);
    this.selection = { kind: "opening", id: opening.id };
    this.statusMessage = `${kind === "DOOR" ? "Door" : "Window"} ${opening.name} placed`;
    this.commit();
  }

  updateOpening(
    wallId: string,
    openingId: string,
    changes: Parameters<NativeBimProject["updateOpening"]>[2],
  ): void {
    this.project.updateOpening(wallId, openingId, changes);
    this.commit();
  }

  removeOpening(wallId: string, openingId: string): void {
    this.project.removeOpening(wallId, openingId);
    if (this.selection?.kind === "opening" && this.selection.id === openingId) {
      this.selection = null;
    }
    this.commit();
  }

  addView(viewType: "FLOOR_PLAN" | "SECTION" | "ELEVATION"): void {
    if (viewType === "FLOOR_PLAN") {
      // A new floor plan comes with its own level above the topmost one.
      this.addLevel();
      return;
    }
    const prefix = viewType === "SECTION" ? "Section" : "Elevation";
    const count = this.project.views.filter((view) => view.viewType === viewType).length;
    const view = this.project.addView(`${prefix} ${count + 1}`, viewType);
    this.activeSheetId = null;
    this.activeViewId = view.id;
    this.commit();
  }

  addLevel(): void {
    const top = this.project.levels[this.project.levels.length - 1];
    const elevation = top ? top.elevation + 3 : 0;
    const name = `Level ${this.project.levels.length + 1}`;
    const level = this.project.addLevel(name, elevation);
    const view = this.project.addView(name, "FLOOR_PLAN", 100, 40, level.id);
    this.activeSheetId = null;
    this.activeViewId = view.id;
    this.selection = { kind: "level", id: level.id };
    this.statusMessage = `${name} created at +${elevation} m`;
    this.commit();
  }

  updateLevel(levelId: string, changes: Parameters<NativeBimProject["updateLevel"]>[1]): void {
    this.project.updateLevel(levelId, changes);
    this.commit();
  }

  removeLevel(levelId: string): void {
    try {
      this.project.removeLevel(levelId);
      if (this.selection?.kind === "level" && this.selection.id === levelId) {
        this.selection = null;
      }
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  addSchedule(): void {
    const schedule = this.project.addSchedule("WALL");
    this.activateSchedule(schedule.id);
    this.commit();
  }

  updateSchedule(
    scheduleId: string,
    changes: Parameters<NativeBimProject["updateSchedule"]>[1],
  ): void {
    this.project.updateSchedule(scheduleId, changes);
    this.commit();
  }

  removeSchedule(scheduleId: string): void {
    this.project.removeSchedule(scheduleId);
    if (this.activeScheduleId === scheduleId) {
      this.activeScheduleId = null;
      this.activeViewId = this.project.views[0]?.id ?? null;
    }
    if (this.selection?.kind === "schedule" && this.selection.id === scheduleId) {
      this.selection = null;
    }
    this.commit();
  }

  activateSchedule(scheduleId: string): void {
    this.activeSheetId = null;
    this.activeScheduleId = scheduleId;
    this.selection = { kind: "schedule", id: scheduleId };
    if (this.activeTool !== "SELECT") {
      this.activeTool = "SELECT";
      this.pendingStart = null;
    }
    this.commit(false);
  }

  addSheet(): void {
    const sheet = this.project.addSheet("Untitled sheet");
    this.activateSheet(sheet.id);
    this.commit();
  }

  updateSheet(sheetId: string, changes: Parameters<NativeBimProject["updateSheet"]>[1]): void {
    this.project.updateSheet(sheetId, changes);
    this.commit();
  }

  removeSheet(sheetId: string): void {
    this.project.removeSheet(sheetId);
    if (this.activeSheetId === sheetId) {
      this.activeSheetId = null;
      this.activeViewId = this.project.views[0]?.id ?? null;
    }
    if (this.selection?.kind === "sheet" && this.selection.id === sheetId) {
      this.selection = null;
    }
    this.commit();
  }

  activateSheet(sheetId: string): void {
    this.activeScheduleId = null;
    this.activeSheetId = sheetId;
    this.selection = { kind: "sheet", id: sheetId };
    if (this.activeTool !== "SELECT") {
      this.activeTool = "SELECT";
      this.pendingStart = null;
    }
    this.commit(false);
  }

  placeViewOnSheet(sheetId: string, viewId: string): void {
    try {
      const count = this.project.sheets.find((sheet) => sheet.id === sheetId)?.placements
        .length ?? 0;
      // Stagger frames left-to-right across the sheet.
      this.project.placeViewOnSheet(sheetId, viewId, 60 + count * 240, 320);
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  updateSheetPlacement(
    sheetId: string,
    placementId: string,
    changes: { x?: number; y?: number },
  ): void {
    this.project.updateSheetPlacement(sheetId, placementId, changes);
    this.commit();
  }

  removeSheetPlacement(sheetId: string, placementId: string): void {
    this.project.removeSheetPlacement(sheetId, placementId);
    this.commit();
  }

  updateView(viewId: string, changes: Parameters<NativeBimProject["updateView"]>[1]): void {
    this.project.updateView(viewId, changes);
    this.commit();
  }

  removeView(viewId: string): void {
    if (this.project.views.length <= 1) {
      this.statusMessage = "Cannot delete the last view";
      this.commit(false);
      return;
    }
    this.project.removeView(viewId);
    if (this.activeViewId === viewId) {
      this.activeViewId = this.project.views[0]?.id ?? null;
    }
    if (this.selection?.kind === "view" && this.selection.id === viewId) {
      this.selection = null;
    }
    this.commit();
  }

  activateView(viewId: string): void {
    this.activeSheetId = null;
    this.activeScheduleId = null;
    this.activeViewId = viewId;
    this.selection = { kind: "view", id: viewId };
    const view = this.activeView;
    if (view && view.viewType !== "FLOOR_PLAN" && this.activeTool !== "SELECT") {
      this.activeTool = "SELECT";
      this.pendingStart = null;
    }
    this.commit(false);
  }

  renameProject(name: string): void {
    this.project.name = name;
    this.commit();
  }

  newProject(): void {
    this.project = defaultProject();
    this.activeViewId = this.project.views[0]?.id ?? null;
    this.selection = null;
    this.pendingStart = null;
    this.statusMessage = "New project";
    this.commit();
  }

  serializeProject(): string {
    return JSON.stringify(this.project.toDict());
  }

  loadProjectJson(payload: string): void {
    this.project = NativeBimProject.fromJson(payload);
    if (this.project.views.length === 0) {
      this.project.addView("Level 1", "FLOOR_PLAN", 100, 40);
    }
    this.activeViewId = this.project.views[0].id;
    this.selection = null;
    this.pendingStart = null;
    this.statusMessage = `Loaded ${this.project.name}`;
    this.commit();
  }

  exportIfc(): string {
    return exportProjectToIfc(this.project);
  }
}

export const store = new AppStore();

store.sync = new SyncEngine({
  getProjectDict: () => store.project.toDict(),
  getProjectId: () => store.project.id,
  applyRemote: (projectDict) => store.applyRemoteProject(projectDict),
});

export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}
