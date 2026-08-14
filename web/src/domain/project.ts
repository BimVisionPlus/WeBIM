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

/** Horizontal datum: floor plans bind to a level, walls sit on one. */
export interface LevelDatum {
  id: string;
  name: string;
  elevation: number;
}

/** A view frame placed on a sheet, positioned in paper millimetres. */
export interface SheetViewPlacement {
  id: string;
  viewId: string;
  x: number;
  y: number;
}

import { normalizeConvention, type NamingConvention } from "../application/naming";

export interface SheetDatum {
  id: string;
  name: string;
  title: string;
  placements: SheetViewPlacement[];
}

/**
 * Fire attributes of the *building*. These belong here and not in
 * `application/pccc.ts` because they are facts a designer decides — the bậc
 * chịu lửa is chosen and stated on the drawings — not numbers QCVN 06 hands
 * down. The thresholds they select live in the application layer.
 */
export type FireGrade = "I" | "II" | "III" | "IV" | "V";
export type StructureClass = "S0" | "S1" | "S2" | "S3";
/** Nhóm nguy hiểm cháy theo công năng, rút gọn ở mức sàng lọc cần. */
export type BuildingGroup = "F1.2" | "F1.3" | "CONG_CONG";

export interface FireSettings {
  grade: FireGrade;
  structureClass: StructureClass;
  group: BuildingGroup;
  /** Bảo vệ toàn bộ bằng Sprinkler — 3.2.8 cho phép giảm cự ly giữa hai lối ra. */
  sprinklered: boolean;
  /**
   * Mật độ dòng người thoát nạn, người/m². CHÚ THÍCH 2 của Bảng G.2a nói giá
   * trị này "được lấy cụ thể cho từng dự án", nên nó là số người nhập chứ
   * không phải số suy ra được.
   */
  flowDensity: number;
}

export const DEFAULT_FIRE_SETTINGS: FireSettings = {
  grade: "II",
  structureClass: "S0",
  group: "CONG_CONG",
  sprinklered: false,
  flowDensity: 2,
};

/**
 * Room usage, which is what sets occupant density. The densities live in
 * `application/pccc.ts` rather than here: the domain records what a room *is*,
 * not what a code says about it, so a corrected figure never means editing
 * every saved project.
 */
export type RoomUsage =
  | "O"            // phòng ngủ
  | "PHONG_KHACH"  // phòng khách
  | "VAN_PHONG"    // văn phòng
  | "HOP"          // phòng họp, phòng đọc, phòng học
  | "HOI_TRUONG"   // hội trường, khiêu vũ, bar, karaoke — dày người nhất
  | "SANH"         // sảnh, tiếp đón
  | "THUONG_MAI"   // chợ, TTTM, siêu thị
  | "TRIEN_LAM"    // triển lãm
  | "BAO_TANG"     // bảo tàng
  | "AN_UONG"      // phòng ăn, căng-tin
  | "BEP"          // bếp, thư viện
  | "KHO"          // kho, nơi chứa đồ
  | "DE_XE"        // nhà để xe
  | "KY_THUAT"     // phòng kỹ thuật
  | "HANH_LANG";   // hành lang, lối đi

/**
 * A room: a plan boundary on a level, plus how many people are in it.
 *
 * Occupancy is stored as an override rather than always derived, because the
 * derived figure is only as good as the density table, and a designer who has
 * counted the seats knows better than the table does.
 */
export interface RoomDatum {
  id: string;
  name: string;
  /** Số hiệu phòng — "P.101". */
  code: string;
  usage: RoomUsage;
  /** Plan polygon, metres. */
  outline: [number, number][];
  levelId: string;
  /** People. Null means "derive from area and usage". */
  occupancyOverride: number | null;
}

/**
 * Khối tích nghiên cứu — "box khối" của sơ đồ workflow.
 *
 * Một mặt bằng đùn lên tới một chiều cao. Cố ý *không* phải tường và sàn: ở
 * bước nghiên cứu phương án, người ta muốn thấy hình dạng và ước lượng diện
 * tích sàn trước khi có cấu kiện nào, và ép giai đoạn đó thành tường sẽ tạo ra
 * một mô hình trông như đã thiết kế trong khi chưa. Nó mang cờ riêng nên
 * QTO, va chạm và IFC đều biết đây là khối nghiên cứu chứ không phải kết cấu.
 */
export interface MassDatum {
  id: string;
  name: string;
  /** Plan polygon, metres. */
  outline: [number, number][];
  /** Extrusion height, metres, above the level + zOffset. */
  height: number;
  levelId: string;
  zOffset: number;
  /** Số tầng giả định, để quy ra diện tích sàn. 1 = một khối trơn. */
  storeys: number;
}

export type SlabKind = "FLOOR" | "ROOF";

/**
 * Horizontal slab: a plan outline extruded downward by its thickness so
 * the TOP face sits at level elevation + zOffset (Revit-style floors;
 * roofs default to a zOffset of the storey height).
 */
export interface SlabDatum {
  id: string;
  name: string;
  kind: SlabKind;
  outline: [number, number][];
  thickness: number;
  levelId: string;
  zOffset: number;
}

/** One material layer of a wall assembly, thickness in metres. */
export interface WallLayer {
  name: string;
  material: string;
  thickness: number;
}

/** Reusable layered wall assembly; wall thickness = sum of layers. */
export interface WallTypeDatum {
  id: string;
  name: string;
  layers: WallLayer[];
}

/** Linear dimension annotation, owned by one floor plan view. */
export interface DimensionDatum {
  id: string;
  viewId: string;
  start: [number, number];
  end: [number, number];
  /** Signed perpendicular distance of the dimension line from A-B. */
  offset: number;
}

/** ISO 19650 suitability/status of a CDE document. */
export type DocumentStatus = "WIP" | "SHARED" | "PUBLISHED" | "ARCHIVED";

export interface DocumentRevision {
  id: string;
  rev: string;
  note: string;
  /** Storage key on the platform server / BYO storage; null = metadata only. */
  fileKey: string | null;
  fileName: string | null;
  uploadedAt: string;
}

/**
 * Đánh dấu vẽ lên trang PDF — "chỉnh sửa" của sơ đồ workflow.
 *
 * Toạ độ là *tỉ lệ của trang* (0–1), không phải pixel màn hình. Đây là cả
 * điểm mấu chốt: người xem trên laptop, người xem trên máy công trường, người
 * in ra A3 — một dấu ghi bằng pixel sẽ trôi đi ở cả ba. Ghi theo tỉ lệ trang
 * thì nó nằm đúng chỗ trên bản vẽ, ở mọi cỡ.
 *
 * Nó đánh dấu *lên* PDF chứ không sửa vào file PDF: file gốc trong CDE là bản
 * đã phát hành, và ghi đè lên nó sẽ phá mất chuỗi revision mà cả module CDE
 * tồn tại để giữ.
 */
export type MarkupKind = "RECT" | "ARROW" | "TEXT" | "CLOUD";

export interface MarkupDatum {
  id: string;
  kind: MarkupKind;
  /** Trang, đếm từ 0. */
  page: number;
  /** Hai điểm, mỗi điểm là [x, y] theo tỉ lệ trang 0–1. */
  from: [number, number];
  to: [number, number];
  text: string;
  color: string;
  author: string;
  at: string;
}

export interface DocumentNote {
  id: string;
  text: string;
  author: string;
  at: string;
}

/**
 * CDE document container (ISO 19650 style): WeBIM keeps naming, status,
 * revisions and audit metadata; binaries live on external storage.
 */
export interface DocumentDatum {
  id: string;
  code: string;
  title: string;
  status: DocumentStatus;
  revisions: DocumentRevision[];
  notes: DocumentNote[];
  /** Đánh dấu trên bản vẽ; vắng mặt trong JSON cho tới khi có cái đầu tiên. */
  markups?: MarkupDatum[];
}

export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "BLOCKED";

/** Construction work item (hạng mục) with schedule and progress. */
export interface TaskDatum {
  id: string;
  name: string;
  category: string;
  assignee: string;
  status: TaskStatus;
  start: string;
  end: string;
  progress: number;
  /** Ids of tasks that must finish before this one starts. */
  dependsOn: string[];
  /**
   * Model elements this task builds — walls and slabs, by id. Empty means the
   * task has no geometry (permits, procurement), which is normal: the 4D view
   * shows those as timeline-only rather than pretending they build something.
   */
  elementIds?: string[];
}

/**
 * A task whose end precedes its start is not a schedule, it is a typo — and
 * an expensive one: the Gantt honestly spans min(date)…max(date), so a single
 * reversed row stretches the chart across the reversed interval and pushes
 * every real bar off the visible area. The chart looks empty and the plan
 * looks lost. Cheaper to refuse the row than to explain the empty chart.
 *
 * Blank is allowed on either end: an undated task is a normal thing to plan.
 */
function assertForwardDates(start: string, end: string): void {
  if (!start || !end) return;
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (Number.isNaN(from) || Number.isNaN(to)) return;
  if (to < from) {
    throw new Error(`Ngày kết thúc (${end}) trước ngày bắt đầu (${start})`);
  }
}

export type ScheduleKind = "WALL" | "OPENING" | "SLAB" | "QTO" | "CLASH";

/** A schedule view: a derived element table, persisted by name and kind. */
export interface ScheduleDatum {
  id: string;
  name: string;
  kind: ScheduleKind;
}

export type OpeningKind = "DOOR" | "WINDOW";
export type HingeEnd = "START" | "END";
export type SwingSide = "LEFT" | "RIGHT";

/**
 * Rectangular opening hosted by a wall: centred at `offset` metres from
 * the wall start along its axis, `sillHeight` above the wall base.
 * Doors also carry the plan-swing: which jamb holds the hinge and which
 * side of the wall (relative to start→end) the leaf opens toward.
 */
export interface OpeningDatum {
  id: string;
  name: string;
  kind: OpeningKind;
  offset: number;
  width: number;
  height: number;
  sillHeight: number;
  hingeEnd: HingeEnd;
  swingSide: SwingSide;
}

export const OPENING_DEFAULTS: Record<
  OpeningKind,
  { width: number; height: number; sillHeight: number }
> = {
  DOOR: { width: 0.9, height: 2.1, sillHeight: 0 },
  WINDOW: { width: 1.2, height: 1.2, sillHeight: 0.9 },
};

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
  openings: OpeningDatum[];
  levelId: string;
  /** Optional wall type; when set, thickness is derived from its layers. */
  typeId?: string;
}

/**
 * One cell of the clash matrix: whether this pair of systems is checked at
 * all, and how deep an overlap has to be before it counts. Lives in the
 * project so it travels with it and syncs like every other element.
 */
export interface ClashRule {
  enabled: boolean;
  /** Metres. Overlaps at or below this are not reported. */
  toleranceM: number;
}

/** Sparse — only cells someone changed. Keys are `systemA|systemB`, sorted. */
export type ClashMatrix = Record<string, ClashRule>;

export type ViewType = "FLOOR_PLAN" | "SECTION" | "ELEVATION";

export interface TechnicalView {
  id: string;
  name: string;
  viewType: ViewType;
  scale: number;
  orthoScale: number;
  /** Level shown by a floor plan; unused for sections/elevations. */
  levelId?: string;
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
  levels: LevelDatum[];
  sheets: SheetDatum[];
  slabs: SlabDatum[];
  schedules: ScheduleDatum[];
  wallTypes: WallTypeDatum[];
  dimensions: DimensionDatum[];
  documents: DocumentDatum[];
  tasks: TaskDatum[];
  rooms: RoomDatum[] = [];
  /** Khối nghiên cứu — cùng lý do như rooms: thêm sau, không nằm trong constructor. */
  masses: MassDatum[] = [];
  /**
   * Not a constructor argument: it is a setting rather than content, and
   * threading an eleventh positional parameter through every call site to
   * carry a usually-empty object is not worth it.
   */
  clashMatrix: ClashMatrix = {};
  /**
   * Quy ước đặt tên ISO của công ty — null = dùng mặc định (ISO 19650-2 rút
   * gọn). Là dữ liệu dự án chứ không phải cài đặt máy: hai người cùng dự án
   * phải kiểm cùng một quy ước.
   */
  namingConvention: NamingConvention | null = null;
  /** Same reasoning as clashMatrix — a setting, not content. */
  fireSettings: FireSettings = { ...DEFAULT_FIRE_SETTINGS };
  /**
   * Đơn giá tổng hợp, VND trên đơn vị, khoá theo "category|material|unit" của
   * bảng khối lượng. Ở trong dự án chứ không ở máy: hai người cùng đọc một
   * tổng tiền phải đang nhân với cùng bộ giá.
   */
  rates: Record<string, number> = {};

  constructor(
    id: string,
    name: string,
    siteName: string,
    buildingName: string,
    storeyName: string,
    gridAxes: GridDatum[] = [],
    views: TechnicalView[] = [],
    walls: WallDatum[] = [],
    levels: LevelDatum[] = [],
    sheets: SheetDatum[] = [],
    slabs: SlabDatum[] = [],
    schedules: ScheduleDatum[] = [],
    wallTypes: WallTypeDatum[] = [],
    dimensions: DimensionDatum[] = [],
    documents: DocumentDatum[] = [],
    tasks: TaskDatum[] = [],
  ) {
    this.id = id;
    this.name = name;
    this.siteName = siteName;
    this.buildingName = buildingName;
    this.storeyName = storeyName;
    this.gridAxes = gridAxes;
    this.views = views;
    this.walls = walls;
    this.levels = levels;
    this.sheets = sheets;
    this.slabs = slabs;
    this.schedules = schedules;
    this.wallTypes = wallTypes;
    this.dimensions = dimensions;
    this.documents = documents;
    this.tasks = tasks;
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
      // Omitted when untouched, so a project that never opened the matrix
      // serializes exactly as it did before this existed.
      ...(this.masses.length > 0
        ? {
            masses: this.masses.map((mass) => ({
              id: mass.id,
              name: mass.name,
              outline: mass.outline.map((point) => [...point]),
              height: mass.height,
              level_id: mass.levelId,
              z_offset: mass.zOffset,
              storeys: mass.storeys,
            })),
          }
        : {}),
      ...(this.rooms.length > 0
        ? {
            rooms: this.rooms.map((room) => ({
              id: room.id,
              name: room.name,
              code: room.code,
              usage: room.usage,
              outline: room.outline.map((point) => [...point]),
              level_id: room.levelId,
              occupancy_override: room.occupancyOverride,
            })),
          }
        : {}),
      ...(Object.keys(this.rates).length > 0 ? { rates: { ...this.rates } } : {}),
      // Written only once it differs from the default, for the same reason:
      // a project that never opened the PCCC tab round-trips unchanged.
      ...(this.fireSettings.grade !== DEFAULT_FIRE_SETTINGS.grade ||
      this.fireSettings.structureClass !== DEFAULT_FIRE_SETTINGS.structureClass ||
      this.fireSettings.group !== DEFAULT_FIRE_SETTINGS.group ||
      this.fireSettings.sprinklered !== DEFAULT_FIRE_SETTINGS.sprinklered ||
      this.fireSettings.flowDensity !== DEFAULT_FIRE_SETTINGS.flowDensity
        ? {
            fire_settings: {
              grade: this.fireSettings.grade,
              structure_class: this.fireSettings.structureClass,
              group: this.fireSettings.group,
              sprinklered: this.fireSettings.sprinklered,
              flow_density: this.fireSettings.flowDensity,
            },
          }
        : {}),
      ...(this.namingConvention
        ? { naming_rules: JSON.parse(JSON.stringify(this.namingConvention)) }
        : {}),
      ...(Object.keys(this.clashMatrix).length > 0
        ? {
            clash_matrix: Object.fromEntries(
              Object.entries(this.clashMatrix).map(([key, rule]) => [
                key,
                { enabled: rule.enabled, tolerance_m: rule.toleranceM },
              ]),
            ),
          }
        : {}),
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
        ...(view.levelId ? { level_id: view.levelId } : {}),
      })),
      levels: this.levels.map((level) => ({
        id: level.id,
        name: level.name,
        elevation: level.elevation,
      })),
      slabs: this.slabs.map((slab) => ({
        id: slab.id,
        name: slab.name,
        kind: slab.kind,
        outline: slab.outline.map((point) => [...point]),
        thickness: slab.thickness,
        level_id: slab.levelId,
        z_offset: slab.zOffset,
      })),
      dimensions: this.dimensions.map((dimension) => ({
        id: dimension.id,
        view_id: dimension.viewId,
        start: [...dimension.start],
        end: [...dimension.end],
        offset: dimension.offset,
      })),
      documents: this.documents.map((document) => ({
        id: document.id,
        code: document.code,
        title: document.title,
        status: document.status,
        revisions: document.revisions.map((revision) => ({
          id: revision.id,
          rev: revision.rev,
          note: revision.note,
          file_key: revision.fileKey,
          file_name: revision.fileName,
          uploaded_at: revision.uploadedAt,
        })),
        notes: document.notes.map((note) => ({
          id: note.id,
          text: note.text,
          author: note.author,
          at: note.at,
        })),
        ...(document.markups && document.markups.length > 0
          ? {
              markups: document.markups.map((markup) => ({
                id: markup.id,
                kind: markup.kind,
                page: markup.page,
                from: [...markup.from],
                to: [...markup.to],
                text: markup.text,
                color: markup.color,
                author: markup.author,
                at: markup.at,
              })),
            }
          : {}),
      })),
      tasks: this.tasks.map((task) => ({
        ...(task.elementIds && task.elementIds.length > 0
          ? { element_ids: [...task.elementIds] }
          : {}),
        id: task.id,
        name: task.name,
        category: task.category,
        assignee: task.assignee,
        status: task.status,
        start: task.start,
        end: task.end,
        progress: task.progress,
        depends_on: task.dependsOn,
      })),
      wall_types: this.wallTypes.map((wallType) => ({
        id: wallType.id,
        name: wallType.name,
        layers: wallType.layers.map((layer) => ({
          name: layer.name,
          material: layer.material,
          thickness: layer.thickness,
        })),
      })),
      schedules: this.schedules.map((schedule) => ({
        id: schedule.id,
        name: schedule.name,
        kind: schedule.kind,
      })),
      sheets: this.sheets.map((sheet) => ({
        id: sheet.id,
        name: sheet.name,
        title: sheet.title,
        placements: sheet.placements.map((placement) => ({
          id: placement.id,
          view_id: placement.viewId,
          x: placement.x,
          y: placement.y,
        })),
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
        level_id: wall.levelId,
        ...(wall.typeId ? { type_id: wall.typeId } : {}),
        openings: wall.openings.map((opening) => ({
          id: opening.id,
          name: opening.name,
          kind: opening.kind,
          offset: opening.offset,
          width: opening.width,
          height: opening.height,
          sill_height: opening.sillHeight,
          hinge_end: opening.hingeEnd,
          swing_side: opening.swingSide,
        })),
      })),
    };
  }

  static fromJson(value: string): NativeBimProject {
    const data = JSON.parse(value);
    // Legacy files carry no levels: synthesize one at elevation 0 and
    // attach orphan walls and floor plans to it.
    const levels: LevelDatum[] = ((data.levels as Record<string, unknown>[]) ?? []).map(
      (level) => ({
        id: level.id as string,
        name: level.name as string,
        elevation: level.elevation as number,
      }),
    );
    if (levels.length === 0) {
      levels.push({ id: uuid4Hex(), name: "Level 1", elevation: 0 });
    }
    const defaultLevelId = levels[0].id;
    const project = new NativeBimProject(
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
        levelId:
          (view.level_id as string) ??
          ((view.view_type as string) === "FLOOR_PLAN" ? defaultLevelId : undefined),
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
        levelId: (wall.level_id as string) ?? defaultLevelId,
        typeId: (wall.type_id as string) ?? undefined,
        openings: ((wall.openings as Record<string, unknown>[]) ?? []).map((opening) => ({
          id: opening.id as string,
          name: opening.name as string,
          kind: opening.kind as OpeningKind,
          offset: opening.offset as number,
          width: opening.width as number,
          height: opening.height as number,
          sillHeight: (opening.sill_height as number) ?? 0,
          hingeEnd: (opening.hinge_end as HingeEnd) ?? "START",
          swingSide: (opening.swing_side as SwingSide) ?? "LEFT",
        })),
      })),
      levels,
      ((data.sheets as Record<string, unknown>[]) ?? []).map((sheet) => ({
        id: sheet.id as string,
        name: sheet.name as string,
        title: (sheet.title as string) ?? "",
        placements: ((sheet.placements as Record<string, unknown>[]) ?? []).map(
          (placement) => ({
            id: placement.id as string,
            viewId: placement.view_id as string,
            x: placement.x as number,
            y: placement.y as number,
          }),
        ),
      })),
      ((data.slabs as Record<string, unknown>[]) ?? []).map((slab) => ({
        id: slab.id as string,
        name: slab.name as string,
        kind: slab.kind as SlabKind,
        outline: slab.outline as [number, number][],
        thickness: (slab.thickness as number) ?? 0.2,
        levelId: (slab.level_id as string) ?? defaultLevelId,
        zOffset: (slab.z_offset as number) ?? 0,
      })),
      ((data.schedules as Record<string, unknown>[]) ?? []).map((schedule) => ({
        id: schedule.id as string,
        name: schedule.name as string,
        kind: schedule.kind as ScheduleKind,
      })),
      ((data.wall_types as Record<string, unknown>[]) ?? []).map((wallType) => ({
        id: wallType.id as string,
        name: wallType.name as string,
        layers: ((wallType.layers as Record<string, unknown>[]) ?? []).map((layer) => ({
          name: layer.name as string,
          material: layer.material as string,
          thickness: layer.thickness as number,
        })),
      })),
      ((data.dimensions as Record<string, unknown>[]) ?? []).map((dimension) => ({
        id: dimension.id as string,
        viewId: dimension.view_id as string,
        start: dimension.start as [number, number],
        end: dimension.end as [number, number],
        offset: (dimension.offset as number) ?? 1,
      })),
      ((data.documents as Record<string, unknown>[]) ?? []).map((document) => ({
        id: document.id as string,
        code: document.code as string,
        title: (document.title as string) ?? "",
        status: (document.status as DocumentStatus) ?? "WIP",
        revisions: ((document.revisions as Record<string, unknown>[]) ?? []).map(
          (revision) => ({
            id: revision.id as string,
            rev: revision.rev as string,
            note: (revision.note as string) ?? "",
            fileKey: (revision.file_key as string) ?? null,
            fileName: (revision.file_name as string) ?? null,
            uploadedAt: (revision.uploaded_at as string) ?? "",
          }),
        ),
        notes: ((document.notes as Record<string, unknown>[]) ?? []).map((note) => ({
          id: note.id as string,
          text: note.text as string,
          author: (note.author as string) ?? "",
          at: (note.at as string) ?? "",
        })),
        ...(Array.isArray(document.markups)
          ? {
              markups: (document.markups as Record<string, unknown>[]).map((markup) => ({
                id: markup.id as string,
                kind: (markup.kind as MarkupKind) ?? "RECT",
                page: typeof markup.page === "number" ? markup.page : 0,
                from: markup.from as [number, number],
                to: markup.to as [number, number],
                text: (markup.text as string) ?? "",
                color: (markup.color as string) ?? "#e06c75",
                author: (markup.author as string) ?? "",
                at: (markup.at as string) ?? "",
              })),
            }
          : {}),
      })),
      ((data.tasks as Record<string, unknown>[]) ?? []).map((task) => ({
        id: task.id as string,
        name: task.name as string,
        category: (task.category as string) ?? "",
        assignee: (task.assignee as string) ?? "",
        status: (task.status as TaskStatus) ?? "NOT_STARTED",
        start: (task.start as string) ?? "",
        end: (task.end as string) ?? "",
        progress: (task.progress as number) ?? 0,
        dependsOn: (task.depends_on as string[]) ?? [],
        ...(Array.isArray(task.element_ids)
          ? { elementIds: task.element_ids as string[] }
          : {}),
      })),
    );

    for (const mass of (data.masses ?? []) as Record<string, unknown>[]) {
      project.masses.push({
        id: mass.id as string,
        name: (mass.name as string) ?? "Khối",
        outline: mass.outline as [number, number][],
        height: typeof mass.height === "number" ? mass.height : 3,
        levelId: (mass.level_id as string) ?? defaultLevelId,
        zOffset: typeof mass.z_offset === "number" ? mass.z_offset : 0,
        storeys: typeof mass.storeys === "number" ? mass.storeys : 1,
      });
    }

    for (const room of (data.rooms ?? []) as Record<string, unknown>[]) {
      project.rooms.push({
        id: room.id as string,
        name: (room.name as string) ?? "Phòng",
        code: (room.code as string) ?? "",
        usage: (room.usage as RoomUsage) ?? "VAN_PHONG",
        outline: room.outline as [number, number][],
        levelId: (room.level_id as string) ?? defaultLevelId,
        occupancyOverride:
          typeof room.occupancy_override === "number" ? room.occupancy_override : null,
      });
    }

    const storedRates = (data.rates ?? {}) as Record<string, unknown>;
    for (const [key, value] of Object.entries(storedRates)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        project.rates[key] = value;
      }
    }

    const storedFire = (data.fire_settings ?? {}) as Record<string, unknown>;
    project.fireSettings = {
      grade: (storedFire.grade as FireGrade) ?? DEFAULT_FIRE_SETTINGS.grade,
      structureClass:
        (storedFire.structure_class as StructureClass) ?? DEFAULT_FIRE_SETTINGS.structureClass,
      group: (storedFire.group as BuildingGroup) ?? DEFAULT_FIRE_SETTINGS.group,
      sprinklered: storedFire.sprinklered === true,
      flowDensity:
        typeof storedFire.flow_density === "number"
          ? storedFire.flow_density
          : DEFAULT_FIRE_SETTINGS.flowDensity,
    };

    project.namingConvention = normalizeConvention(data.naming_rules);

    // Unknown keys are dropped by design; the matrix is restored explicitly.
    // Rules with a missing flag default to enabled, which matches a fresh
    // matrix — a half-written file must not silently stop reporting clashes.
    const storedMatrix = (data.clash_matrix ?? {}) as Record<string, Record<string, unknown>>;
    for (const [key, rule] of Object.entries(storedMatrix)) {
      project.clashMatrix[key] = {
        enabled: rule.enabled !== false,
        toleranceM: typeof rule.tolerance_m === "number" ? rule.tolerance_m : 0.001,
      };
    }
    return project;
  }

  addView(
    name: string,
    viewType: string,
    scale = 100,
    orthoScale = 20.0,
    levelId?: string,
  ): TechnicalView {
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
    if (levelId && !this.levels.some((level) => level.id === levelId)) {
      throw new Error(`Unknown LevelDatum: ${levelId}`);
    }
    const view: TechnicalView = {
      id: uuid4Hex(),
      name,
      viewType: normalizedType,
      scale,
      orthoScale,
      levelId,
    };
    this.views.push(view);
    return view;
  }

  addLevel(name: string, elevation: number): LevelDatum {
    const level: LevelDatum = { id: uuid4Hex(), name, elevation };
    this.levels.push(level);
    this.levels.sort((first, second) => first.elevation - second.elevation);
    return level;
  }

  /** Change a level; moving its elevation carries its walls along. */
  updateLevel(levelId: string, changes: { name?: string; elevation?: number }): LevelDatum {
    const index = this.levels.findIndex((level) => level.id === levelId);
    if (index === -1) {
      throw new Error(`Unknown LevelDatum: ${levelId}`);
    }
    const level = this.levels[index];
    const updated: LevelDatum = {
      ...level,
      name: changes.name ?? level.name,
      elevation: changes.elevation ?? level.elevation,
    };
    this.levels[index] = updated;
    if (changes.elevation !== undefined && changes.elevation !== level.elevation) {
      for (let wallIndex = 0; wallIndex < this.walls.length; wallIndex += 1) {
        const wall = this.walls[wallIndex];
        if (wall.levelId !== levelId) continue;
        this.walls[wallIndex] = {
          ...wall,
          start: [wall.start[0], wall.start[1], updated.elevation],
          end: [wall.end[0], wall.end[1], updated.elevation],
        };
      }
      this.levels.sort((first, second) => first.elevation - second.elevation);
    }
    return updated;
  }

  removeLevel(levelId: string): LevelDatum {
    const index = this.levels.findIndex((level) => level.id === levelId);
    if (index === -1) {
      throw new Error(`Unknown LevelDatum: ${levelId}`);
    }
    if (this.levels.length <= 1) {
      throw new Error("Cannot delete the last level");
    }
    if (this.walls.some((wall) => wall.levelId === levelId)) {
      throw new Error("Level still hosts walls");
    }
    if (this.slabs.some((slab) => slab.levelId === levelId)) {
      throw new Error("Level still hosts slabs");
    }
    if (this.views.some((view) => view.levelId === levelId)) {
      throw new Error("Level still has views");
    }
    // Rooms were added after this guard was written and were missed. An
    // orphaned room keeps a levelId nothing resolves, so PCCC finds no doors
    // on its level and reports "không có lối ra" — a fire finding produced by
    // a dangling reference rather than by the design.
    if (this.rooms.some((room) => room.levelId === levelId)) {
      throw new Error("Level still hosts rooms");
    }
    if (this.masses.some((mass) => mass.levelId === levelId)) {
      throw new Error("Level still hosts masses");
    }
    return this.levels.splice(index, 1)[0];
  }

  levelById(levelId: string): LevelDatum | null {
    return this.levels.find((level) => level.id === levelId) ?? null;
  }

  addRoom(
    code: string,
    outline: [number, number][],
    options: { name?: string; usage?: RoomUsage; levelId?: string } = {},
  ): RoomDatum {
    if (outline.length < 3) {
      throw new Error("Ranh giới phòng cần ít nhất ba điểm");
    }
    if (this.levels.length === 0) this.addLevel("Level 1", 0);
    const level = options.levelId ? this.levelById(options.levelId) : this.levels[0];
    if (!level) throw new Error(`Unknown LevelDatum: ${options.levelId}`);
    const room: RoomDatum = {
      id: uuid4Hex(),
      name: options.name ?? `Phòng ${this.rooms.length + 1}`,
      code: code || `P.${this.rooms.length + 1}`,
      usage: options.usage ?? "VAN_PHONG",
      outline,
      levelId: level.id,
      occupancyOverride: null,
    };
    this.rooms.push(room);
    return room;
  }

  updateRoom(roomId: string, changes: Partial<Omit<RoomDatum, "id">>): RoomDatum {
    const room = this.rooms.find((candidate) => candidate.id === roomId);
    if (!room) throw new Error(`Unknown RoomDatum: ${roomId}`);
    Object.assign(room, changes);
    return room;
  }

  addMass(
    outline: [number, number][],
    options: { name?: string; height?: number; levelId?: string; storeys?: number } = {},
  ): MassDatum {
    if (outline.length < 3) {
      throw new Error("A mass outline needs at least three points");
    }
    const height = options.height ?? 3.3;
    if (height <= 0) {
      throw new Error("Mass height must be greater than zero");
    }
    const storeys = options.storeys ?? 1;
    if (storeys < 1 || !Number.isInteger(storeys)) {
      throw new Error("Storeys must be a whole number of at least 1");
    }
    if (this.levels.length === 0) {
      this.addLevel("Level 1", 0);
    }
    const level = options.levelId ? this.levelById(options.levelId) : this.levels[0];
    if (!level) {
      throw new Error(`Unknown LevelDatum: ${options.levelId}`);
    }
    const mass: MassDatum = {
      id: uuid4Hex(),
      name: options.name ?? `Khối ${this.masses.length + 1}`,
      outline,
      height,
      levelId: level.id,
      zOffset: 0,
      storeys,
    };
    this.masses.push(mass);
    return mass;
  }

  updateMass(massId: string, changes: Partial<Omit<MassDatum, "id">>): MassDatum {
    const mass = this.masses.find((candidate) => candidate.id === massId);
    if (!mass) throw new Error(`Unknown MassDatum: ${massId}`);
    if (changes.height !== undefined && changes.height <= 0) {
      throw new Error("Mass height must be greater than zero");
    }
    if (changes.storeys !== undefined && (changes.storeys < 1 || !Number.isInteger(changes.storeys))) {
      throw new Error("Storeys must be a whole number of at least 1");
    }
    Object.assign(mass, changes);
    return mass;
  }

  removeMass(massId: string): void {
    this.masses = this.masses.filter((mass) => mass.id !== massId);
  }

  removeRoom(roomId: string): void {
    this.rooms = this.rooms.filter((room) => room.id !== roomId);
  }

  addSlab(
    kind: SlabKind,
    outline: [number, number][],
    options: { thickness?: number; levelId?: string; zOffset?: number } = {},
  ): SlabDatum {
    if (outline.length < 3) {
      throw new Error("A slab outline needs at least three points");
    }
    const thickness = options.thickness ?? 0.2;
    if (thickness <= 0) {
      throw new Error("Slab thickness must be greater than zero");
    }
    if (this.levels.length === 0) {
      this.addLevel("Level 1", 0);
    }
    const level = options.levelId ? this.levelById(options.levelId) : this.levels[0];
    if (!level) {
      throw new Error(`Unknown LevelDatum: ${options.levelId}`);
    }
    const count = this.slabs.filter((slab) => slab.kind === kind).length;
    const slab: SlabDatum = {
      id: uuid4Hex(),
      name: `${kind === "FLOOR" ? "F" : "R"}${count + 1}`,
      kind,
      outline,
      thickness,
      levelId: level.id,
      zOffset: options.zOffset ?? 0,
    };
    this.slabs.push(slab);
    return slab;
  }

  updateSlab(
    slabId: string,
    changes: {
      outline?: [number, number][];
      thickness?: number;
      levelId?: string;
      zOffset?: number;
    },
  ): SlabDatum {
    const index = this.slabs.findIndex((slab) => slab.id === slabId);
    if (index === -1) {
      throw new Error(`Unknown SlabDatum: ${slabId}`);
    }
    const slab = this.slabs[index];
    const levelId = changes.levelId ?? slab.levelId;
    if (!this.levelById(levelId)) {
      throw new Error(`Unknown LevelDatum: ${levelId}`);
    }
    const updated: SlabDatum = {
      ...slab,
      outline: changes.outline ?? slab.outline,
      thickness: changes.thickness ?? slab.thickness,
      levelId,
      zOffset: changes.zOffset ?? slab.zOffset,
    };
    if (updated.outline.length < 3) {
      throw new Error("A slab outline needs at least three points");
    }
    if (updated.thickness <= 0) {
      throw new Error("Slab thickness must be greater than zero");
    }
    this.slabs[index] = updated;
    return updated;
  }

  removeSlab(slabId: string): SlabDatum {
    const index = this.slabs.findIndex((slab) => slab.id === slabId);
    if (index === -1) {
      throw new Error(`Unknown SlabDatum: ${slabId}`);
    }
    return this.slabs.splice(index, 1)[0];
  }

  /** Absolute z of a slab's top face. */
  slabTopZ(slab: SlabDatum): number {
    const level = this.levelById(slab.levelId);
    return (level?.elevation ?? 0) + slab.zOffset;
  }

  addSchedule(kind: ScheduleKind = "WALL"): ScheduleDatum {
    const labels: Record<ScheduleKind, string> = {
      WALL: "Wall Schedule",
      OPENING: "Door/Window Schedule",
      SLAB: "Slab Schedule",
      QTO: "Quantity Take-off",
      CLASH: "Clash Report",
    };
    const schedule: ScheduleDatum = {
      id: uuid4Hex(),
      name: labels[kind],
      kind,
    };
    this.schedules.push(schedule);
    return schedule;
  }

  updateSchedule(
    scheduleId: string,
    changes: { name?: string; kind?: ScheduleKind },
  ): ScheduleDatum {
    const index = this.schedules.findIndex((schedule) => schedule.id === scheduleId);
    if (index === -1) {
      throw new Error(`Unknown ScheduleDatum: ${scheduleId}`);
    }
    const schedule = this.schedules[index];
    this.schedules[index] = {
      ...schedule,
      name: changes.name ?? schedule.name,
      kind: changes.kind ?? schedule.kind,
    };
    return this.schedules[index];
  }

  removeSchedule(scheduleId: string): ScheduleDatum {
    const index = this.schedules.findIndex((schedule) => schedule.id === scheduleId);
    if (index === -1) {
      throw new Error(`Unknown ScheduleDatum: ${scheduleId}`);
    }
    return this.schedules.splice(index, 1)[0];
  }

  addDimension(
    viewId: string,
    start: [number, number],
    end: [number, number],
    offset: number,
  ): DimensionDatum {
    if (!this.views.some((view) => view.id === viewId)) {
      throw new Error(`Unknown TechnicalView: ${viewId}`);
    }
    if (start[0] === end[0] && start[1] === end[1]) {
      throw new Error("A dimension needs two different points");
    }
    const dimension: DimensionDatum = {
      id: uuid4Hex(),
      viewId,
      start,
      end,
      offset,
    };
    this.dimensions.push(dimension);
    return dimension;
  }

  updateDimension(dimensionId: string, changes: { offset?: number }): DimensionDatum {
    const index = this.dimensions.findIndex((dimension) => dimension.id === dimensionId);
    if (index === -1) {
      throw new Error(`Unknown DimensionDatum: ${dimensionId}`);
    }
    this.dimensions[index] = {
      ...this.dimensions[index],
      offset: changes.offset ?? this.dimensions[index].offset,
    };
    return this.dimensions[index];
  }

  removeDimension(dimensionId: string): DimensionDatum {
    const index = this.dimensions.findIndex((dimension) => dimension.id === dimensionId);
    if (index === -1) {
      throw new Error(`Unknown DimensionDatum: ${dimensionId}`);
    }
    return this.dimensions.splice(index, 1)[0];
  }

  addDocument(code: string, title: string): DocumentDatum {
    if (!code.trim()) {
      throw new Error("A document needs an ISO 19650 code");
    }
    const document: DocumentDatum = {
      id: uuid4Hex(),
      code: code.trim(),
      title,
      status: "WIP",
      revisions: [],
      notes: [],
    };
    this.documents.push(document);
    return document;
  }

  private documentById(documentId: string): DocumentDatum {
    const document = this.documents.find((candidate) => candidate.id === documentId);
    if (!document) {
      throw new Error(`Unknown DocumentDatum: ${documentId}`);
    }
    return document;
  }

  updateDocument(
    documentId: string,
    changes: { code?: string; title?: string; status?: DocumentStatus },
  ): DocumentDatum {
    const document = this.documentById(documentId);
    document.code = changes.code ?? document.code;
    document.title = changes.title ?? document.title;
    document.status = changes.status ?? document.status;
    return document;
  }

  removeDocument(documentId: string): DocumentDatum {
    const index = this.documents.findIndex((candidate) => candidate.id === documentId);
    if (index === -1) {
      throw new Error(`Unknown DocumentDatum: ${documentId}`);
    }
    return this.documents.splice(index, 1)[0];
  }

  /** Append a revision (P01, P02, ... while WIP/Shared; C01... published). */
  addDocumentRevision(
    documentId: string,
    note: string,
    fileKey: string | null,
    fileName: string | null,
    uploadedAt: string,
  ): DocumentRevision {
    const document = this.documentById(documentId);
    const prefix = document.status === "PUBLISHED" ? "C" : "P";
    const count = document.revisions.filter((revision) =>
      revision.rev.startsWith(prefix),
    ).length;
    const revision: DocumentRevision = {
      id: uuid4Hex(),
      rev: `${prefix}${String(count + 1).padStart(2, "0")}`,
      note,
      fileKey,
      fileName,
      uploadedAt,
    };
    document.revisions.push(revision);
    return revision;
  }

  addMarkup(
    documentId: string,
    markup: Omit<MarkupDatum, "id" | "at">,
    at: string,
  ): MarkupDatum {
    const document = this.documents.find((candidate) => candidate.id === documentId);
    if (!document) throw new Error(`Unknown DocumentDatum: ${documentId}`);
    const created: MarkupDatum = { ...markup, id: uuid4Hex(), at };
    document.markups = [...(document.markups ?? []), created];
    return created;
  }

  removeMarkup(documentId: string, markupId: string): void {
    const document = this.documents.find((candidate) => candidate.id === documentId);
    if (!document) return;
    document.markups = (document.markups ?? []).filter((markup) => markup.id !== markupId);
  }

  addDocumentNote(
    documentId: string,
    text: string,
    author: string,
    at: string,
  ): DocumentNote {
    const document = this.documentById(documentId);
    const note: DocumentNote = { id: uuid4Hex(), text, author, at };
    document.notes.push(note);
    return note;
  }

  addTask(name: string, category = "", start = "", end = ""): TaskDatum {
    if (!name.trim()) {
      throw new Error("A task needs a name");
    }
    assertForwardDates(start, end);
    const task: TaskDatum = {
      id: uuid4Hex(),
      name: name.trim(),
      category,
      assignee: "",
      status: "NOT_STARTED",
      start,
      end,
      progress: 0,
      dependsOn: [],
    };
    this.tasks.push(task);
    return task;
  }

  updateTask(
    taskId: string,
    changes: Partial<Omit<TaskDatum, "id">>,
  ): TaskDatum {
    const index = this.tasks.findIndex((task) => task.id === taskId);
    if (index === -1) {
      throw new Error(`Unknown TaskDatum: ${taskId}`);
    }
    const progress = changes.progress ?? this.tasks[index].progress;
    if (progress < 0 || progress > 100) {
      throw new Error("Progress must be between 0 and 100");
    }
    assertForwardDates(
      changes.start ?? this.tasks[index].start,
      changes.end ?? this.tasks[index].end,
    );
    if (changes.dependsOn) {
      for (const dependencyId of changes.dependsOn) {
        if (dependencyId === taskId) {
          throw new Error("A task cannot depend on itself");
        }
        if (!this.tasks.some((task) => task.id === dependencyId)) {
          throw new Error(`Unknown dependency: ${dependencyId}`);
        }
      }
    }
    this.tasks[index] = { ...this.tasks[index], ...changes, progress };
    return this.tasks[index];
  }

  removeTask(taskId: string): TaskDatum {
    const index = this.tasks.findIndex((task) => task.id === taskId);
    if (index === -1) {
      throw new Error(`Unknown TaskDatum: ${taskId}`);
    }
    const removed = this.tasks.splice(index, 1)[0];
    for (const task of this.tasks) {
      task.dependsOn = task.dependsOn.filter((id) => id !== taskId);
    }
    return removed;
  }

  addSheet(title: string): SheetDatum {
    const sheet: SheetDatum = {
      id: uuid4Hex(),
      name: `A${101 + this.sheets.length}`,
      title,
      placements: [],
    };
    this.sheets.push(sheet);
    return sheet;
  }

  private sheetById(sheetId: string): SheetDatum {
    const sheet = this.sheets.find((candidate) => candidate.id === sheetId);
    if (!sheet) {
      throw new Error(`Unknown SheetDatum: ${sheetId}`);
    }
    return sheet;
  }

  updateSheet(sheetId: string, changes: { name?: string; title?: string }): SheetDatum {
    const sheet = this.sheetById(sheetId);
    sheet.name = changes.name ?? sheet.name;
    sheet.title = changes.title ?? sheet.title;
    return sheet;
  }

  removeSheet(sheetId: string): SheetDatum {
    const index = this.sheets.findIndex((sheet) => sheet.id === sheetId);
    if (index === -1) {
      throw new Error(`Unknown SheetDatum: ${sheetId}`);
    }
    return this.sheets.splice(index, 1)[0];
  }

  placeViewOnSheet(sheetId: string, viewId: string, x: number, y: number): SheetViewPlacement {
    const sheet = this.sheetById(sheetId);
    if (!this.views.some((view) => view.id === viewId)) {
      throw new Error(`Unknown TechnicalView: ${viewId}`);
    }
    if (sheet.placements.some((placement) => placement.viewId === viewId)) {
      throw new Error("View is already placed on this sheet");
    }
    const placement: SheetViewPlacement = { id: uuid4Hex(), viewId, x, y };
    sheet.placements.push(placement);
    return placement;
  }

  updateSheetPlacement(
    sheetId: string,
    placementId: string,
    changes: { x?: number; y?: number },
  ): SheetViewPlacement {
    const sheet = this.sheetById(sheetId);
    const index = sheet.placements.findIndex((placement) => placement.id === placementId);
    if (index === -1) {
      throw new Error(`Unknown SheetViewPlacement: ${placementId}`);
    }
    const placement = sheet.placements[index];
    sheet.placements[index] = {
      ...placement,
      x: changes.x ?? placement.x,
      y: changes.y ?? placement.y,
    };
    return sheet.placements[index];
  }

  removeSheetPlacement(sheetId: string, placementId: string): SheetViewPlacement {
    const sheet = this.sheetById(sheetId);
    const index = sheet.placements.findIndex((placement) => placement.id === placementId);
    if (index === -1) {
      throw new Error(`Unknown SheetViewPlacement: ${placementId}`);
    }
    return sheet.placements.splice(index, 1)[0];
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

  wallTypeById(typeId: string): WallTypeDatum | null {
    return this.wallTypes.find((wallType) => wallType.id === typeId) ?? null;
  }

  static wallTypeThickness(wallType: WallTypeDatum): number {
    return wallType.layers.reduce((sum, layer) => sum + layer.thickness, 0);
  }

  private validateWallTypeLayers(layers: WallLayer[]): void {
    if (layers.length === 0) {
      throw new Error("A wall type needs at least one layer");
    }
    if (layers.some((layer) => layer.thickness <= 0)) {
      throw new Error("Layer thickness must be greater than zero");
    }
  }

  addWallType(name?: string, layers?: WallLayer[]): WallTypeDatum {
    const resolvedLayers = layers ?? [
      { name: "Core", material: "Concrete", thickness: 0.2 },
    ];
    this.validateWallTypeLayers(resolvedLayers);
    const wallType: WallTypeDatum = {
      id: uuid4Hex(),
      name: name ?? `Type ${this.wallTypes.length + 1}`,
      layers: resolvedLayers,
    };
    this.wallTypes.push(wallType);
    return wallType;
  }

  updateWallType(
    typeId: string,
    changes: { name?: string; layers?: WallLayer[] },
  ): WallTypeDatum {
    const index = this.wallTypes.findIndex((wallType) => wallType.id === typeId);
    if (index === -1) {
      throw new Error(`Unknown WallTypeDatum: ${typeId}`);
    }
    const wallType = this.wallTypes[index];
    const updated: WallTypeDatum = {
      ...wallType,
      name: changes.name ?? wallType.name,
      layers: changes.layers ?? wallType.layers,
    };
    this.validateWallTypeLayers(updated.layers);
    this.wallTypes[index] = updated;
    // Typed walls keep their thickness derived from the assembly.
    const total = NativeBimProject.wallTypeThickness(updated);
    for (let wallIndex = 0; wallIndex < this.walls.length; wallIndex += 1) {
      if (this.walls[wallIndex].typeId === typeId) {
        this.walls[wallIndex] = { ...this.walls[wallIndex], thickness: total };
      }
    }
    return updated;
  }

  removeWallType(typeId: string): WallTypeDatum {
    const index = this.wallTypes.findIndex((wallType) => wallType.id === typeId);
    if (index === -1) {
      throw new Error(`Unknown WallTypeDatum: ${typeId}`);
    }
    if (this.walls.some((wall) => wall.typeId === typeId)) {
      throw new Error("Wall type is still in use");
    }
    return this.wallTypes.splice(index, 1)[0];
  }

  addWall(
    start: Point3D,
    end: Point3D,
    options: {
      thickness?: number;
      height?: number;
      joinStart?: WallJoinType;
      joinEnd?: WallJoinType;
      levelId?: string;
      typeId?: string;
    } = {},
  ): WallDatum {
    if (pointsEqual(start, end)) {
      throw new Error("Wall endpoints must be different");
    }
    if (this.levels.length === 0) {
      this.addLevel("Level 1", 0);
    }
    const level = options.levelId
      ? this.levelById(options.levelId)
      : this.levels[0];
    if (!level) {
      throw new Error(`Unknown LevelDatum: ${options.levelId}`);
    }
    start = [start[0], start[1], level.elevation];
    end = [end[0], end[1], level.elevation];
    let thickness = options.thickness ?? 0.2;
    if (options.typeId) {
      const wallType = this.wallTypeById(options.typeId);
      if (!wallType) {
        throw new Error(`Unknown WallTypeDatum: ${options.typeId}`);
      }
      thickness = NativeBimProject.wallTypeThickness(wallType);
    }
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
      openings: [],
      levelId: level.id,
      typeId: options.typeId,
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
      levelId?: string;
      typeId?: string | null;
    },
  ): WallDatum {
    const index = this.walls.findIndex((wall) => wall.id === wallId);
    if (index === -1) {
      throw new Error(`Unknown WallDatum: ${wallId}`);
    }
    const wall = this.walls[index];
    const levelId = changes.levelId ?? wall.levelId;
    const level = this.levelById(levelId);
    if (!level) {
      throw new Error(`Unknown LevelDatum: ${levelId}`);
    }
    const typeId =
      changes.typeId === null ? undefined : (changes.typeId ?? wall.typeId);
    let thickness = changes.thickness ?? wall.thickness;
    if (typeId) {
      const wallType = this.wallTypeById(typeId);
      if (!wallType) {
        throw new Error(`Unknown WallTypeDatum: ${typeId}`);
      }
      thickness = NativeBimProject.wallTypeThickness(wallType);
    }
    const start = changes.start ?? wall.start;
    const end = changes.end ?? wall.end;
    const updated: WallDatum = {
      ...wall,
      start: [start[0], start[1], level.elevation],
      end: [end[0], end[1], level.elevation],
      thickness,
      typeId,
      height: changes.height ?? wall.height,
      joinStart: validateJoinType(changes.joinStart ?? wall.joinStart),
      joinEnd: validateJoinType(changes.joinEnd ?? wall.joinEnd),
      levelId: level.id,
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

  private wallById(wallId: string): WallDatum {
    const wall = this.walls.find((candidate) => candidate.id === wallId);
    if (!wall) {
      throw new Error(`Unknown WallDatum: ${wallId}`);
    }
    return wall;
  }

  private validateOpening(wall: WallDatum, opening: OpeningDatum): void {
    if (opening.width <= 0) {
      throw new Error("Opening width must be greater than zero");
    }
    if (opening.height <= 0) {
      throw new Error("Opening height must be greater than zero");
    }
    if (opening.sillHeight < 0) {
      throw new Error("Opening sill height cannot be negative");
    }
    if (opening.sillHeight + opening.height > wall.height) {
      throw new Error("Opening must fit within the wall height");
    }
    const length = Math.hypot(
      wall.end[0] - wall.start[0],
      wall.end[1] - wall.start[1],
    );
    if (opening.offset - opening.width / 2 < 0 || opening.offset + opening.width / 2 > length) {
      throw new Error("Opening must fit within the wall length");
    }
    for (const other of wall.openings) {
      if (other.id === opening.id) continue;
      if (
        Math.abs(other.offset - opening.offset) <
        (other.width + opening.width) / 2
      ) {
        throw new Error(`Opening overlaps ${other.name}`);
      }
    }
  }

  addOpening(
    wallId: string,
    kind: OpeningKind,
    offset: number,
    options: {
      width?: number;
      height?: number;
      sillHeight?: number;
      hingeEnd?: HingeEnd;
      swingSide?: SwingSide;
    } = {},
  ): OpeningDatum {
    const wall = this.wallById(wallId);
    const defaults = OPENING_DEFAULTS[kind];
    if (!defaults) {
      throw new Error(`Unknown opening kind: ${kind}`);
    }
    const count = this.walls.reduce(
      (sum, candidate) =>
        sum + candidate.openings.filter((opening) => opening.kind === kind).length,
      0,
    );
    const opening: OpeningDatum = {
      id: uuid4Hex(),
      name: `${kind === "DOOR" ? "D" : "WN"}${count + 1}`,
      kind,
      offset,
      width: options.width ?? defaults.width,
      height: options.height ?? defaults.height,
      sillHeight: options.sillHeight ?? defaults.sillHeight,
      hingeEnd: options.hingeEnd ?? "START",
      swingSide: options.swingSide ?? "LEFT",
    };
    this.validateOpening(wall, opening);
    wall.openings.push(opening);
    return opening;
  }

  updateOpening(
    wallId: string,
    openingId: string,
    changes: {
      offset?: number;
      width?: number;
      height?: number;
      sillHeight?: number;
      hingeEnd?: HingeEnd;
      swingSide?: SwingSide;
    },
  ): OpeningDatum {
    const wall = this.wallById(wallId);
    const index = wall.openings.findIndex((opening) => opening.id === openingId);
    if (index === -1) {
      throw new Error(`Unknown OpeningDatum: ${openingId}`);
    }
    const opening = wall.openings[index];
    const updated: OpeningDatum = {
      ...opening,
      offset: changes.offset ?? opening.offset,
      width: changes.width ?? opening.width,
      height: changes.height ?? opening.height,
      sillHeight: changes.sillHeight ?? opening.sillHeight,
      hingeEnd: changes.hingeEnd ?? opening.hingeEnd,
      swingSide: changes.swingSide ?? opening.swingSide,
    };
    this.validateOpening(wall, updated);
    wall.openings[index] = updated;
    return updated;
  }

  removeOpening(wallId: string, openingId: string): OpeningDatum {
    const wall = this.wallById(wallId);
    const index = wall.openings.findIndex((opening) => opening.id === openingId);
    if (index === -1) {
      throw new Error(`Unknown OpeningDatum: ${openingId}`);
    }
    return wall.openings.splice(index, 1)[0];
  }

  /** Host wall of an opening, or null. */
  openingHost(openingId: string): WallDatum | null {
    return (
      this.walls.find((wall) =>
        wall.openings.some((opening) => opening.id === openingId),
      ) ?? null
    );
  }

  removeGridAxis(axisId: string): GridDatum {
    const index = this.gridAxes.findIndex((axis) => axis.id === axisId);
    if (index === -1) {
      throw new Error(`Unknown GridDatum: ${axisId}`);
    }
    return this.gridAxes.splice(index, 1)[0];
  }
}
