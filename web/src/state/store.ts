import { useSyncExternalStore } from "react";
import { NativeBimProject, type Point3D } from "../domain/project";
import { exportProjectToIfc } from "../export/ifcGrid";

export type ToolId = "SELECT" | "GRID" | "WALL" | "DOOR" | "WINDOW";

export interface Selection {
  kind: "grid" | "view" | "wall" | "opening";
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
  project.addView("Level 1", "FLOOR_PLAN", 100, 40);
  return project;
}

class AppStore {
  project: NativeBimProject;
  activeTool: ToolId = "SELECT";
  selection: Selection | null = null;
  activeViewId: string | null = null;
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

  private commit(persist = true): void {
    this.version += 1;
    if (persist) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.project.toDict()));
      if (this.activeViewId) {
        localStorage.setItem(ACTIVE_VIEW_KEY, this.activeViewId);
      }
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  get activeView() {
    return this.project.views.find((view) => view.id === this.activeViewId) ?? null;
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
    const prefix =
      viewType === "FLOOR_PLAN" ? "Level" : viewType === "SECTION" ? "Section" : "Elevation";
    const count = this.project.views.filter((view) => view.viewType === viewType).length;
    const view = this.project.addView(`${prefix} ${count + 1}`, viewType);
    this.activeViewId = view.id;
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

export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}
