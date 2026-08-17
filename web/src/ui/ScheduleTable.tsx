import {
  openingScheduleRows,
  slabScheduleRows,
  wallScheduleRows,
} from "../application/schedules";
import { qtoCsv, qtoRows, qtoSummary, linkedQtoRows } from "../application/qto";
import { clashReport, crossModelClashes, externalClashes } from "../application/clash";
import {
  applyMatrix,
  clashSystems,
  modelIndex,
  ruleFor,
} from "../application/clashMatrix";
import type { ScheduleDatum } from "../domain/project";
import { store, useStoreVersion } from "../state/store";

const meters = (value: number) => value.toFixed(2);

function WallTable() {
  const rows = wallScheduleRows(store.project);
  const totalLength = rows.reduce((sum, row) => sum + row.length, 0);
  return (
    <table>
      <thead>
        <tr>
          <th>Wall</th>
          <th>Level</th>
          <th>Length (m)</th>
          <th>Thickness (m)</th>
          <th>Height (m)</th>
          <th>Openings</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.level}</td>
            <td>{meters(row.length)}</td>
            <td>{meters(row.thickness)}</td>
            <td>{meters(row.height)}</td>
            <td>{row.openings}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total: {rows.length}</td>
          <td />
          <td>{meters(totalLength)}</td>
          <td colSpan={3} />
        </tr>
      </tfoot>
    </table>
  );
}

function OpeningTable() {
  const rows = openingScheduleRows(store.project);
  return (
    <table>
      <thead>
        <tr>
          <th>Mark</th>
          <th>Type</th>
          <th>Host wall</th>
          <th>Level</th>
          <th>Width (m)</th>
          <th>Height (m)</th>
          <th>Sill (m)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.kind}</td>
            <td>{row.wall}</td>
            <td>{row.level}</td>
            <td>{meters(row.width)}</td>
            <td>{meters(row.height)}</td>
            <td>{meters(row.sillHeight)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total: {rows.length}</td>
          <td colSpan={6} />
        </tr>
      </tfoot>
    </table>
  );
}

function SlabTable() {
  const rows = slabScheduleRows(store.project);
  const totalArea = rows.reduce((sum, row) => sum + row.area, 0);
  return (
    <table>
      <thead>
        <tr>
          <th>Slab</th>
          <th>Type</th>
          <th>Level</th>
          <th>Area (m²)</th>
          <th>Thickness (m)</th>
          <th>Top elev. (m)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.kind}</td>
            <td>{row.level}</td>
            <td>{meters(row.area)}</td>
            <td>{meters(row.thickness)}</td>
            <td>{meters(row.topElevation)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total: {rows.length}</td>
          <td colSpan={2} />
          <td>{meters(totalArea)}</td>
          <td colSpan={2} />
        </tr>
      </tfoot>
    </table>
  );
}

/** Khối lượng KHAI BÁO trong các file IFC link — bảng đối chiếu, không phải đo lại. */
function LinkedQto() {
  const rows = linkedQtoRows(store.linkedModels);
  if (rows.length === 0) return null;
  return (
    <>
      <h3>Khối lượng khai báo trong IFC link</h3>
      <p className="module-hint">
        Đọc từ Qto_* mà chính file khai — WeBIM <strong>không đo lại</strong>{" "}
        hình học link. Dùng để đối chiếu với bảng đo từ model native ở trên;
        hai bảng lệch nhau là câu hỏi cho người dựng file, không phải cho phần
        mềm nào đúng.
      </p>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Loại</th>
            <th>Đại lượng</th>
            <th>Số phần tử</th>
            <th>Tổng</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row.model}</td>
              <td>{row.ifcType}</td>
              <td>{row.quantity}</td>
              <td>{row.elementCount}</td>
              <td>{row.total.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function QtoTable() {
  const rows = qtoRows(store.project);
  const summary = qtoSummary(rows);
  const download = () => {
    const blob = new Blob([qtoCsv(store.project)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${store.projectLabel}-qto.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <button onClick={download}>Export CSV</button>
      <table>
        <thead>
          <tr>
            <th>Element</th>
            <th>Category</th>
            <th>Material</th>
            <th>Unit</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row.element}</td>
              <td>{row.category}</td>
              <td>{row.material}</td>
              <td>{row.unit}</td>
              <td>{row.quantity.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {summary.map((row, index) => (
            <tr key={index}>
              <td>Σ</td>
              <td>{row.category}</td>
              <td>{row.material}</td>
              <td>{row.unit}</td>
              <td>{row.quantity.toFixed(3)}</td>
            </tr>
          ))}
        </tfoot>
      </table>
      <LinkedQto />
    </>
  );
}

/**
 * The matrix: system × system, each cell a checkbox and its own tolerance.
 * Only the lower triangle is editable — A×B and B×A are one rule, and showing
 * both invites setting them differently.
 */
export function ClashMatrixGrid() {
  const systems = clashSystems(
    store.project,
    store.linkedModels.map((model) => model.name),
  );
  if (systems.length === 0) return null;
  const matrix = store.project.clashMatrix;

  return (
    <details className="clash-matrix" open={Object.keys(matrix).length > 0}>
      <summary>
        Ma trận va chạm — {systems.length} hệ
        {Object.keys(matrix).length > 0 ? ` · ${Object.keys(matrix).length} ô đã đổi` : ""}
      </summary>
      <table>
        <thead>
          <tr>
            <th />
            {systems.map((system) => (
              <th key={system.id}>{system.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {systems.map((row, rowIndex) => (
            <tr key={row.id}>
              <th>{row.label}</th>
              {systems.map((column, columnIndex) => {
                if (columnIndex > rowIndex) return <td key={column.id} className="muted-cell" />;
                const rule = ruleFor(matrix, row.id, column.id);
                return (
                  <td key={column.id}>
                    <label className="clash-cell">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(event) =>
                          store.setClashRule(row.id, column.id, {
                            enabled: event.target.checked,
                          })
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        step={0.001}
                        value={rule.toleranceM}
                        disabled={!rule.enabled}
                        title="Dung sai (m) — bỏ qua va chạm nông hơn mức này"
                        onChange={(event) =>
                          store.setClashRule(row.id, column.id, {
                            toleranceM: Number(event.target.value) || 0,
                          })
                        }
                      />
                    </label>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="module-form">
        <button className="mini" onClick={() => store.resetClashMatrix()}>
          Đặt lại toàn bộ
        </button>
        <span className="module-hint" style={{ margin: 0 }}>
          Tắt ô = không kiểm tra cặp hệ đó. Dung sai tính theo mét, mặc định 0.001.
        </span>
      </div>
    </details>
  );
}

export function ClashTable() {
  const internal = clashReport(store.project);
  const crossModel = crossModelClashes(store.linkedModels);
  const external = store.linkedModels.flatMap((model) =>
    externalClashes(store.project, model.elements),
  );
  const all = [...internal, ...external, ...crossModel].sort((a, b) => b.depth - a.depth);
  const filtered = applyMatrix(
    all,
    store.project.clashMatrix,
    modelIndex(store.linkedModels),
  );
  const clashes = filtered.kept;
  const suppressed = filtered.suppressedByRule + filtered.suppressedByTolerance;
  return (
    <>
      <p className="module-hint">
        {/*
          "Không phát hiện va chạm cứng" khi ma trận vừa ẩn hết là một câu
          sai đứng trước một câu đúng — người đọc lướt dừng ở vế đầu. Khi
          bảng rỗng *vì bị lọc*, phải nói ra ngay từ mệnh đề đầu tiên.
        */}
        {clashes.length === 0
          ? suppressed > 0
            ? `Không còn va chạm nào để hiện — ma trận đang ẩn toàn bộ ${suppressed} va chạm tìm thấy.`
            : "Không phát hiện va chạm cứng — các liên kết tường hợp lệ đã được loại trừ."
          : `${clashes.length} va chạm (${external.length} với model IFC link), sắp xếp theo độ xuyên sâu.`}
        {suppressed > 0 &&
          ` · ma trận đã ẩn ${suppressed} (${filtered.suppressedByRule} do tắt ô, ${filtered.suppressedByTolerance} dưới dung sai)`}{" "}
        Va chạm với IFC link ở mức AABB (sàng lọc kiểu Navisworks) — chỉ đọc thân
        SweptSolid.
      </p>
      <table>
        <thead>
          <tr>
            <th>Loại</th>
            <th>Phần tử A</th>
            <th>Phần tử B</th>
            <th>Độ xuyên (m)</th>
          </tr>
        </thead>
        <tbody>
          {clashes.map((clash, index) => (
            <tr key={index}>
              <td>{clash.kind === "NATIVE_IFC" ? "Native × IFC link" : clash.kind.replace("_", " × ")}</td>
              <td>{clash.aName}</td>
              <td>{clash.bName}</td>
              <td>{clash.depth.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function ScheduleTable({ schedule }: { schedule: ScheduleDatum }) {
  useStoreVersion();
  return (
    <div className="schedule-host">
      <h2>{schedule.name}</h2>
      {schedule.kind === "WALL" && <WallTable />}
      {schedule.kind === "OPENING" && <OpeningTable />}
      {schedule.kind === "SLAB" && <SlabTable />}
      {schedule.kind === "QTO" && <QtoTable />}
      {schedule.kind === "CLASH" && <ClashTable />}
    </div>
  );
}
