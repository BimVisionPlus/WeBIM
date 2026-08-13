// Coordination dashboard — one picture of where the model and the team are.
//
// Charts are hand-rolled SVG, like the Gantt: this app has no chart library
// and does not need one for four bar charts. Every chart here is a single
// series, so none carries a legend — the title names it and the rows are
// labelled directly, which also keeps identity off colour alone.
//
// Colours come from the validated data-viz palette, stepped for this app's
// dark panel (#1f2229) and checked with the palette validator rather than by
// eye. Task state uses the reserved status colours; because status green and
// red are close under deuteranopia, every state row carries its own written
// label, so the colour is reinforcement and never the message.

import {
  clashBreakdown,
  documentsByStatus,
  modelTotals,
  openingsByKind,
  planProgress,
  tasksByStatus,
  volumeByMaterial,
  type Counted,
} from "../application/dashboard";
import { clashSystems } from "../application/clashMatrix";
import { store, useStoreVersion } from "../state/store";

/** Sequential blue, light→dark, validated ordinal on this surface. */
const ORDINAL = ["#b7d3f6", "#86b6ef", "#5598e7", "#2a78d6"];
/** Single-series magnitude marks. */
const SERIES = "#3987e5";
/** Reserved status roles — never reused for a series. */
const STATUS: Record<string, { color: string; icon: string; label: string }> = {
  NOT_STARTED: { color: "#8b8f98", icon: "○", label: "Chưa bắt đầu" },
  IN_PROGRESS: { color: "#3987e5", icon: "◐", label: "Đang làm" },
  DONE: { color: "#0ca30c", icon: "●", label: "Xong" },
  BLOCKED: { color: "#d03b3b", icon: "▲", label: "Tắc" },
};

function StatTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

/**
 * Horizontal bars: category names are long and Vietnamese, and a horizontal
 * axis is the one that does not force them to rotate.
 */
function BarList({
  rows,
  colorFor,
  unit = "",
}: {
  rows: Counted[];
  colorFor?: (row: Counted, index: number) => string;
  unit?: string;
}) {
  if (rows.length === 0 || rows.every((row) => row.value === 0)) {
    return <p className="module-hint">Chưa có dữ liệu.</p>;
  }
  const max = Math.max(...rows.map((row) => row.value));
  return (
    <div className="bar-list">
      {rows.map((row, index) => (
        <div className="bar-row" key={row.label} title={`${row.label}: ${row.value}${unit}`}>
          <span className="bar-label">{row.label}</span>
          <svg className="bar-track" viewBox="0 0 100 10" preserveAspectRatio="none" role="img">
            {/* 4px-equivalent rounded data end, anchored at the baseline. */}
            <rect
              x="0"
              y="1.5"
              width={max === 0 ? 0 : Math.max((row.value / max) * 100, row.value > 0 ? 1.2 : 0)}
              height="7"
              rx="1.6"
              fill={colorFor ? colorFor(row, index) : SERIES}
            />
          </svg>
          <span className="bar-value">
            {row.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * `embedded` drops the page heading: on TRANG CHỦ this is the overview half of
 * that page, not a page of its own, and two <h2> in a row reads as a mistake.
 */
export function DashboardModule({ embedded = false }: { embedded?: boolean } = {}) {
  useStoreVersion();
  const project = store.project;
  const systems = clashSystems(
    project,
    store.linkedModels.map((model) => model.name),
  );
  const labelOf = (id: string) => systems.find((system) => system.id === id)?.label ?? id;

  const totals = modelTotals(project);
  const clash = clashBreakdown(project, store.linkedModels, labelOf);
  const progress = planProgress(project);
  const tasks = tasksByStatus(project);
  const blocked = tasks.find((row) => row.label === "BLOCKED")?.value ?? 0;

  return (
    <div className={embedded ? "" : "module-host"}>
      {embedded ? (
        <h3>Tổng quan</h3>
      ) : (
        <h2>Dashboard — mô hình &amp; phối hợp</h2>
      )}
      <p className="module-hint">
        Tổng hợp từ chính dự án đang mở: không có số nào lấy từ nơi khác.
      </p>

      <div className="stat-row">
        <StatTile label="Tường" value={totals.walls} hint={`${totals.openings} lỗ mở`} />
        <StatTile label="Sàn / mái" value={totals.slabs} />
        <StatTile label="Trục" value={totals.grids} hint={`${totals.levels} cao độ`} />
        <StatTile
          label="Va chạm được báo"
          value={clash.reported}
          hint={clash.suppressed > 0 ? `${clash.suppressed} bị ma trận ẩn` : "ma trận không ẩn gì"}
        />
        <StatTile label="Tài liệu CDE" value={project.documents.length} />
        <StatTile
          label="Tiến độ trung bình"
          value={`${progress}%`}
          hint={blocked > 0 ? `${blocked} hạng mục đang tắc` : `${project.tasks.length} hạng mục`}
        />
      </div>

      <div className="chart-grid">
        <section>
          <h3>Va chạm theo cặp hệ</h3>
          <BarList rows={clash.byPair} />
          {clash.suppressed > 0 && (
            <p className="module-hint">
              Ma trận đang ẩn {clash.suppressed} va chạm — biểu đồ này chỉ đếm phần
              còn được báo.
            </p>
          )}
        </section>

        <section>
          <h3>Hạng mục theo trạng thái</h3>
          <BarList
            rows={tasks.map((row) => ({ ...row, label: `${STATUS[row.label].icon} ${STATUS[row.label].label}` }))}
            colorFor={(_row, index) => STATUS[tasks[index].label].color}
          />
        </section>

        <section>
          <h3>Tài liệu CDE theo trạng thái</h3>
          <BarList
            rows={documentsByStatus(project)}
            colorFor={(_row, index) => ORDINAL[index] ?? ORDINAL[ORDINAL.length - 1]}
          />
        </section>

        <section>
          <h3>Khối lượng theo vật liệu</h3>
          <BarList rows={volumeByMaterial(project)} unit=" m³" />
        </section>

        <section>
          <h3>Lỗ mở</h3>
          <BarList rows={openingsByKind(project)} />
        </section>
      </div>
    </div>
  );
}
