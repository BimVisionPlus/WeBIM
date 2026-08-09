import {
  openingScheduleRows,
  slabScheduleRows,
  wallScheduleRows,
} from "../application/schedules";
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

export function ScheduleTable({ schedule }: { schedule: ScheduleDatum }) {
  useStoreVersion();
  return (
    <div className="schedule-host">
      <h2>{schedule.name}</h2>
      {schedule.kind === "WALL" && <WallTable />}
      {schedule.kind === "OPENING" && <OpeningTable />}
      {schedule.kind === "SLAB" && <SlabTable />}
    </div>
  );
}
