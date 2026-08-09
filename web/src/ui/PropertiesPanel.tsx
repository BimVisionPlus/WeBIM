import { LINE_PATTERNS, LINE_WEIGHTS_MM } from "../domain/lineStyles";
import { store, useStoreVersion } from "../state/store";
import type {
  GridDatum,
  Point3D,
  TechnicalView,
  WallDatum,
  WallJoinType,
} from "../domain/project";

const JOIN_TYPE_LABELS: Array<[WallJoinType, string]> = [
  ["MITER", "Miter"],
  ["BUTT", "Butt"],
  ["SQUARE", "Square (no join)"],
];

function NumberField(props: {
  label: string;
  value: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="prop-row">
      <span>{props.label}</span>
      <input
        type="number"
        step={props.step ?? 0.1}
        value={props.value}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (!Number.isNaN(value)) {
            try {
              props.onCommit(value);
            } catch (error) {
              store.setStatus((error as Error).message);
            }
          }
        }}
      />
    </label>
  );
}

function GridProperties({ axis }: { axis: GridDatum }) {
  const updatePoint = (key: "start" | "end", index: number, value: number) => {
    const point = [...axis[key]] as Point3D;
    point[index] = value;
    store.updateGridAxis(axis.id, { [key]: point });
  };

  return (
    <>
      <h3>Grid {axis.name}</h3>
      <div className="prop-static">
        <span>System</span>
        <span>{axis.systemName}</span>
      </div>
      {(["start", "end"] as const).map((key) => (
        <div key={key} className="prop-point">
          <span className="prop-point-label">{key === "start" ? "Start" : "End"}</span>
          {[0, 1].map((index) => (
            <input
              key={index}
              type="number"
              step={0.1}
              value={axis[key][index]}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isNaN(value)) {
                  try {
                    updatePoint(key, index, value);
                  } catch (error) {
                    store.setStatus((error as Error).message);
                  }
                }
              }}
            />
          ))}
        </div>
      ))}
      <label className="prop-row">
        <span>Head type</span>
        <select
          value={axis.headType}
          onChange={(event) => store.updateGridAxis(axis.id, { headType: event.target.value })}
        >
          <option value="CIRCLE">Circle + Name</option>
          <option value="HEXAGON">Hexagon + Name</option>
          <option value="NONE">None</option>
        </select>
      </label>
      <NumberField
        label="Annotation scale"
        value={axis.headScale}
        onCommit={(value) => store.updateGridAxis(axis.id, { headScale: value })}
      />
      <label className="prop-row">
        <span>Line pattern</span>
        <select
          value={axis.linePattern}
          onChange={(event) => store.updateGridAxis(axis.id, { linePattern: event.target.value })}
        >
          {[...LINE_PATTERNS.entries()].map(([id, pattern]) => (
            <option key={id} value={id}>
              {pattern.name}
            </option>
          ))}
        </select>
      </label>
      <label className="prop-row">
        <span>Line weight</span>
        <select
          value={axis.lineWeightMm}
          onChange={(event) =>
            store.updateGridAxis(axis.id, { lineWeightMm: Number(event.target.value) })
          }
        >
          {LINE_WEIGHTS_MM.map((weight) => (
            <option key={weight} value={weight}>
              {weight} mm
            </option>
          ))}
        </select>
      </label>
      <button className="danger" onClick={() => store.removeGridAxis(axis.id)}>
        Delete grid
      </button>
    </>
  );
}

function WallProperties({ wall }: { wall: WallDatum }) {
  const updatePoint = (key: "start" | "end", index: number, value: number) => {
    const point = [...wall[key]] as Point3D;
    point[index] = value;
    store.updateWall(wall.id, { [key]: point });
  };

  return (
    <>
      <h3>Wall {wall.name}</h3>
      {(["start", "end"] as const).map((key) => (
        <div key={key} className="prop-point">
          <span className="prop-point-label">{key === "start" ? "Start" : "End"}</span>
          {[0, 1].map((index) => (
            <input
              key={index}
              type="number"
              step={0.1}
              value={wall[key][index]}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (!Number.isNaN(value)) {
                  try {
                    updatePoint(key, index, value);
                  } catch (error) {
                    store.setStatus((error as Error).message);
                  }
                }
              }}
            />
          ))}
        </div>
      ))}
      <NumberField
        label="Thickness (m)"
        value={wall.thickness}
        step={0.05}
        onCommit={(value) => store.updateWall(wall.id, { thickness: value })}
      />
      <NumberField
        label="Height (m)"
        value={wall.height}
        step={0.1}
        onCommit={(value) => store.updateWall(wall.id, { height: value })}
      />
      {(["joinStart", "joinEnd"] as const).map((key) => (
        <label key={key} className="prop-row">
          <span>{key === "joinStart" ? "Start join" : "End join"}</span>
          <select
            value={wall[key]}
            onChange={(event) =>
              store.updateWall(wall.id, { [key]: event.target.value as WallJoinType })
            }
          >
            {JOIN_TYPE_LABELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button className="danger" onClick={() => store.removeWall(wall.id)}>
        Delete wall
      </button>
    </>
  );
}

function ViewProperties({ view }: { view: TechnicalView }) {
  return (
    <>
      <h3>{view.name}</h3>
      <div className="prop-static">
        <span>Type</span>
        <span>{view.viewType.replace("_", " ")}</span>
      </div>
      <label className="prop-row">
        <span>Name</span>
        <input
          value={view.name}
          onChange={(event) => store.updateView(view.id, { name: event.target.value })}
        />
      </label>
      <label className="prop-row">
        <span>Scale 1:</span>
        <select
          value={view.scale}
          onChange={(event) => store.updateView(view.id, { scale: Number(event.target.value) })}
        >
          {[20, 50, 100, 200, 500].map((scale) => (
            <option key={scale} value={scale}>
              {scale}
            </option>
          ))}
        </select>
      </label>
      <NumberField
        label="Ortho scale"
        value={view.orthoScale}
        step={1}
        onCommit={(value) => store.updateView(view.id, { orthoScale: value })}
      />
    </>
  );
}

export function PropertiesPanel() {
  useStoreVersion();
  const selection = store.selection;
  const axis =
    selection?.kind === "grid"
      ? store.project.gridAxes.find((candidate) => candidate.id === selection.id)
      : undefined;
  const view =
    selection?.kind === "view"
      ? store.project.views.find((candidate) => candidate.id === selection.id)
      : undefined;
  const wall =
    selection?.kind === "wall"
      ? store.project.walls.find((candidate) => candidate.id === selection.id)
      : undefined;

  return (
    <aside className="panel properties-panel">
      <h2>Properties</h2>
      {axis && <GridProperties axis={axis} />}
      {view && <ViewProperties view={view} />}
      {wall && <WallProperties wall={wall} />}
      {!axis && !view && !wall && (
        <div className="tree-empty">Select a grid, wall or view.</div>
      )}
    </aside>
  );
}
