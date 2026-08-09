import { LINE_PATTERNS, LINE_WEIGHTS_MM } from "../domain/lineStyles";
import { store, useStoreVersion } from "../state/store";
import type {
  GridDatum,
  LevelDatum,
  OpeningDatum,
  Point3D,
  SheetDatum,
  SlabDatum,
  TechnicalView,
  WallDatum,
  WallJoinType,
} from "../domain/project";
import { useState } from "react";

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
      <label className="prop-row">
        <span>Level</span>
        <select
          value={wall.levelId}
          onChange={(event) => store.updateWall(wall.id, { levelId: event.target.value })}
        >
          {store.project.levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </label>
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

function OpeningProperties({ wall, opening }: { wall: WallDatum; opening: OpeningDatum }) {
  const update = (changes: Parameters<typeof store.updateOpening>[2]) =>
    store.updateOpening(wall.id, opening.id, changes);
  return (
    <>
      <h3>
        {opening.kind === "DOOR" ? "Door" : "Window"} {opening.name}
      </h3>
      <div className="prop-static">
        <span>Host wall</span>
        <span>{wall.name}</span>
      </div>
      <NumberField
        label="Offset (m)"
        value={opening.offset}
        onCommit={(value) => update({ offset: value })}
      />
      <NumberField
        label="Width (m)"
        value={opening.width}
        step={0.05}
        onCommit={(value) => update({ width: value })}
      />
      <NumberField
        label="Height (m)"
        value={opening.height}
        step={0.05}
        onCommit={(value) => update({ height: value })}
      />
      <NumberField
        label="Sill height (m)"
        value={opening.sillHeight}
        step={0.05}
        onCommit={(value) => update({ sillHeight: value })}
      />
      {opening.kind === "DOOR" && (
        <>
          <label className="prop-row">
            <span>Hinge</span>
            <select
              value={opening.hingeEnd}
              onChange={(event) =>
                update({ hingeEnd: event.target.value as "START" | "END" })
              }
            >
              <option value="START">Start jamb</option>
              <option value="END">End jamb</option>
            </select>
          </label>
          <label className="prop-row">
            <span>Swing</span>
            <select
              value={opening.swingSide}
              onChange={(event) =>
                update({ swingSide: event.target.value as "LEFT" | "RIGHT" })
              }
            >
              <option value="LEFT">Left of wall</option>
              <option value="RIGHT">Right of wall</option>
            </select>
          </label>
        </>
      )}
      <button className="danger" onClick={() => store.removeOpening(wall.id, opening.id)}>
        Delete {opening.kind === "DOOR" ? "door" : "window"}
      </button>
    </>
  );
}

function SlabProperties({ slab }: { slab: SlabDatum }) {
  return (
    <>
      <h3>
        {slab.kind === "FLOOR" ? "Floor" : "Roof"} {slab.name}
      </h3>
      <label className="prop-row">
        <span>Level</span>
        <select
          value={slab.levelId}
          onChange={(event) => store.updateSlab(slab.id, { levelId: event.target.value })}
        >
          {store.project.levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.name}
            </option>
          ))}
        </select>
      </label>
      <NumberField
        label="Thickness (m)"
        value={slab.thickness}
        step={0.05}
        onCommit={(value) => store.updateSlab(slab.id, { thickness: value })}
      />
      <NumberField
        label="Offset (m)"
        value={slab.zOffset}
        onCommit={(value) => store.updateSlab(slab.id, { zOffset: value })}
      />
      <div className="prop-static">
        <span>Top elevation</span>
        <span>{store.project.slabTopZ(slab).toFixed(2)} m</span>
      </div>
      <button className="danger" onClick={() => store.removeSlab(slab.id)}>
        Delete slab
      </button>
    </>
  );
}

function LevelProperties({ level }: { level: LevelDatum }) {
  return (
    <>
      <h3>{level.name}</h3>
      <label className="prop-row">
        <span>Name</span>
        <input
          value={level.name}
          onChange={(event) => store.updateLevel(level.id, { name: event.target.value })}
        />
      </label>
      <NumberField
        label="Elevation (m)"
        value={level.elevation}
        onCommit={(value) => store.updateLevel(level.id, { elevation: value })}
      />
      <div className="prop-static">
        <span>Walls on level</span>
        <span>{store.project.walls.filter((wall) => wall.levelId === level.id).length}</span>
      </div>
      <button className="danger" onClick={() => store.removeLevel(level.id)}>
        Delete level
      </button>
    </>
  );
}

function SheetProperties({ sheet }: { sheet: SheetDatum }) {
  const placeable = store.project.views.filter(
    (view) => !sheet.placements.some((placement) => placement.viewId === view.id),
  );
  const [viewToPlace, setViewToPlace] = useState("");
  return (
    <>
      <h3>Sheet {sheet.name}</h3>
      <label className="prop-row">
        <span>Number</span>
        <input
          value={sheet.name}
          onChange={(event) => store.updateSheet(sheet.id, { name: event.target.value })}
        />
      </label>
      <label className="prop-row">
        <span>Title</span>
        <input
          value={sheet.title}
          onChange={(event) => store.updateSheet(sheet.id, { title: event.target.value })}
        />
      </label>
      <div className="prop-row">
        <select
          value={viewToPlace}
          onChange={(event) => setViewToPlace(event.target.value)}
        >
          <option value="">Place a view…</option>
          {placeable.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            if (viewToPlace) {
              store.placeViewOnSheet(sheet.id, viewToPlace);
              setViewToPlace("");
            }
          }}
        >
          Place
        </button>
      </div>
      {sheet.placements.map((placement) => {
        const view = store.project.views.find((candidate) => candidate.id === placement.viewId);
        return (
          <div key={placement.id} className="sheet-placement">
            <span>{view?.name ?? "?"}</span>
            {(["x", "y"] as const).map((axis) => (
              <input
                key={axis}
                type="number"
                step={10}
                value={placement[axis]}
                title={`${axis.toUpperCase()} (mm)`}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (!Number.isNaN(value)) {
                    store.updateSheetPlacement(sheet.id, placement.id, { [axis]: value });
                  }
                }}
              />
            ))}
            <button
              className="mini"
              title="Remove from sheet"
              onClick={() => store.removeSheetPlacement(sheet.id, placement.id)}
            >
              ×
            </button>
          </div>
        );
      })}
      <button className="danger" onClick={() => store.removeSheet(sheet.id)}>
        Delete sheet
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
  const openingHost =
    selection?.kind === "opening" ? store.project.openingHost(selection.id) : null;
  const opening = openingHost?.openings.find((candidate) => candidate.id === selection?.id);
  const level =
    selection?.kind === "level"
      ? store.project.levels.find((candidate) => candidate.id === selection.id)
      : undefined;
  const sheet =
    selection?.kind === "sheet"
      ? store.project.sheets.find((candidate) => candidate.id === selection.id)
      : undefined;
  const slab =
    selection?.kind === "slab"
      ? store.project.slabs.find((candidate) => candidate.id === selection.id)
      : undefined;

  return (
    <aside className="panel properties-panel">
      <h2>Properties</h2>
      {axis && <GridProperties axis={axis} />}
      {view && <ViewProperties view={view} />}
      {wall && <WallProperties wall={wall} />}
      {openingHost && opening && <OpeningProperties wall={openingHost} opening={opening} />}
      {level && <LevelProperties level={level} />}
      {sheet && <SheetProperties sheet={sheet} />}
      {slab && <SlabProperties slab={slab} />}
      {!axis && !view && !wall && !opening && !level && !sheet && !slab && (
        <div className="tree-empty">Select an element, level, sheet or view.</div>
      )}
    </aside>
  );
}
