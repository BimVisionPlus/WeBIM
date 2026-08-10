import {
  openingScheduleRows,
  slabScheduleRows,
  wallScheduleRows,
} from "../application/schedules";
import { qtoCsv, qtoRows, qtoSummary } from "../application/qto";
import { clashReport, externalClashes } from "../application/clash";
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

function QtoTable() {
  const rows = qtoRows(store.project);
  const summary = qtoSummary(rows);
  const download = () => {
    const blob = new Blob([qtoCsv(store.project)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${store.project.name}-qto.csv`;
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
    </>
  );
}

function ClashTable() {
  const internal = clashReport(store.project);
  const external = store.linkedModels.flatMap((model) =>
    externalClashes(store.project, model.elements),
  );
  const clashes = [...internal, ...external].sort((a, b) => b.depth - a.depth);
  const onPickIfc = async (file: File | undefined) => {
    if (!file) return;
    store.linkIfcModel(file.name, await file.text());
  };
  return (
    <>
      <div className="module-form">
        <label className="upload-button">
          Link IFC…
          <input
            type="file"
            accept=".ifc"
            style={{ display: "none" }}
            onChange={(event) => {
              void onPickIfc(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {store.linkedModels.map((model) => (
          <span key={model.name} className="peer-chip">
            {model.name} · {model.elements.length} phần tử
            {model.skipped > 0 ? ` (bỏ qua ${model.skipped})` : ""}
            <button className="mini" onClick={() => store.unlinkIfcModel(model.name)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <p className="module-hint">
        {clashes.length === 0
          ? "Không phát hiện va chạm cứng — các liên kết tường hợp lệ đã được loại trừ."
          : `${clashes.length} va chạm (${external.length} với model IFC link), sắp xếp theo độ xuyên sâu.`}{" "}
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
