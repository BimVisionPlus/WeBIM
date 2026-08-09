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
import { dashSpans, LINE_PATTERNS } from "../domain/lineStyles";
import type { GridDatum, Point3D, WallDatum } from "../domain/project";
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

export class GridViewport {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private canvas: HTMLCanvasElement;
  private gridGroup = new THREE.Group();
  private wallGroup = new THREE.Group();
  private previewGroup = new THREE.Group();
  private anchorGroup = new THREE.Group();
  private underlayGroup = new THREE.Group();
  private cursorWorld: Point3D = [0, 0, 0];
  private lastSnap: SnapResult | null = null;
  private endpointEdit: EndpointEdit | null = null;
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
    return (store.activeView?.viewType ?? "FLOOR_PLAN") === "FLOOR_PLAN";
  }

  private applyPlanCamera(): void {
    this.camera.position.set(0, 0, 500);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
  }

  private applyViewCamera(): void {
    const view = store.activeView;
    const key = view ? `${view.id}:${view.viewType}:${view.orthoScale}` : "plan";
    if (key === this.appliedViewKey) return;
    this.appliedViewKey = key;
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

  private allEndpoints(): Point3D[] {
    const points: Point3D[] = [];
    for (const axis of store.project.gridAxes) {
      points.push(axis.start, axis.end);
    }
    for (const wall of store.project.walls) {
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
    for (const wall of store.project.walls) {
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
      const anchor = this.pickAnchor(world);
      if (anchor) {
        this.endpointEdit = anchor;
        this.lastSnap = this.computeSnap(world);
        store.setStatus("Move the endpoint, click to confirm. Esc cancels.");
        this.syncPreview();
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
      if (this.endpointEdit) {
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
    } else if (event.key === "Delete" || event.key === "Backspace") {
      if (store.selection?.kind === "grid") {
        store.removeGridAxis(store.selection.id);
      } else if (store.selection?.kind === "wall") {
        store.removeWall(store.selection.id);
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
    if (this.endpointEdit && !this.editedElement()) {
      this.endpointEdit = null;
    }
    const factor = store.annotationViewFactor;
    const viewScale = store.activeView?.scale ?? 100;
    for (const axis of store.project.gridAxes) {
      const selected = store.selection?.kind === "grid" && store.selection.id === axis.id;
      const color = selected ? COLOR_SELECTED : COLOR_GRID;
      this.gridGroup.add(this.buildAxisLine(axis, viewScale, color));
      this.buildAxisHeads(axis, factor, color);
    }
    for (const wall of store.project.walls) {
      const selected = store.selection?.kind === "wall" && store.selection.id === wall.id;
      this.buildWall(wall, selected ? COLOR_SELECTED : COLOR_WALL);
    }
    this.buildAnchors();
    this.syncPreview();
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

  private buildWall(wall: WallDatum, color: number): void {
    const dx = wall.end[0] - wall.start[0];
    const dy = wall.end[1] - wall.start[1];
    const length = Math.hypot(dx, dy);
    if (length === 0) return;
    const geometry = new THREE.BoxGeometry(length, wall.thickness, wall.height);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const midX = (wall.start[0] + wall.end[0]) / 2;
    const midY = (wall.start[1] + wall.end[1]) / 2;
    const angle = Math.atan2(dy, dx);
    mesh.position.set(midX, midY, wall.start[2] + wall.height / 2);
    mesh.rotation.z = angle;
    this.wallGroup.add(mesh);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color }),
    );
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    this.wallGroup.add(edges);
  }

  private buildAnchors(): void {
    if (!this.inPlanView || store.activeTool !== "SELECT") return;
    const selection = store.selection;
    if (!selection || (selection.kind !== "grid" && selection.kind !== "wall")) return;
    const element =
      selection.kind === "grid"
        ? store.project.gridAxes.find((axis) => axis.id === selection.id)
        : store.project.walls.find((wall) => wall.id === selection.id);
    if (!element) return;
    for (const endpoint of ["start", "end"] as const) {
      const point = element[endpoint];
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
      circle.position.set(point[0], point[1], 0.2);
      this.anchorGroup.add(circle);
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
