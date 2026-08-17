import { useSyncExternalStore } from "react";
import { NativeBimProject, type Point3D } from "../domain/project";
import { exportProjectToIfc } from "../export/ifcGrid";
import { collectElements, SyncEngine, type ElementRecord, type PeerPresence } from "../sync/syncEngine";
import {
  applyUndo,
  diffElements,
  invert,
  type HistoryItem,
  type UndoEntry,
} from "../sync/history";
import { parseIfc, type LinkedElement } from "../ifc/parseIfc";
import { buildDemoProject } from "../demo/seedProject";
import { pairKey, ruleFor } from "../application/clashMatrix";
import { analyseProject } from "../application/pccc";
import type { ClashRule, FireSettings } from "../domain/project";
import { sectionById, sectionOfPane, type PaneId, type SectionId } from "../ui/navigation";

export type ToolId =
  | "SELECT"
  | "GRID"
  | "WALL"
  | "DOOR"
  | "WINDOW"
  | "FLOOR"
  | "ROOF"
  | "ROOM"
  | "MASS"
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
    | "dimension"
    | "document"
    | "task"
    | "room"
    | "mass";
  id: string;
}

// The pane the main area is showing, and the branch of the workflow it
// belongs to. Two fields rather than one because the branch bar must stay lit
// on the right branch even when a pane is reached without clicking through it.
export type { PaneId, SectionId } from "../ui/navigation";

import { apiBase } from "../config";

/** Platform file API base (same host as the sync relay). */
export function fileServerBase(): string {
  return apiBase();
}

const AUTH_KEY = "webim.auth";

export interface AuthSession {
  token: string;
  username: string;
  role: "admin" | "editor" | "viewer";
}

export function authSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const session = authSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}

/** Thrown instead of a bare "Failed to fetch" when there is no server at all. */
export const NO_PLATFORM_SERVER =
  "Chế độ độc lập — chưa có máy chủ nền tảng nên chưa lưu/đọc được file.";

/** Fetch a stored file with credentials and hand back an object URL. */
export async function fetchFileUrl(key: string): Promise<string> {
  if (store.standalone) throw new Error(NO_PLATFORM_SERVER);
  const response = await fetch(
    `${fileServerBase()}/files/${encodeURIComponent(key)}`,
    { headers: authHeaders() },
  );
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }
  return URL.createObjectURL(await response.blob());
}

const STORAGE_KEY = "webim.native_project";
// Linked reference models are per-project, not per-browser. Keying them by
// project id is what stops "New" from opening a fresh project that already
// contains someone else's structural model — and it means reopening a project
// brings its own links back.
const LINKED_MODELS_KEY = "webim.linked_models";
const linkedModelsKey = (projectId: string) => `${LINKED_MODELS_KEY}:${projectId}`;

export interface LinkedModel {
  name: string;
  elements: LinkedElement[];
  skipped: number;
  /** Đã có hình học đầy đủ từ web-ifc trong phiên này chưa. */
  fullGeometry?: boolean;
}
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

export class AppStore {
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
  activePane: PaneId = "HOME";
  activeSection: SectionId = "HOME";
  /** External IFC models linked for clash checking (local, not synced). */
  linkedModels: LinkedModel[] = [];
  /**
   * Mesh tam giác thật của model link, theo tên file — CHỈ trong phiên.
   * Một model vừa phải là hàng chục MB Float32Array; localStorage chết ở
   * 5 MB, nên chỉ AABB được lưu bền. Reload → viewer rơi về hộp bao cho tới
   * khi link lại file, và chip model nói rõ điều đó.
   */
  meshCache = new Map<string, import("../ifc/realGeometry").RealMesh[]>();
  /** Lịch sử phiên — chỉ để đọc; undo/redo dùng hai stack riêng bên dưới. */
  history: HistoryItem[] = [];
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];
  /** Snapshot phần tử sau lần commit/merge gần nhất — mốc so cho bước kế. */
  private lastElements: Map<string, ElementRecord> | null = null;
  /** Đang áp undo/redo — commit trong lúc đó không được tự ghi thêm bước. */
  private replaying = false;

  /**
   * Quyền của TÔI trong DỰ ÁN NÀY, hỏi máy chủ (/projects/:id/members).
   * null = chưa biết (standalone, chưa đăng nhập, server cũ) — khi đó UI
   * rơi về quyền toàn cục. Server vẫn là người chặn thật; cái này chỉ để
   * UI nói trước thay vì để người dùng vẽ rồi thấy nét vẽ không đồng bộ.
   */
  projectRole: { scope: "open" | "project"; role: string | null } | null = null;

  /** Whether the platform server requires login (null until probed). */
  authRequired: boolean | null = null;
  auth: AuthSession | null = authSession();

  private version = 0;
  private listeners = new Set<() => void>();

  /** True when this browser had no project yet and got the demo instead. */
  seededDemo = false;

  constructor() {
    const restored = this.restore();
    // First run gets the demo rather than an empty grid: an app that opens on
    // "No walls yet" demonstrates nothing. Only ever when storage is empty —
    // it must never overwrite someone's work.
    this.seededDemo = restored === null;
    this.project = restored ?? buildDemoProject();
    // Store bị import cả trong node (test của Viewer3D) — nơi localStorage
    // là undefined chứ không phải ReferenceError, nên try/catch không đỡ.
    const storedView =
      typeof localStorage === "undefined" ? null : localStorage.getItem(ACTIVE_VIEW_KEY);
    if (storedView && this.project.views.some((view) => view.id === storedView)) {
      this.activeViewId = storedView;
    } else {
      this.activeViewId = this.project.views[0]?.id ?? null;
    }
    this.linkedModels = this.loadLinkedModels(this.project.id);
    // Mốc lịch sử phải có từ đầu — nếu chờ commit đầu tiên thì chính thao
    // tác đầu tiên của phiên không bao giờ hoàn tác được.
    this.lastElements = collectElements(this.project.toDict());
  }

  private loadLinkedModels(projectId: string): LinkedModel[] {
    try {
      const payload = localStorage.getItem(linkedModelsKey(projectId));
      return payload ? (JSON.parse(payload) as LinkedModel[]) : [];
    } catch {
      return [];
    }
  }

  private saveLinkedModels(): void {
    localStorage.setItem(linkedModelsKey(this.project.id), JSON.stringify(this.linkedModels));
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
  /** Collaborators currently online (excluding this client). */
  peers: PeerPresence[] = [];
  relayConnected = false;
  /** No platform server reachable — modeling works, sharing and files do not. */
  standalone = false;

  private commit(persist = true): void {
    this.version += 1;
    if (persist) {
      const dict = this.project.toDict();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dict));
        if (this.activeViewId) {
          localStorage.setItem(ACTIVE_VIEW_KEY, this.activeViewId);
        }
      }
      this.recordStep(dict);
      this.sync?.onLocalCommit();
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Ghi một bước lịch sử từ commit cục bộ: diff phần tử so với mốc trước.
   * Bước rỗng (commit không đổi gì) không ghi. Chỉnh sửa mới xoá redo stack —
   * trừ khi chính undo/redo đang chạy.
   */
  private recordStep(dict: Record<string, unknown>): void {
    const next = collectElements(dict);
    const previous = this.lastElements;
    this.lastElements = next;
    if (!previous || this.replaying) return;
    const patches = diffElements(previous, next);
    if (patches.length === 0) return;
    this.undoStack.push({
      label: this.statusMessage,
      at: new Date().toISOString(),
      patches,
    });
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    this.pushHistory({ label: this.statusMessage, count: patches.length, kind: "local" });
  }

  private pushHistory(item: Omit<HistoryItem, "at">): void {
    this.history.push({ ...item, at: new Date().toISOString() });
    if (this.history.length > 200) this.history.shift();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    this.applyHistoryEntry(this.undoStack, this.redoStack, "undo", "Hoàn tác");
  }

  redo(): void {
    this.applyHistoryEntry(this.redoStack, this.undoStack, "redo", "Làm lại");
  }

  /**
   * Undo và redo là một phép: lấy entry từ stack này, áp chiều "trước", đẩy
   * bản đảo sang stack kia. Phần tử đã bị người khác sửa tiếp bị BỎ QUA và
   * đếm ra — hoàn tác của mình không được nuốt chỉnh sửa mới hơn của người
   * khác, và việc bỏ qua phải được nói thành lời.
   */
  private applyHistoryEntry(
    from: UndoEntry[],
    to: UndoEntry[],
    kind: "undo" | "redo",
    verb: string,
  ): void {
    const entry = from.pop();
    if (!entry) {
      this.setStatus(`Không còn gì để ${verb.toLowerCase()}.`);
      return;
    }
    const result = applyUndo(this.project.toDict(), entry);
    if (result.applied.length === 0) {
      this.setStatus(
        `${verb} "${entry.label}" không áp được — cả ${result.skipped.length} phần tử đã bị sửa tiếp sau đó.`,
      );
      return;
    }
    this.project = NativeBimProject.fromJson(JSON.stringify(result.project));
    if (!this.project.views.some((view) => view.id === this.activeViewId)) {
      this.activeViewId = this.project.views[0]?.id ?? null;
    }
    this.selection = null;
    this.pendingStart = null;
    to.push(invert(entry, result.applied));
    this.replaying = true;
    this.statusMessage =
      `${verb}: ${entry.label}` +
      (result.skipped.length > 0
        ? ` · ${result.skipped.length} phần tử đã bị sửa tiếp, giữ nguyên`
        : "");
    this.pushHistory({ label: this.statusMessage, count: result.applied.length, kind });
    this.commit();
    this.replaying = false;
  }

  /** Replace the project with a merged state received from a peer. */
  applyRemoteProject(projectDict: Record<string, unknown>): void {
    // Mốc lịch sử dời theo — thay đổi từ xa hiện trong lịch sử để ai cũng
    // thấy, nhưng KHÔNG vào undo stack: Ctrl+Z của tôi không có quyền hoàn
    // tác việc của đồng nghiệp.
    const next = collectElements(projectDict);
    if (this.lastElements) {
      const patches = diffElements(this.lastElements, next);
      if (patches.length > 0) {
        this.pushHistory({
          label: "Đồng bộ từ cộng tác viên",
          count: patches.length,
          kind: "remote",
        });
      }
    }
    this.lastElements = next;
    this.project = NativeBimProject.fromJson(JSON.stringify(projectDict));
    if (!this.project.views.some((view) => view.id === this.activeViewId)) {
      this.activeViewId = this.project.views[0]?.id ?? null;
    }
    this.pendingStart = null;
    this.statusMessage = "Synced changes from a collaborator";
    this.version += 1;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.project.toDict()));
    }
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
    this.sync?.broadcastPresence();
    this.statusMessage =
      tool === "GRID"
        ? "Grid: click two points per axis. Esc cancels, Enter exits."
        : tool === "WALL"
          ? "Wall: click two points per wall. Esc cancels, Enter exits."
          : tool === "DOOR" || tool === "WINDOW"
            ? `${tool === "DOOR" ? "Door" : "Window"}: click on a wall to place. Esc exits.`
            : tool === "ROOM"
              ? "Phòng: click hai góc đối diện. Esc để huỷ."
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
    this.sync?.broadcastPresence();
  }

  /** Peers currently pointing at the given element. */
  peersOnElement(elementId: string): PeerPresence[] {
    return this.peers.filter((peer) => peer.selection?.id === elementId);
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
    try {
      this.project.updateDimension(dimensionId, changes);
    } catch (error) {
      this.setStatus((error as Error).message);
      return;
    }
    this.commit();
  }

  removeDimension(dimensionId: string): void {
    this.project.removeDimension(dimensionId);
    if (this.selection?.kind === "dimension" && this.selection.id === dimensionId) {
      this.selection = null;
    }
    this.commit();
  }

  linkIfcModel(name: string, text: string): void {
    const parsed = parseIfc(text);
    if (parsed.elements.length === 0) {
      this.setStatus(
        `Không đọc được phần tử nào từ ${name} (chỉ hỗ trợ thân SweptSolid; bị bỏ qua: ${parsed.skipped}).`,
      );
      return;
    }
    this.linkedModels = [
      ...this.linkedModels.filter((model) => model.name !== name),
      { name, elements: parsed.elements, skipped: parsed.skipped },
    ];
    this.saveLinkedModels();
    this.statusMessage = `Đã link ${name}: ${parsed.elements.length} phần tử${
      parsed.skipped ? `, bỏ qua ${parsed.skipped} (thân không hỗ trợ)` : ""
    }`;
    this.commit(false);
    // Hình học đầy đủ chạy nền: web-ifc mất vài giây với file lớn, và bảng
    // thuộc tính + hộp bao ở trên đã đủ để làm việc ngay trong lúc chờ.
    void this.enrichLinkedModel(name, text);
  }

  /**
   * Nâng model link lên hình học đầy đủ bằng web-ifc: mesh thật cho viewer
   * (trong phiên) + AABB chính xác cho MỌI phần tử (lưu bền, vào clash).
   * Thất bại thì giữ nguyên kết quả của bộ đọc thường — một file IFC hỏng
   * không được phép làm mất những gì đã đọc được.
   */
  private async enrichLinkedModel(name: string, text: string): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const { parseRealGeometry } = await import("../ifc/realGeometry");
      const real = await parseRealGeometry(text);
      const model = this.linkedModels.find((candidate) => candidate.name === name);
      // Người dùng có thể đã unlink trong lúc WASM chạy.
      if (!model || real.elements.length === 0) return;

      this.meshCache.set(name, real.meshes);

      // Hợp nhất theo GlobalId: phần tử bộ đọc thường đã thấy thì siết lại
      // AABB (giữ pset); phần tử nó bỏ qua thì thêm mới — từ đây clash phủ
      // toàn bộ file, kể cả thân không phải SweptSolid.
      const byGlobalId = new Map(
        model.elements.filter((e) => e.globalId).map((e) => [e.globalId as string, e]),
      );
      const merged: LinkedElement[] = model.elements.map((element) => ({ ...element }));
      for (const realElement of real.elements) {
        const known = realElement.globalId ? byGlobalId.get(realElement.globalId) : undefined;
        if (known) {
          const target = merged.find((e) => e.globalId === realElement.globalId);
          if (target) {
            target.min = realElement.min;
            target.max = realElement.max;
          }
        } else {
          merged.push({
            name: realElement.name,
            ifcType: realElement.ifcType,
            min: realElement.min,
            max: realElement.max,
            globalId: realElement.globalId || undefined,
          });
        }
      }

      this.linkedModels = this.linkedModels.map((candidate) =>
        candidate.name === name
          ? { ...candidate, elements: merged, skipped: 0, fullGeometry: true }
          : candidate,
      );
      this.saveLinkedModels();
      this.setStatus(
        `${name}: hình học đầy đủ — ${real.meshes.length} mesh, ${merged.length} phần tử vào va chạm`,
      );
    } catch (error) {
      // Không phá kết quả sẵn có; nói ra để người dùng biết vì sao cảnh chỉ có hộp.
      this.setStatus(
        `${name}: không dựng được hình học đầy đủ (${(error as Error).message}) — dùng hộp bao`,
      );
    }
  }

  unlinkIfcModel(name: string): void {
    this.meshCache.delete(name);
    this.linkedModels = this.linkedModels.filter((model) => model.name !== name);
    this.saveLinkedModels();
    this.commit(false);
  }

  async probeAuthMode(): Promise<void> {
    try {
      const response = await fetch(`${fileServerBase()}/auth/mode`);
      this.authRequired = ((await response.json()) as { enabled: boolean }).enabled;
    } catch {
      this.authRequired = null;
    }
    this.commit(false);
  }

  async login(username: string, password: string): Promise<void> {
    try {
      const response = await fetch(`${fileServerBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        throw new Error("Sai tên đăng nhập hoặc mật khẩu");
      }
      this.auth = (await response.json()) as AuthSession;
      localStorage.setItem(AUTH_KEY, JSON.stringify(this.auth));
      this.statusMessage = `Đã đăng nhập: ${this.auth.username} (${this.auth.role})`;
      this.sync?.reconnectRelay();
      this.commit(false);
      void this.refreshProjectRole();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  /** Tự đăng ký — thành công là đăng nhập luôn (server trả session). */
  async register(username: string, password: string): Promise<void> {
    try {
      const response = await fetch(`${fileServerBase()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await response.json()) as AuthSession & { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Lỗi ${response.status}`);
      this.auth = body;
      localStorage.setItem(AUTH_KEY, JSON.stringify(this.auth));
      this.statusMessage = `Đã tạo tài khoản và đăng nhập: ${body.username}`;
      this.sync?.reconnectRelay();
      this.commit(false);
      void this.refreshProjectRole();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const response = await fetch(`${fileServerBase()}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Lỗi ${response.status}`);
      this.setStatus("Đã đổi mật khẩu — dùng mật khẩu mới từ lần đăng nhập sau.");
      return true;
    } catch (error) {
      this.setStatus((error as Error).message);
      return false;
    }
  }

  logout(): void {
    this.auth = null;
    localStorage.removeItem(AUTH_KEY);
    this.sync?.reconnectRelay();
    this.projectRole = null;
    void this.refreshProjectRole();
    this.setStatus("Đã đăng xuất");
  }

  async refreshProjectRole(): Promise<void> {
    if (this.standalone || typeof fetch === "undefined") {
      this.projectRole = null;
      return;
    }
    try {
      const response = await fetch(
        `${fileServerBase()}/projects/${encodeURIComponent(this.project.id)}/members`,
        { headers: authHeaders() },
      );
      this.projectRole = response.ok
        ? ((await response.json()) as { you: { scope: "open" | "project"; role: string | null } })
            .you
        : null;
    } catch {
      this.projectRole = null;
    }
    this.commit(false);
  }

  get canEdit(): boolean {
    // Dự án đã đăng ký: quyền theo dự án là câu trả lời cuối.
    if (this.projectRole?.scope === "project") {
      return this.projectRole.role === "owner" || this.projectRole.role === "editor";
    }
    if (this.authRequired === false || this.authRequired === null) return true;
    return this.auth != null && this.auth.role !== "viewer";
  }

  /** Câu banner khi bị khoá chỉnh sửa — null nghĩa là không có gì phải nói. */
  get roleBanner(): string | null {
    if (this.canEdit) return null;
    if (this.projectRole?.scope === "project") {
      return this.projectRole.role === "viewer"
        ? "Bạn là VIEWER trong dự án này — chỉ xem. Chỉnh sửa và nộp file đã khoá (máy chủ cũng chặn)."
        : "Bạn KHÔNG PHẢI THÀNH VIÊN dự án này — nội dung không đồng bộ về máy bạn. Hỏi chủ dự án để được mời.";
    }
    return "Tài khoản của bạn là viewer — chỉ xem, chỉnh sửa đã khoá.";
  }

  /** Open a pane; the branch bar follows it rather than being set separately. */
  setPane(pane: PaneId): void {
    this.activePane = pane;
    this.activeSection = sectionOfPane(pane);
    // Drawing tools only mean something on the plan. Leaving one armed while
    // the user is reading a schedule turns the next stray click into geometry.
    if (pane !== "PLANVIEW" && pane !== "MASSING" && this.activeTool !== "SELECT") {
      this.activeTool = "SELECT";
      this.pendingStart = null;
    }
    this.commit(false);
  }

  /** Open a branch at its first pane. */
  setSection(section: SectionId): void {
    this.setPane(sectionById(section).panes[0].id);
  }

  addDocument(code: string, title: string): void {
    try {
      const document = this.project.addDocument(code, title);
      this.selection = { kind: "document", id: document.id };
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  restoreDocumentRevision(documentId: string, revisionId: string): void {
    try {
      const revision = this.project.restoreDocumentRevision(
        documentId,
        revisionId,
        new Date().toISOString(),
      );
      this.statusMessage = `Đã khôi phục — phiên bản hiện hành mới là ${revision.rev}`;
      this.commit();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  updateDocument(
    documentId: string,
    changes: Parameters<NativeBimProject["updateDocument"]>[1],
  ): void {
    this.project.updateDocument(documentId, changes);
    this.commit();
  }

  removeDocument(documentId: string): void {
    this.project.removeDocument(documentId);
    if (this.selection?.kind === "document" && this.selection.id === documentId) {
      this.selection = null;
    }
    this.commit();
  }

  /** Upload a revision file to the platform server, then record it. */
  async uploadDocumentRevision(documentId: string, file: File, note: string): Promise<void> {
    if (this.standalone) {
      this.setStatus(NO_PLATFORM_SERVER);
      return;
    }
    try {
      const key = `${this.project.id}/${documentId}/${Date.now()}-${file.name}`;
      const response = await fetch(
        `${fileServerBase()}/files/${encodeURIComponent(key)}`,
        { method: "PUT", body: file, headers: authHeaders() },
      );
      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`);
      }
      this.project.addDocumentRevision(
        documentId,
        note,
        key,
        file.name,
        new Date().toISOString(),
      );
      this.statusMessage = `Revision uploaded (${file.name})`;
      this.commit();
    } catch (error) {
      this.setStatus(
        `Upload failed — is the platform server running? (${(error as Error).message})`,
      );
    }
  }

  /** Record a metadata-only revision (file stays on external storage). */
  addDocumentRevisionMeta(documentId: string, note: string): void {
    this.project.addDocumentRevision(documentId, note, null, null, new Date().toISOString());
    this.commit();
  }

  addDocumentNote(documentId: string, text: string): void {
    if (!text.trim()) return;
    this.project.addDocumentNote(
      documentId,
      text.trim(),
      this.sync?.name ?? "me",
      new Date().toISOString(),
    );
    this.commit();
  }

  addTask(name: string, category: string, start: string, end: string): void {
    try {
      const task = this.project.addTask(name, category, start, end);
      this.selection = { kind: "task", id: task.id };
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  updateTask(taskId: string, changes: Parameters<NativeBimProject["updateTask"]>[1]): void {
    try {
      this.project.updateTask(taskId, changes);
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  removeTask(taskId: string): void {
    this.project.removeTask(taskId);
    if (this.selection?.kind === "task" && this.selection.id === taskId) {
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

  /** Two opposite corners, like a slab — rooms in plan are rectangles first. */
  addRoom(cornerA: Point3D, cornerB: Point3D): void {
    const [x0, y0] = cornerA;
    const [x1, y1] = cornerB;
    if (x0 === x1 || y0 === y1) {
      this.setStatus("Phòng cần hai góc đối diện tạo thành hình chữ nhật");
      return;
    }
    const outline: [number, number][] = [
      [Math.min(x0, x1), Math.min(y0, y1)],
      [Math.max(x0, x1), Math.min(y0, y1)],
      [Math.max(x0, x1), Math.max(y0, y1)],
      [Math.min(x0, x1), Math.max(y0, y1)],
    ];
    const room = this.project.addRoom("", outline, { levelId: this.activeLevel?.id });
    this.selection = { kind: "room", id: room.id };
    this.statusMessage = `Phòng ${room.code} đã tạo`;
    this.commit();
  }

  addMass(cornerA: Point3D, cornerB: Point3D): void {
    const outline: [number, number][] = [
      [cornerA[0], cornerA[1]],
      [cornerB[0], cornerA[1]],
      [cornerB[0], cornerB[1]],
      [cornerA[0], cornerB[1]],
    ];
    try {
      const mass = this.project.addMass(outline, { levelId: this.activeLevel?.id });
      this.selection = { kind: "mass", id: mass.id };
      this.setStatus(`${mass.name} — ${mass.height} m`);
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  updateMass(massId: string, changes: Parameters<NativeBimProject["updateMass"]>[1]): void {
    try {
      this.project.updateMass(massId, changes);
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  removeMass(massId: string): void {
    this.project.removeMass(massId);
    if (this.selection?.kind === "mass" && this.selection.id === massId) this.selection = null;
    this.commit();
  }

  updateRoom(roomId: string, changes: Parameters<NativeBimProject["updateRoom"]>[1]): void {
    this.project.updateRoom(roomId, changes);
    this.commit();
  }

  removeRoom(roomId: string): void {
    this.project.removeRoom(roomId);
    if (this.selection?.kind === "room" && this.selection.id === roomId) this.selection = null;
    this.commit();
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
    // Cố tình cho phép rỗng *khi đang gõ*: chặn ở đây thì bôi đen rồi xoá để
    // gõ lại là không làm được. Chỗ phải chặn là tên file và tiêu đề — xem
    // projectLabel().
    this.project.name = name;
    this.commit();
  }

  /**
   * Tên dự án để hiện và để đặt tên file.
   *
   * Tên rỗng từng đi thẳng ra ngoài: file tải về thành ".ifc" và
   * ".webim.json" — trên macOS/Linux dấu chấm đầu là file ẩn, nên người dùng
   * bấm tải rồi không tìm thấy gì trong thư mục Downloads.
   */
  get projectLabel(): string {
    return this.project.name.trim() || "Dự án chưa đặt tên";
  }

  /** Attach the current selection to a task, so 4D knows when it gets built. */
  assignSelectionToTask(taskId: string): void {
    const selection = this.selection;
    if (!selection || (selection.kind !== "wall" && selection.kind !== "slab")) {
      this.setStatus("Chọn một tường hoặc sàn trước, rồi gán vào hạng mục.");
      return;
    }
    const task = this.project.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    const ids = new Set(task.elementIds ?? []);
    // Toggle: the same click that attaches also detaches, so a mis-assignment
    // does not need a different control to undo.
    if (ids.has(selection.id)) ids.delete(selection.id);
    else ids.add(selection.id);
    task.elementIds = [...ids];
    this.setStatus(`${task.name}: ${task.elementIds.length} phần tử`);
    this.commit();
  }

  /** Set one cell of the clash matrix; it lives in the project, so it syncs. */
  setClashRule(a: string, b: string, patch: Partial<ClashRule>): void {
    const key = pairKey(a, b);
    const current = ruleFor(this.project.clashMatrix, a, b);
    this.project.clashMatrix[key] = { ...current, ...patch };
    this.commit();
  }

  /**
   * Fire attributes of the building. Also in the project, so a reviewer on
   * another machine sees the same bậc chịu lửa the findings were judged by —
   * a threshold table means nothing without the row it was read from.
   */
  setFireSettings(patch: Partial<FireSettings>): void {
    this.project.fireSettings = { ...this.project.fireSettings, ...patch };
    this.commit();
  }

  setNamingConvention(convention: import("../application/naming").NamingConvention | null): void {
    this.project.namingConvention = convention;
    this.statusMessage = convention
      ? "Đã lưu quy ước đặt tên của công ty"
      : "Quy ước đặt tên trở về mặc định ISO 19650";
    this.commit();
  }

  addMarkup(
    documentId: string,
    markup: Omit<Parameters<NativeBimProject["addMarkup"]>[1], "author">,
  ): void {
    try {
      this.project.addMarkup(
        documentId,
        { ...markup, author: this.auth?.username ?? "local" },
        new Date().toISOString(),
      );
      this.commit();
    } catch (error) {
      this.setStatus((error as Error).message);
    }
  }

  removeMarkup(documentId: string, markupId: string): void {
    this.project.removeMarkup(documentId, markupId);
    this.commit();
  }

  /** Persist + broadcast after a caller mutated the project directly. */
  touch(message?: string): void {
    if (message) this.statusMessage = message;
    this.commit();
  }

  /** Đơn giá cho một dòng khối lượng; 0 hoặc rỗng = xoá khỏi bộ giá. */
  setRate(key: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
      delete this.project.rates[key];
    } else {
      this.project.rates[key] = value;
    }
    this.commit();
  }

  /** Back to "check everything at 1 mm" without hunting for changed cells. */
  resetClashMatrix(): void {
    this.project.clashMatrix = {};
    this.setStatus("Đã đặt lại ma trận va chạm");
    this.commit();
  }

  /** Replace the current project with the demo. Explicit, so it may discard. */
  loadDemoProject(): void {
    this.project = buildDemoProject();
    this.resetViewState();
    this.statusMessage = "Đã nạp dự án demo";
    this.commit();
  }

  newProject(): void {
    this.project = defaultProject();
    this.resetViewState();
    this.statusMessage = "New project";
    this.commit();
  }

  /**
   * Everything that points into the old project by id. Forgetting one leaves
   * the viewport showing neither a view nor a sheet — activeView() returns
   * null because a sheet is "open", and activeSheet() returns null because
   * that sheet belongs to a project that is gone. The screen reads
   * "No active view" and no tool works until the user finds a view to click.
   */
  private resetViewState(): void {
    this.activeViewId = this.project.views[0]?.id ?? null;
    this.activeSheetId = null;
    this.activeScheduleId = null;
    this.selection = null;
    this.pendingStart = null;
    this.linkedModels = this.loadLinkedModels(this.project.id);
    // Dự án khác = câu hỏi quyền khác — hỏi lại máy chủ.
    this.projectRole = null;
    void this.refreshProjectRole();
    // Mesh cache theo tên file — dự án khác có thể có file trùng tên khác
    // nội dung, nên không được mang cache qua ranh giới dự án.
    this.meshCache.clear();
    // Undo xuyên ranh giới dự án là áp patch của dự án cũ lên dự án mới —
    // vô nghĩa ở mức tốt nhất, phá dữ liệu ở mức xấu nhất.
    this.undoStack = [];
    this.redoStack = [];
    this.history = [];
    this.lastElements = null;
  }

  serializeProject(): string {
    return JSON.stringify(this.project.toDict());
  }

  /**
   * Số liệu cho dải luồng xương sống trên trang chủ. PCCC (pathfinding)
   * chỉ chạy khi phòng ≤ 40 — dự án lớn hơn thì bước Đối chiếu nói "mở tab
   * Thoát nạn" thay vì âm thầm treo trang chủ.
   */
  flowInput(): import("../application/flow").FlowInput {
    const documents = this.project.documents;
    const tasks = this.project.tasks;
    const publishedByTask = new Set(
      documents
        .filter((doc) => doc.taskId && doc.status === "PUBLISHED")
        .map((doc) => doc.taskId as string),
    );
    let pcccSeriousCount: number | null = null;
    if (this.project.rooms.length > 0 && this.project.rooms.length <= 40) {
      try {
        pcccSeriousCount = analyseProject(this.project)
          .flatMap((room) => room.findings)
          .filter((finding) => finding.level === "serious").length;
      } catch {
        pcccSeriousCount = null;
      }
    }
    return {
      serverSynced: this.relayConnected,
      registered:
        this.projectRole === null ? null : this.projectRole.scope === "project",
      memberCount: null,
      documentCount: documents.length,
      documentsWithoutFile: documents.filter(
        (doc) => !doc.revisions.some((rev) => rev.fileKey),
      ).length,
      documentsWithoutTask: documents.filter((doc) => !doc.taskId).length,
      elementCount:
        this.project.walls.length +
        this.project.slabs.length +
        this.project.rooms.length +
        this.project.masses.length,
      linkedModelCount: this.linkedModels.length,
      taskCount: tasks.length,
      averageProgress: tasks.length
        ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length)
        : 0,
      doneTasksMissingPublished: tasks.filter(
        (task) => task.status === "DONE" && !publishedByTask.has(task.id),
      ).length,
      pcccSeriousCount,
      markupCount: documents.reduce(
        (sum, doc) => sum + (doc.markups?.length ?? 0),
        0,
      ),
    };
  }

  /**
   * Link file IFC đã nộp trong CDE vào mô hình — mắt xích CDE → View của
   * luồng xương sống: hồ sơ nộp lên rồi XEM được ngay, không phải tải về
   * máy rồi link tay lại.
   */
  async linkIfcFromCde(fileKey: string, fileName: string): Promise<void> {
    try {
      const response = await fetch(
        `${fileServerBase()}/files/${encodeURIComponent(fileKey)}`,
        { headers: authHeaders() },
      );
      if (!response.ok) throw new Error(`Không tải được file (${response.status})`);
      this.linkIfcModel(fileName, await response.text());
      this.setPane("VIEWER");
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  /** Danh sách dự án có snapshot trên máy chủ mà tôi xem được. */
  async listServerProjects(): Promise<{ id: string; name: string }[]> {
    const response = await fetch(`${fileServerBase()}/projects`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Cần đăng nhập để xem dự án trên máy chủ."
          : `Máy chủ trả lỗi ${response.status}`,
      );
    }
    return ((await response.json()) as { projects: { id: string; name: string }[] })
      .projects;
  }

  /** Mở một dự án từ snapshot trên máy chủ — trái tim của "đổi máy". */
  async openServerProject(projectId: string): Promise<void> {
    try {
      const response = await fetch(
        `${fileServerBase()}/projects/${encodeURIComponent(projectId)}/state`,
        { headers: authHeaders() },
      );
      if (!response.ok) {
        throw new Error(`Không tải được dự án (${response.status})`);
      }
      const snapshot = (await response.json()) as {
        project: Record<string, unknown>;
        clocks: Record<string, { t: number; c: string }>;
      };
      this.project = NativeBimProject.fromJson(JSON.stringify(snapshot.project));
      this.resetViewState();
      // Đồng hồ LWW đi theo dự án — thiếu nó thì commit đầu tiên trên máy
      // mới sẽ thua mọi phần tử cũ khi merge.
      this.sync?.adoptClocks(snapshot.clocks);
      this.statusMessage = `Đã mở "${this.projectLabel}" từ máy chủ`;
      this.commit();
    } catch (error) {
      this.setStatus(error instanceof Error ? error.message : String(error));
    }
  }

  loadProjectJson(payload: string): void {
    this.project = NativeBimProject.fromJson(payload);
    if (this.project.views.length === 0) {
      this.project.addView("Level 1", "FLOOR_PLAN", 100, 40);
    }
    this.resetViewState();
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
  getPresence: () => ({ selection: store.selection, tool: store.activeTool }),
  onPeersChanged: (peers) => {
    store.peers = peers;
    store.setStatus(
      peers.length > 0
        ? `${peers.length} collaborator${peers.length > 1 ? "s" : ""} online`
        : store.statusMessage,
    );
  },
  // The relay is up but will not carry a signed-out tab. Saying so beats
  // "Relay offline", which reads as "the server is down" and sends someone
  // looking at the wrong thing.
  onAuthRequired: () => {
    store.relayConnected = false;
    store.standalone = false;
    store.authRequired = true;
    store.setStatus("Cần đăng nhập để đồng bộ — mô hình vẫn lưu trong máy này");
  },
  onRelayStatus: (connected) => {
    store.relayConnected = connected;
    store.standalone = false;
    if (connected && store.projectRole === null) {
      void store.refreshProjectRole();
    }
    store.setStatus(connected ? "Relay connected" : "Relay offline — tab sync only");
  },
  onStandalone: () => {
    store.relayConnected = false;
    store.standalone = true;
    store.setStatus(
      "Chế độ độc lập — không có máy chủ nền tảng. Mô hình lưu trong trình duyệt này;" +
        " CDE, Drawings và cộng tác nhiều máy cần máy chủ.",
    );
  },
});

export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}
