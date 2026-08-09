import { store, useStoreVersion } from "../state/store";
import type { TechnicalView } from "../domain/project";

const VIEW_SECTIONS: Array<{ label: string; type: TechnicalView["viewType"] }> = [
  { label: "Floor Plans", type: "FLOOR_PLAN" },
  { label: "Sections", type: "SECTION" },
  { label: "Elevations", type: "ELEVATION" },
];

export function ProjectBrowser() {
  useStoreVersion();
  const project = store.project;

  return (
    <aside className="panel project-browser">
      <h2>Project Browser</h2>
      <div className="tree">
        <div className="tree-branch">Views</div>
        {VIEW_SECTIONS.map(({ label, type }) => (
          <div key={type}>
            <div className="tree-subbranch">
              {label}
              <button className="mini" title={`Add ${label}`} onClick={() => store.addView(type)}>
                +
              </button>
            </div>
            {project.views
              .filter((view) => view.viewType === type)
              .map((view) => (
                <div
                  key={view.id}
                  className={`tree-leaf ${store.activeViewId === view.id ? "active" : ""} ${
                    store.selection?.kind === "view" && store.selection.id === view.id
                      ? "selected"
                      : ""
                  }`}
                  onClick={() => store.activateView(view.id)}
                >
                  <span>
                    {view.name} <em>1:{view.scale}</em>
                  </span>
                  <button
                    className="mini"
                    title="Delete view"
                    onClick={(event) => {
                      event.stopPropagation();
                      store.removeView(view.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        ))}
        <div className="tree-branch">Model</div>
        <div className="tree-subbranch">
          Levels
          <button className="mini" title="Add level (with floor plan)" onClick={() => store.addLevel()}>
            +
          </button>
        </div>
        {project.levels.map((level) => (
          <div
            key={level.id}
            className={`tree-leaf ${
              store.selection?.kind === "level" && store.selection.id === level.id
                ? "selected"
                : ""
            }`}
            onClick={() => store.select({ kind: "level", id: level.id })}
          >
            <span>
              {level.name} <em>+{level.elevation.toFixed(2)} m</em>
            </span>
            <button
              className="mini"
              title="Delete level"
              onClick={(event) => {
                event.stopPropagation();
                store.removeLevel(level.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="tree-subbranch">Grids</div>
        {project.gridAxes.map((axis) => (
          <div
            key={axis.id}
            className={`tree-leaf ${
              store.selection?.kind === "grid" && store.selection.id === axis.id ? "selected" : ""
            }`}
            onClick={() => store.select({ kind: "grid", id: axis.id })}
          >
            <span>
              Grid {axis.name} <em>{axis.systemName}</em>
            </span>
            <button
              className="mini"
              title="Delete grid"
              onClick={(event) => {
                event.stopPropagation();
                store.removeGridAxis(axis.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        {project.gridAxes.length === 0 && (
          <div className="tree-empty">No grids yet — press G and click twice.</div>
        )}
        <div className="tree-subbranch">Walls</div>
        {project.walls.map((wall) => (
          <div key={wall.id}>
            <div
              className={`tree-leaf ${
                store.selection?.kind === "wall" && store.selection.id === wall.id
                  ? "selected"
                  : ""
              }`}
              onClick={() => store.select({ kind: "wall", id: wall.id })}
            >
              <span>
                Wall {wall.name} <em>{wall.thickness} m</em>
              </span>
              <button
                className="mini"
                title="Delete wall"
                onClick={(event) => {
                  event.stopPropagation();
                  store.removeWall(wall.id);
                }}
              >
                ×
              </button>
            </div>
            {wall.openings.map((opening) => (
              <div
                key={opening.id}
                className={`tree-leaf tree-leaf-nested ${
                  store.selection?.kind === "opening" && store.selection.id === opening.id
                    ? "selected"
                    : ""
                }`}
                onClick={() => store.select({ kind: "opening", id: opening.id })}
              >
                <span>
                  {opening.kind === "DOOR" ? "Door" : "Window"} {opening.name}{" "}
                  <em>
                    {opening.width}×{opening.height} m
                  </em>
                </span>
                <button
                  className="mini"
                  title="Delete opening"
                  onClick={(event) => {
                    event.stopPropagation();
                    store.removeOpening(wall.id, opening.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
        {project.walls.length === 0 && (
          <div className="tree-empty">No walls yet — press W and click twice.</div>
        )}
        <div className="tree-subbranch">Slabs</div>
        {project.slabs.map((slab) => (
          <div
            key={slab.id}
            className={`tree-leaf ${
              store.selection?.kind === "slab" && store.selection.id === slab.id
                ? "selected"
                : ""
            }`}
            onClick={() => store.select({ kind: "slab", id: slab.id })}
          >
            <span>
              {slab.kind === "FLOOR" ? "Floor" : "Roof"} {slab.name}{" "}
              <em>{slab.thickness} m</em>
            </span>
            <button
              className="mini"
              title="Delete slab"
              onClick={(event) => {
                event.stopPropagation();
                store.removeSlab(slab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="tree-branch">
          Sheets
          <button className="mini" title="Add sheet" onClick={() => store.addSheet()}>
            +
          </button>
        </div>
        {project.sheets.map((sheet) => (
          <div
            key={sheet.id}
            className={`tree-leaf ${store.activeSheetId === sheet.id ? "active" : ""} ${
              store.selection?.kind === "sheet" && store.selection.id === sheet.id
                ? "selected"
                : ""
            }`}
            onClick={() => store.activateSheet(sheet.id)}
          >
            <span>
              {sheet.name} <em>{sheet.title}</em>
            </span>
            <button
              className="mini"
              title="Delete sheet"
              onClick={(event) => {
                event.stopPropagation();
                store.removeSheet(sheet.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="tree-branch muted">Schedules</div>
      </div>
    </aside>
  );
}
