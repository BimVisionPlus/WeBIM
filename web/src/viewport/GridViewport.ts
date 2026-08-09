// Three.js viewport — the web replacement for webim/blender.
// Renders native GridDatum linework with paper-scale dashes and Revit-style
// grid head bubbles, walls as extruded solids, and hosts the two-click
// grid/wall drawing tools plus anchor-based endpoint editing.
//
// Technical views drive the camera: floor plans look down -Z, elevations
// look along +Y, sections along +X — all orthographic, rotation locked,
// framed by the view's ortho scale.

import * as THREE from "three";
import { snapGridPoint, type SnapResult } from "../application/gridSnapping";
import { doorSwing, openingFootprint, wallPieces } from "../application/wallGeometry";
import { dashSpans, LINE_PATTERNS } from "../domain/lineStyles";
import type { GridDatum, OpeningDatum, Point3D, WallDatum } from "../domain/project";
import { store } from "../state/store";

export const GRID_HEAD_RADIUS = 0.35;
export const GRID_HEAD_GAP = 0.08;
const ENDPOINT_SNAP_PIXELS = 14;
const PICK_PIXELS = 8;
const ANCHOR_PIXELS = 7;
const ANCHOR_HIT_PIXELS = 12;

const COLOR_BACKGROUND = 0x1d1f24;
const COLOR_UNDERLAY = 0x2b2e36;
const COLOR_UNDERLAY_MAJOR = 0x363a44;
const COLOR_GRID = 0xc44536;
const COLOR_WALL = 0x9aa3b2;
const COLOR_DOOR = 0xb08968;
const COLOR_WINDOW = 0x7fb3d5;
const COLOR_LEVEL = 0x5f9e6e;
const COLOR_PAPER = 0x23262d;
const COLOR_PAPER_LINES = 0x8b8f98;

// A1 landscape paper, in metres of paper space.
const SHEET_WIDTH = 0.841;
const SHEET_HEIGHT = 0.594;
const SHEET_MARGIN = 0.01;
const COLOR_SELECTED = 0x4da3ff;
const COLOR_PREVIEW = 0x8fd460;
const COLOR_AXIS_LOCK = 0xffb454;
const COLOR_ANCHOR = 0xffb454;
const COLOR_TEXT = "#e8e6e3";

interface EndpointEdit {
  kind: "grid" | "wall";
  id: string;
  endpoint: "start" | "end";
}

export function gridHeadLocation(
  axis: GridDatum,
  endpoint: "START" | "END",
  factor: number,
): Point3D {
  const base = endpoint === "END" ? axis.end : axis.start;
  const opposite = endpoint === "END" ? axis.start : axis.end;
  const dx = base[0] - opposite[0];
  const dy = base[1] - opposite[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return base;
  }
  const offset = GRID_HEAD_RADIUS * axis.headScale * factor + GRID_HEAD_GAP;
  return [base[0] + (dx / length) * offset, base[1] + (dy / length) * offset, base[2]];
}

function makeTextSprite(label: string, worldSize: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 84px 'Inter', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(label, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(worldSize, worldSize, 1);
  return sprite;
}

/** Wide label sprite for level tags and sheet annotations. */
function makeLabelSprite(label: string, worldHeight: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "600 56px 'Inter', 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLOR_TEXT;
  ctx.fillText(label, 8, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(worldHeight * (512 / 96), worldHeight, 1);
  return sprite;
}

export class GridViewport {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private gridGroup = new THREE.Group();
  private wallGroup = new THREE.Group();
  private sheetGroup = new THREE.Group();
  private previewGroup = new THREE.Group();
  private anchorGroup = new THREE.Group();
  private underlayGroup = new THREE.Group();
  private cursorWorld: Point3D = [0, 0, 0];
  private lastSnap: SnapResult | null = null;
  private endpointEdit: EndpointEdit | null = null;
  private openingDrag: { wallId: string; openingId: string; offset: number } | null = null;
  private panning = false;
  private panStart = new THREE.Vector2();
  private cameraStart = new THREE.Vector3();
  private appliedViewKey = "";
  private frameHandle = 0;
  private disposed = false;
  private unsubscribe: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.scene.background = new THREE.Color(COLOR_BACKGROUND);
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
    const half = 20;
    this.camera = new THREE.OrthographicCamera(
      -half * aspect,
      half * aspect,
      half,
      -half,
      0.1,
      2000,
    );
    this.applyPlanCamera();

    this.scene.add(this.underlayGroup);
    this.scene.add(this.gridGroup);
    this.scene.add(this.wallGroup);
    this.scene.add(this.sheetGroup);
    this.scene.add(this.previewGroup);
    this.scene.add(this.anchorGroup);
    this.buildUnderlay();

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);

    this.unsubscribe = store.subscribe(() => this.syncProject());
    this.syncProject();
    let renderFailureLogged = false;
    const loop = () => {
      if (this.disposed) return;
      try {
        this.resizeIfNeeded();
        this.updateAnchorScale();
        this.renderer.render(this.scene, this.camera);
      } catch (error) {
        // Keep the loop alive: a silently dead loop freezes matrixWorld and
        // corrupts every later unproject.
        if (!renderFailureLogged) {
          renderFailureLogged = true;
          console.error("WeBIM viewport render failed", error);
        }
      }
      this.frameHandle = requestAnimationFrame(loop);
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    this.unsubscribe();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    this.renderer.dispose();
  }

  private get inPlanView(): boolean {
    if (store.activeSheet) return false;
    return (store.activeView?.viewType ?? "FLOOR_PLAN") === "FLOOR_PLAN";
  }

  private applyPlanCamera(): void {
    this.camera.position.set(0, 0, 500);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
  }

  private applyViewCamera(): void {
    const sheet = store.activeSheet;
    const view = store.activeView;
    const key = sheet
      ? `sheet:${sheet.id}`
      : view
        ? `${view.id}:${view.viewType}:${view.orthoScale}`
        : "plan";
    if (key === this.appliedViewKey) return;
    this.appliedViewKey = key;
    const aspectForSheet = this.canvas.clientWidth / Math.max(this.canvas.clientHeight, 1);
    if (sheet) {
      const half = SHEET_HEIGHT * 0.62;
      this.camera.top = half;
      this.camera.bottom = -half;
      this.camera.left = -half * aspectForSheet;
      this.camera.right = half * aspectForSheet;
      this.camera.position.set(SHEET_WIDTH / 2, SHEET_HEIGHT / 2, 500);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(SHEET_WIDTH / 2, SHEET_HEIGHT / 2, 0);
      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld(true);
      return;
    }
    const half = (view?.orthoScale ?? 40) / 2;
    const aspect = this.canvas.clientWidth / Math.max(this.canvas.clientHeight, 1);
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    switch (view?.viewType) {
      case "ELEVATION":
        // Look along +Y at the XZ plane.
        this.camera.position.set(0, -500, half / 2);
        this.camera.up.set(0, 0, 1);
        this.camera.lookAt(0, 0, half / 2);
        break;
      case "SECTION":
        // Look along +X at the YZ plane.
        this.camera.position.set(-500, 0, half / 2);
        this.camera.up.set(0, 0, 1);
        this.camera.lookAt(0, 0, half / 2);
        break;
      default:
        this.applyPlanCamera();
    }
    this.camera.updateProjectionMatrix();
    // lookAt only sets the quaternion; unproject reads matrixWorld, which is
    // otherwise recomposed no earlier than the next rendered frame.
    this.camera.updateMatrixWorld(true);
  }

  private buildUnderlay(): void {
    this.underlayGroup.clear();
    const size = 200;
    const minor: number[] = [];
    const major: number[] = [];
    for (let i = -size; i <= size; i += 1) {
      const target = i % 10 === 0 ? major : minor;
      target.push(i, -size, -1, i, size, -1);
      target.push(-size, i, -1, size, i, -1);
    }
    for (const [positions, color] of [
      [minor, COLOR_UNDERLAY],
      [major, COLOR_UNDERLAY_MAJOR],
    ] as const) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      this.underlayGroup.add(
        new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color })),
      );
    }
  }

  private resizeIfNeeded(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    const needResize = this.canvas.width !== Math.floor(width * window.devicePixelRatio);
    if (needResize) {
      this.renderer.setSize(width, height, false);
    }
    const currentHalfHeight = (this.camera.top - this.camera.bottom) / 2;
    const aspect = width / height;
    this.camera.left = -currentHalfHeight * aspect;
    this.camera.right = currentHalfHeight * aspect;
    this.camera.updateProjectionMatrix();
  }

  private worldPerPixel(): number {
    return (this.camera.top - this.camera.bottom) / this.canvas.clientHeight;
  }

  /** Cursor position on the Z=0 model plane (plan views only). */
  private screenToWorld(clientX: number, clientY: number): Point3D {
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    this.camera.updateMatrixWorld();
    const vector = new THREE.Vector3(ndcX, ndcY, 0).unproject(this.camera);
    return [vector.x, vector.y, 0];
  }

  /** Walls participating in the current view (plan filters by level). */
  private visibleWalls(): WallDatum[] {
    const levelId = this.inPlanView ? store.activeLevel?.id : undefined;
    return levelId
      ? store.project.walls.filter((wall) => wall.levelId === levelId)
      : store.project.walls;
  }

  private allEndpoints(): Point3D[] {
    const points: Point3D[] = [];
    for (const axis of store.project.gridAxes) {
      points.push(axis.start, axis.end);
    }
    for (const wall of this.visibleWalls()) {
      points.push(wall.start, wall.end);
    }
    return points;
  }

  private findEndpointSnap(world: Point3D): Point3D | null {
    const threshold = ENDPOINT_SNAP_PIXELS * this.worldPerPixel();
    let best: Point3D | null = null;
    let bestDistance = threshold;
    const edited = this.editedElement();
    for (const point of this.allEndpoints()) {
      if (edited && (point === edited.start || point === edited.end)) continue;
      const distance = Math.hypot(point[0] - world[0], point[1] - world[1]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
    return best;
  }

  private editedElement(): GridDatum | WallDatum | null {
    if (!this.endpointEdit) return null;
    const { kind, id } = this.endpointEdit;
    return kind === "grid"
      ? (store.project.gridAxes.find((axis) => axis.id === id) ?? null)
      : (store.project.walls.find((wall) => wall.id === id) ?? null);
  }

  private computeSnap(world: Point3D): SnapResult {
    let start: Point3D | null = store.pendingStart;
    if (this.endpointEdit) {
      const element = this.editedElement();
      if (element) {
        start = this.endpointEdit.endpoint === "start" ? element.end : element.start;
      }
    }
    return snapGridPoint(world, {
      start,
      endpoint: this.findEndpointSnap(world),
      increment: store.snapIncrement,
    });
  }

  /** Anchor of the selected opening: its centre point on the wall axis. */
  private openingAnchorPoint(): { wall: WallDatum; opening: OpeningDatum; point: Point3D } | null {
    const selection = store.selection;
    if (selection?.kind !== "opening") return null;
    const wall = store.project.openingHost(selection.id);
    const opening = wall?.openings.find((candidate) => candidate.id === selection.id);
    if (!wall || !opening) return null;
    const dx = wall.end[0] - wall.start[0];
    const dy = wall.end[1] - wall.start[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) return null;
    return {
      wall,
      opening,
      point: [
        wall.start[0] + (dx / length) * opening.offset,
        wall.start[1] + (dy / length) * opening.offset,
        wall.start[2],
      ],
    };
  }

  private pickOpeningAnchor(world: Point3D): { wall: WallDatum; opening: OpeningDatum } | null {
    const anchor = this.openingAnchorPoint();
    if (!anchor) return null;
    const threshold = ANCHOR_HIT_PIXELS * this.worldPerPixel();
    const distance = Math.hypot(anchor.point[0] - world[0], anchor.point[1] - world[1]);
    return distance < threshold ? { wall: anchor.wall, opening: anchor.opening } : null;
  }

  private pickAnchor(world: Point3D): EndpointEdit | null {
    const selection = store.selection;
    if (!selection || (selection.kind !== "grid" && selection.kind !== "wall")) return null;
    const element =
      selection.kind === "grid"
        ? store.project.gridAxes.find((axis) => axis.id === selection.id)
        : store.project.walls.find((wall) => wall.id === selection.id);
    if (!element) return null;
    const threshold = ANCHOR_HIT_PIXELS * this.worldPerPixel();
    for (const endpoint of ["start", "end"] as const) {
      const point = element[endpoint];
      if (Math.hypot(point[0] - world[0], point[1] - world[1]) < threshold) {
        return { kind: selection.kind, id: selection.id, endpoint };
      }
    }
    return null;
  }

  private pickWall(world: Point3D): WallDatum | null {
    const pixelThreshold = PICK_PIXELS * this.worldPerPixel();
    let best: WallDatum | null = null;
    let bestDistance = Infinity;
    for (const wall of this.visibleWalls()) {
      const distance = distanceToSegment(world, wall.start, wall.end);
      const threshold = Math.max(pixelThreshold, wall.thickness / 2);
      if (distance < threshold && distance < bestDistance) {
        bestDistance = distance;
        best = wall;
      }
    }
    return best;
  }

  private pickOpening(world: Point3D): { wall: WallDatum; opening: OpeningDatum } | null {
    const tolerance = PICK_PIXELS * this.worldPerPixel();
    for (const wall of this.visibleWalls()) {
      const dx = wall.end[0] - wall.start[0];
      const dy = wall.end[1] - wall.start[1];
      const length = Math.hypot(dx, dy);
      if (length === 0) continue;
      const along =
        ((world[0] - wall.start[0]) * dx + (world[1] - wall.start[1]) * dy) / length;
      const perp =
        ((world[0] - wall.start[0]) * (-dy / length)) +
        ((world[1] - wall.start[1]) * (dx / length));
      for (const opening of wall.openings) {
        if (
          Math.abs(along - opening.offset) <= opening.width / 2 &&
          Math.abs(perp) <= wall.thickness / 2 + tolerance
        ) {
          return { wall, opening };
        }
      }
    }
    return null;
  }

  /** Snapped opening offset for a cursor position, clamped into the wall. */
  private offsetOnWall(wall: WallDatum, world: Point3D, width: number): number {
    const dx = wall.end[0] - wall.start[0];
    const dy = wall.end[1] - wall.start[1];
    const length = Math.hypot(dx, dy);
    const along = ((world[0] - wall.start[0]) * dx + (world[1] - wall.start[1]) * dy) / length;
    const snapped = Math.round(along / store.snapIncrement) * store.snapIncrement;
    return Number(Math.min(Math.max(snapped, width / 2), length - width / 2).toFixed(10));
  }

  private placeOpening(world: Point3D, kind: "DOOR" | "WINDOW"): void {
    const wall = this.pickWall(world);
    if (!wall) {
      store.setStatus("Click on a wall to place the opening");
      return;
    }
    const width = kind === "DOOR" ? 0.9 : 1.2;
    try {
      store.addOpening(wall.id, kind, this.offsetOnWall(wall, world, width));
    } catch (error) {
      store.setStatus((error as Error).message);
    }
  }

  private draggedOpening(): { wall: WallDatum; opening: OpeningDatum } | null {
    if (!this.openingDrag) return null;
    const wall = store.project.walls.find((candidate) => candidate.id === this.openingDrag!.wallId);
    const opening = wall?.openings.find(
      (candidate) => candidate.id === this.openingDrag!.openingId,
    );
    return wall && opening ? { wall, opening } : null;
  }

  private pickElement(world: Point3D): { kind: "grid" | "wall"; id: string } | null {
    const pixelThreshold = PICK_PIXELS * this.worldPerPixel();
    let best: { kind: "grid" | "wall"; id: string } | null = null;
    let bestDistance = Infinity;
    for (const axis of store.project.gridAxes) {
      const distance = distanceToSegment(world, axis.start, axis.end);
      if (distance < pixelThreshold && distance < bestDistance) {
        bestDistance = distance;
        best = { kind: "grid", id: axis.id };
      }
    }
    for (const wall of this.visibleWalls()) {
      const distance = distanceToSegment(world, wall.start, wall.end);
      const threshold = Math.max(pixelThreshold, wall.thickness / 2);
      if (distance < threshold && distance < bestDistance) {
        bestDistance = distance;
        best = { kind: "wall", id: wall.id };
      }
    }
    return best;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button === 1 || event.button === 2 || (event.button === 0 && event.shiftKey)) {
      this.panning = true;
      this.panStart.set(event.clientX, event.clientY);
      this.cameraStart.copy(this.camera.position);
      this.canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0 || !this.inPlanView) return;
    const world = this.screenToWorld(event.clientX, event.clientY);

    if (this.openingDrag) {
      // Second click commits the opening move.
      const dragged = this.draggedOpening();
      if (dragged) {
        try {
          store.updateOpening(dragged.wall.id, dragged.opening.id, {
            offset: this.openingDrag.offset,
          });
          store.setStatus("Opening moved");
        } catch (error) {
          store.setStatus((error as Error).message);
        }
      }
      this.openingDrag = null;
      this.syncPreview();
      return;
    }

    if (this.endpointEdit) {
      // Second click commits the endpoint move.
      const snap = this.computeSnap(world);
      const { kind, id, endpoint } = this.endpointEdit;
      try {
        if (kind === "grid") {
          store.updateGridAxis(id, { [endpoint]: snap.point });
        } else {
          store.updateWall(id, { [endpoint]: snap.point });
        }
        store.setStatus("Endpoint updated");
      } catch (error) {
        store.setStatus((error as Error).message);
      }
      this.endpointEdit = null;
      this.syncPreview();
      return;
    }

    if (store.activeTool === "DOOR" || store.activeTool === "WINDOW") {
      this.placeOpening(world, store.activeTool);
      return;
    }

    if (store.activeTool === "GRID" || store.activeTool === "WALL") {
      const snap = this.computeSnap(world);
      if (store.pendingStart === null) {
        store.setPendingStart(snap.point);
        store.setStatus(
          store.activeTool === "GRID" ? "Grid: click the end point" : "Wall: click the end point",
        );
      } else {
        const start = store.pendingStart;
        if (
          start[0] !== snap.point[0] ||
          start[1] !== snap.point[1] ||
          start[2] !== snap.point[2]
        ) {
          if (store.activeTool === "GRID") {
            store.addGridAxis(start, snap.point);
          } else {
            store.addWall(start, snap.point);
          }
        }
        store.setPendingStart(null);
      }
      this.syncPreview();
    } else {
      const openingAnchor = this.pickOpeningAnchor(world);
      if (openingAnchor) {
        this.openingDrag = {
          wallId: openingAnchor.wall.id,
          openingId: openingAnchor.opening.id,
          offset: openingAnchor.opening.offset,
        };
        store.setStatus("Move the opening along the wall, click to confirm. Esc cancels.");
        this.syncPreview();
        return;
      }
      const anchor = this.pickAnchor(world);
      if (anchor) {
        this.endpointEdit = anchor;
        this.lastSnap = this.computeSnap(world);
        store.setStatus("Move the endpoint, click to confirm. Esc cancels.");
        this.syncPreview();
        return;
      }
      const openingHit = this.pickOpening(world);
      if (openingHit) {
        store.select({ kind: "opening", id: openingHit.opening.id });
        return;
      }
      const hit = this.pickElement(world);
      store.select(hit ? { kind: hit.kind, id: hit.id } : null);
    }
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.panning) {
      const worldPerPixel = this.worldPerPixel();
      const dx = (event.clientX - this.panStart.x) * worldPerPixel;
      const dy = (event.clientY - this.panStart.y) * worldPerPixel;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      this.camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
      this.camera.position
        .copy(this.cameraStart)
        .addScaledVector(right, -dx)
        .addScaledVector(up, dy);
      return;
    }
    if (!this.inPlanView) return;
    this.cursorWorld = this.screenToWorld(event.clientX, event.clientY);
    if (this.openingDrag) {
      const dragged = this.draggedOpening();
      if (dragged) {
        this.openingDrag.offset = this.offsetOnWall(
          dragged.wall,
          this.cursorWorld,
          dragged.opening.width,
        );
        this.syncPreview();
      }
      return;
    }
    if (store.activeTool === "GRID" || store.activeTool === "WALL" || this.endpointEdit) {
      this.lastSnap = this.computeSnap(this.cursorWorld);
      this.syncPreview();
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.panning) {
      this.panning = false;
      this.canvas.releasePointerCapture(event.pointerId);
    }
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const factor = Math.exp(event.deltaY * 0.001);
    const before = this.screenToWorld(event.clientX, event.clientY);
    this.camera.top *= factor;
    this.camera.bottom *= factor;
    this.camera.left *= factor;
    this.camera.right *= factor;
    this.camera.updateProjectionMatrix();
    if (this.inPlanView) {
      const after = this.screenToWorld(event.clientX, event.clientY);
      this.camera.position.x += before[0] - after[0];
      this.camera.position.y += before[1] - after[1];
    }
  };

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    if (this.openingDrag) {
      this.openingDrag = null;
      store.setStatus("Opening move cancelled");
      this.syncPreview();
      return;
    }
    if (this.endpointEdit) {
      this.endpointEdit = null;
      store.setStatus("Endpoint edit cancelled");
      this.syncPreview();
      return;
    }
    if (store.activeTool !== "SELECT") {
      if (store.pendingStart) {
        store.setPendingStart(null);
      } else {
        store.setTool("SELECT");
      }
      this.syncPreview();
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
      return;
    }
    if (event.key === "Escape") {
      if (this.openingDrag) {
        this.openingDrag = null;
        store.setStatus("Opening move cancelled");
      } else if (this.endpointEdit) {
        this.endpointEdit = null;
        store.setStatus("Endpoint edit cancelled");
      } else if (store.activeTool !== "SELECT" && store.pendingStart) {
        store.setPendingStart(null);
        store.setStatus("Click the start point");
      } else if (store.activeTool !== "SELECT") {
        store.setTool("SELECT");
      } else {
        store.select(null);
      }
      this.syncPreview();
    } else if (event.key === "Enter" && store.activeTool !== "SELECT") {
      store.setTool("SELECT");
      this.syncPreview();
    } else if ((event.key === "g" || event.key === "G") && store.activeTool !== "GRID") {
      store.setTool("GRID");
    } else if ((event.key === "w" || event.key === "W") && store.activeTool !== "WALL") {
      store.setTool("WALL");
    } else if ((event.key === "d" || event.key === "D") && store.activeTool !== "DOOR") {
      store.setTool("DOOR");
    } else if ((event.key === "o" || event.key === "O") && store.activeTool !== "WINDOW") {
      store.setTool("WINDOW");
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if (store.selection?.kind === "grid") {
        store.removeGridAxis(store.selection.id);
      } else if (store.selection?.kind === "wall") {
        store.removeWall(store.selection.id);
      } else if (store.selection?.kind === "opening") {
        const host = store.project.openingHost(store.selection.id);
        if (host) {
          store.removeOpening(host.id, store.selection.id);
        }
      }
    }
  };

  private disposeGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if (
        child instanceof THREE.LineSegments ||
        child instanceof THREE.Line ||
        child instanceof THREE.Mesh
      ) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    });
    group.clear();
  }

  syncProject(): void {
    this.applyViewCamera();
    this.disposeGroup(this.gridGroup);
    this.disposeGroup(this.wallGroup);
    this.disposeGroup(this.anchorGroup);
    this.disposeGroup(this.sheetGroup);
    if (this.endpointEdit && !this.editedElement()) {
      this.endpointEdit = null;
    }
    if (this.openingDrag && !this.draggedOpening()) {
      this.openingDrag = null;
    }

    const sheet = store.activeSheet;
    this.underlayGroup.visible = !sheet;
    if (sheet) {
      this.buildSheet(sheet);
      this.syncPreview();
      return;
    }

    const factor = store.annotationViewFactor;
    const viewScale = store.activeView?.scale ?? 100;
    const viewType = store.activeView?.viewType ?? "FLOOR_PLAN";
    for (const axis of store.project.gridAxes) {
      const selected = store.selection?.kind === "grid" && store.selection.id === axis.id;
      const color = selected ? COLOR_SELECTED : COLOR_GRID;
      if (viewType === "FLOOR_PLAN") {
        this.gridGroup.add(this.buildAxisLine(axis, viewScale, color));
        this.buildAxisHeads(axis, factor, color);
      } else {
        this.buildDatumGrid(axis, viewType, viewScale, factor, color);
      }
    }
    if (viewType !== "FLOOR_PLAN") {
      this.buildLevelLines(viewType, factor);
    }
    // Floor plans show only their own level's walls; elevations show all.
    const activeLevelId = store.activeLevel?.id;
    for (const wall of store.project.walls) {
      if (viewType === "FLOOR_PLAN" && activeLevelId && wall.levelId !== activeLevelId) {
        continue;
      }
      const selected = store.selection?.kind === "wall" && store.selection.id === wall.id;
      this.buildWall(wall, selected ? COLOR_SELECTED : COLOR_WALL);
    }
    this.buildAnchors();
    this.syncPreview();
  }

  /** Level datum lines with name tags, drawn in elevations and sections. */
  private buildLevelLines(viewType: "ELEVATION" | "SECTION", factor: number): void {
    const span = 30;
    for (const level of store.project.levels) {
      const selected = store.selection?.kind === "level" && store.selection.id === level.id;
      const color = selected ? COLOR_SELECTED : COLOR_LEVEL;
      const z = level.elevation;
      const toWorld = (h: number): [number, number, number] =>
        viewType === "ELEVATION" ? [h, 0, z] : [0, h, z];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute([...toWorld(-span), ...toWorld(span)], 3),
      );
      this.gridGroup.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color })));
      const label = makeLabelSprite(
        `${level.name}  +${level.elevation.toFixed(2)}`,
        0.45 * factor,
      );
      const [lx, ly, lz] = toWorld(span - 4);
      label.position.set(lx, ly, lz + 0.35 * factor);
      this.gridGroup.add(label);
    }
  }

  /** Paper space: titleblock plus a frame per placed view. */
  private buildSheet(sheet: import("../domain/project").SheetDatum): void {
    const rect = (
      x: number,
      y: number,
      width: number,
      height: number,
      color: number,
    ): void => {
      const positions = [
        x, y, 0, x + width, y, 0,
        x + width, y, 0, x + width, y + height, 0,
        x + width, y + height, 0, x, y + height, 0,
        x, y + height, 0, x, y, 0,
      ];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      this.sheetGroup.add(
        new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color })),
      );
    };

    // Paper background.
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(SHEET_WIDTH, SHEET_HEIGHT),
      new THREE.MeshBasicMaterial({ color: COLOR_PAPER }),
    );
    paper.position.set(SHEET_WIDTH / 2, SHEET_HEIGHT / 2, -0.01);
    this.sheetGroup.add(paper);
    rect(0, 0, SHEET_WIDTH, SHEET_HEIGHT, COLOR_PAPER_LINES);
    rect(
      SHEET_MARGIN,
      SHEET_MARGIN,
      SHEET_WIDTH - 2 * SHEET_MARGIN,
      SHEET_HEIGHT - 2 * SHEET_MARGIN,
      COLOR_PAPER_LINES,
    );
    // Titleblock, bottom-right.
    const titleWidth = 0.24;
    const titleHeight = 0.06;
    rect(
      SHEET_WIDTH - SHEET_MARGIN - titleWidth,
      SHEET_MARGIN,
      titleWidth,
      titleHeight,
      COLOR_PAPER_LINES,
    );
    const titleLabel = makeLabelSprite(`${sheet.name} — ${sheet.title}`, 0.02);
    titleLabel.position.set(
      SHEET_WIDTH - SHEET_MARGIN - titleWidth + 0.055,
      SHEET_MARGIN + titleHeight / 2,
      0.01,
    );
    this.sheetGroup.add(titleLabel);

    for (const placement of sheet.placements) {
      const view = store.project.views.find((candidate) => candidate.id === placement.viewId);
      if (!view) continue;
      // Frame size: the view's model extent printed at its scale.
      const frameWidth = view.orthoScale / view.scale;
      const frameHeight = frameWidth * 0.7;
      const x = placement.x / 1000;
      const y = placement.y / 1000;
      rect(x, y, frameWidth, frameHeight, COLOR_PAPER_LINES);
      const label = makeLabelSprite(`${view.name} · 1:${view.scale}`, 0.016);
      label.position.set(x + 0.045, y - 0.014, 0.01);
      this.sheetGroup.add(label);
    }
  }

  private buildAxisLine(axis: GridDatum, viewScale: number, color: number): THREE.LineSegments {
    const pattern = LINE_PATTERNS.get(axis.linePattern) ?? LINE_PATTERNS.get("CONTINUOUS")!;
    const dx = axis.end[0] - axis.start[0];
    const dy = axis.end[1] - axis.start[1];
    const length = Math.hypot(dx, dy);
    const positions: number[] = [];
    const spans = length > 0 ? dashSpans(length, pattern, viewScale) : [];
    for (const [from, to] of spans) {
      positions.push(
        axis.start[0] + (dx / length) * from,
        axis.start[1] + (dy / length) * from,
        0,
        axis.start[0] + (dx / length) * to,
        axis.start[1] + (dy / length) * to,
        0,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
  }

  private buildAxisHeads(axis: GridDatum, factor: number, color: number): void {
    if (axis.headType === "NONE") return;
    const pointCount = axis.headType === "HEXAGON" ? 6 : 48;
    const radius = GRID_HEAD_RADIUS * axis.headScale * factor;
    for (const endpoint of ["START", "END"] as const) {
      const center = gridHeadLocation(axis, endpoint, factor);
      const positions: number[] = [];
      for (let i = 0; i < pointCount; i += 1) {
        const a0 = (Math.PI * 2 * i) / pointCount;
        const a1 = (Math.PI * 2 * (i + 1)) / pointCount;
        positions.push(
          center[0] + radius * Math.cos(a0),
          center[1] + radius * Math.sin(a0),
          0,
          center[0] + radius * Math.cos(a1),
          center[1] + radius * Math.sin(a1),
          0,
        );
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      this.gridGroup.add(
        new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color })),
      );
      const sprite = makeTextSprite(axis.name, radius * 1.6);
      sprite.position.set(center[0], center[1], 0.1);
      this.gridGroup.add(sprite);
    }
  }

  /** Top of the vertical datum extent: a margin above the tallest wall. */
  private datumTopZ(): number {
    const wallTop = store.project.walls.reduce(
      (top, wall) => Math.max(top, wall.start[2] + wall.height),
      3,
    );
    return wallTop + 1;
  }

  /**
   * Revit-style grid datum in an elevation/section: a vertical dashed line
   * with the head bubble above the top, shown only for grids whose axis is
   * perpendicular to the view plane (they project to a single position).
   */
  private buildDatumGrid(
    axis: GridDatum,
    viewType: "ELEVATION" | "SECTION",
    viewScale: number,
    factor: number,
    color: number,
  ): void {
    // Screen-horizontal world coordinate: X in elevations, Y in sections.
    const h = viewType === "ELEVATION" ? 0 : 1;
    if (Math.abs(axis.start[h] - axis.end[h]) > 0.01) return;
    const position = (axis.start[h] + axis.end[h]) / 2;
    const bottom = 0;
    const top = this.datumTopZ();
    const toWorld = (offset: number, z: number): [number, number, number] =>
      viewType === "ELEVATION" ? [position + offset, 0, z] : [0, position + offset, z];

    const pattern = LINE_PATTERNS.get(axis.linePattern) ?? LINE_PATTERNS.get("CONTINUOUS")!;
    const positions: number[] = [];
    for (const [from, to] of dashSpans(top - bottom, pattern, viewScale)) {
      positions.push(...toWorld(0, bottom + from), ...toWorld(0, bottom + to));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.gridGroup.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color })));

    if (axis.headType === "NONE") return;
    const radius = GRID_HEAD_RADIUS * axis.headScale * factor;
    const centerZ = top + radius + GRID_HEAD_GAP;
    const pointCount = axis.headType === "HEXAGON" ? 6 : 48;
    const headPositions: number[] = [];
    for (let i = 0; i < pointCount; i += 1) {
      const a0 = (Math.PI * 2 * i) / pointCount;
      const a1 = (Math.PI * 2 * (i + 1)) / pointCount;
      headPositions.push(
        ...toWorld(radius * Math.cos(a0), centerZ + radius * Math.sin(a0)),
        ...toWorld(radius * Math.cos(a1), centerZ + radius * Math.sin(a1)),
      );
    }
    const headGeometry = new THREE.BufferGeometry();
    headGeometry.setAttribute("position", new THREE.Float32BufferAttribute(headPositions, 3));
    this.gridGroup.add(
      new THREE.LineSegments(headGeometry, new THREE.LineBasicMaterial({ color })),
    );
    const sprite = makeTextSprite(axis.name, radius * 1.6);
    const [sx, sy, sz] = toWorld(0, centerZ);
    sprite.position.set(sx, sy, sz + 0.001);
    this.gridGroup.add(sprite);
  }

  private buildWall(wall: WallDatum, color: number): void {
    const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
    if (length === 0) return;
    // Mitered footprint decomposed into pieces around openings, extruded up.
    for (const piece of wallPieces(wall, store.project.walls)) {
      const shape = new THREE.Shape(piece.corners.map(([x, y]) => new THREE.Vector2(x, y)));
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: piece.zTop - piece.zBottom,
        bevelEnabled: false,
      });
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(0, 0, wall.start[2] + piece.zBottom);
      this.wallGroup.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color }),
      );
      edges.position.copy(mesh.position);
      this.wallGroup.add(edges);
    }
    for (const opening of wall.openings) {
      this.buildOpening(wall, opening);
    }
  }

  private buildOpening(wall: WallDatum, opening: OpeningDatum): void {
    const selected = store.selection?.kind === "opening" && store.selection.id === opening.id;
    const fillColor = selected
      ? COLOR_SELECTED
      : opening.kind === "DOOR"
        ? COLOR_DOOR
        : COLOR_WINDOW;
    const dx = wall.end[0] - wall.start[0];
    const dy = wall.end[1] - wall.start[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const angle = Math.atan2(dy, dx);
    const centerX = wall.start[0] + (dx / length) * opening.offset;
    const centerY = wall.start[1] + (dy / length) * opening.offset;

    // Thin filling panel so doors/windows read in elevations.
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(opening.width, 0.06, opening.height),
      new THREE.MeshBasicMaterial({
        color: fillColor,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    panel.position.set(
      centerX,
      centerY,
      wall.start[2] + opening.sillHeight + opening.height / 2,
    );
    panel.rotation.z = angle;
    this.wallGroup.add(panel);
    const panelEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(panel.geometry as THREE.BoxGeometry),
      new THREE.LineBasicMaterial({ color: fillColor }),
    );
    panelEdges.position.copy(panel.position);
    panelEdges.rotation.copy(panel.rotation);
    this.wallGroup.add(panelEdges);

    // Plan marker: opening rectangle drawn above the wall top.
    const corners = openingFootprint(wall, opening);
    const markerZ = wall.start[2] + wall.height + 0.05;
    if (corners.length === 4) {
      const positions: number[] = [];
      for (let i = 0; i < 4; i += 1) {
        const [x0, y0] = corners[i];
        const [x1, y1] = corners[(i + 1) % 4];
        positions.push(x0, y0, markerZ, x1, y1, markerZ);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      this.wallGroup.add(
        new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: fillColor })),
      );
    }

    // Door swing symbol, plan views only: open leaf + quarter arc.
    if (this.inPlanView) {
      const swing = doorSwing(wall, opening);
      if (swing) {
        const positions: number[] = [
          swing.hinge[0], swing.hinge[1], markerZ,
          swing.leafEnd[0], swing.leafEnd[1], markerZ,
        ];
        for (let i = 0; i < swing.arc.length - 1; i += 1) {
          positions.push(
            swing.arc[i][0], swing.arc[i][1], markerZ,
            swing.arc[i + 1][0], swing.arc[i + 1][1], markerZ,
          );
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        this.wallGroup.add(
          new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: fillColor })),
        );
      }
    }
  }

  private addAnchorCircle(x: number, y: number, z: number): void {
    const positions: number[] = [];
    const segments = 24;
    for (let i = 0; i < segments; i += 1) {
      const a0 = (Math.PI * 2 * i) / segments;
      const a1 = (Math.PI * 2 * (i + 1)) / segments;
      positions.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const circle = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: COLOR_ANCHOR }),
    );
    circle.position.set(x, y, z);
    this.anchorGroup.add(circle);
  }

  private buildAnchors(): void {
    if (!this.inPlanView || store.activeTool !== "SELECT") return;
    const openingAnchor = this.openingAnchorPoint();
    if (openingAnchor) {
      const z = openingAnchor.point[2] + openingAnchor.wall.height + 0.1;
      this.addAnchorCircle(openingAnchor.point[0], openingAnchor.point[1], z);
      return;
    }
    const selection = store.selection;
    if (!selection || (selection.kind !== "grid" && selection.kind !== "wall")) return;
    const element =
      selection.kind === "grid"
        ? store.project.gridAxes.find((axis) => axis.id === selection.id)
        : store.project.walls.find((wall) => wall.id === selection.id);
    if (!element) return;
    for (const endpoint of ["start", "end"] as const) {
      const point = element[endpoint];
      this.addAnchorCircle(point[0], point[1], 0.2);
    }
  }

  /** Anchor circles keep a constant screen size across zoom levels. */
  private updateAnchorScale(): void {
    const scale = ANCHOR_PIXELS * this.worldPerPixel();
    for (const child of this.anchorGroup.children) {
      child.scale.set(scale, scale, 1);
    }
  }

  private syncPreview(): void {
    this.disposeGroup(this.previewGroup);

    // Ghost rectangle while an opening is being moved along its wall.
    if (this.openingDrag) {
      const dragged = this.draggedOpening();
      if (dragged) {
        const ghost = openingFootprint(dragged.wall, {
          ...dragged.opening,
          offset: this.openingDrag.offset,
        });
        if (ghost.length === 4) {
          const z = dragged.wall.start[2] + dragged.wall.height + 0.15;
          const positions: number[] = [];
          for (let i = 0; i < 4; i += 1) {
            const [x0, y0] = ghost[i];
            const [x1, y1] = ghost[(i + 1) % 4];
            positions.push(x0, y0, z, x1, y1, z);
          }
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
          this.previewGroup.add(
            new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: COLOR_PREVIEW })),
          );
        }
      }
      return;
    }

    const snap = this.lastSnap;
    const drawing = store.activeTool === "GRID" || store.activeTool === "WALL";
    if (!drawing && !this.endpointEdit) return;

    let previewStart: Point3D | null = store.pendingStart;
    if (this.endpointEdit) {
      const element = this.editedElement();
      if (element) {
        previewStart = this.endpointEdit.endpoint === "start" ? element.end : element.start;
      }
    }

    if (previewStart && snap) {
      const color =
        snap.kind === "AXIS_X" || snap.kind === "AXIS_Y" ? COLOR_AXIS_LOCK : COLOR_PREVIEW;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [previewStart[0], previewStart[1], 0.05, snap.point[0], snap.point[1], 0.05],
          3,
        ),
      );
      this.previewGroup.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color })));
    }
    if (snap) {
      const size = 5 * this.worldPerPixel();
      const marker = new THREE.BufferGeometry();
      const [x, y] = snap.point;
      marker.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            x - size, y - size, 0.05, x + size, y - size, 0.05,
            x + size, y - size, 0.05, x + size, y + size, 0.05,
            x + size, y + size, 0.05, x - size, y + size, 0.05,
            x - size, y + size, 0.05, x - size, y - size, 0.05,
          ],
          3,
        ),
      );
      const color = snap.kind === "ENDPOINT" ? COLOR_AXIS_LOCK : COLOR_PREVIEW;
      this.previewGroup.add(
        new THREE.LineSegments(marker, new THREE.LineBasicMaterial({ color })),
      );
    }
  }
}

function distanceToSegment(point: Point3D, start: Point3D, end: Point3D): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }
  let t = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
}
