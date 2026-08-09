# WeBIM Web

Web-app port of the WeBIM Blender add-on: Revit-style BIM authoring in the
browser. The native BIM domain from `webim/domain` is ported 1:1 to
TypeScript; the Blender viewport adapter is replaced by a Three.js
orthographic floor-plan viewport.

```text
Native BIM domain (src/domain, TypeScript port of webim/domain)
       ↓
Three.js viewport adapter (src/viewport) + React panels (src/ui)
       ↓
IFC export adapter (src/export)
       ↓
IFC4 STEP text → .ifc download
```

## Compatibility with the Blender add-on

- **Save JSON** produces the same schema-version-4 native project JSON that
  the add-on stores in the `.blend` scene property `webim_native_project`.
  Projects round-trip both ways.
- **Export IFC** replicates `finalize_grid_axis_annotations`: axes are
  grouped per grid system into parallel families (1° tolerance); two
  families export as a `RECTANGULAR` `IfcGrid` (UAxes/VAxes), three as
  `TRIANGULAR` (+WAxes); anything else keeps each axis as an
  `IfcAnnotation` with `ObjectType = WEBIM_GRID_AXIS`.

## Features

- Grid drawing tool (`G` or the Grid button): two clicks per axis, tool
  stays active like Revit. Endpoint snapping (screen radius), X/Y axis
  lock inside a 5° cone, increment snapping (configurable).
- Wall tool (`W`): two clicks per wall on the native domain (thickness /
  height in the Properties panel); rendered as an extruded solid and
  exported as `IfcWall` with a SweptSolid body. Walls serialize under a
  `walls` key the Blender add-on ignores for now.
- Corner joins: when exactly two wall ends meet at a point, both
  footprints are mitered so the pair shares the corner points — in the
  viewport and in the exported IFC profile
  (`IfcArbitraryClosedProfileDef`). Collinear continuations, star joints
  (3+ coincident ends) and angles past the miter limit (4× thickness)
  keep square butt ends.
- T-joins: a wall end (with no coincident end) landing on another
  wall's axis segment is trimmed — or extended, if it stops just short —
  to butt against the near face of the continuous wall, which stays
  unbroken. Works at any angle; parallel walls and end vicinities are
  excluded.
- Per-end join overrides (`Start join` / `End join` in wall properties):
  `Miter` (default), `Butt` (the wall listed first in the project runs
  through to the far face, the other butts against its near face), or
  `Square (no join)`. Stored as `join_start`/`join_end` in the wall
  JSON; older files default to miter.
- Join relationships export as `IfcRelConnectsPathElements` — corner
  pairs with `ATSTART`/`ATEND`, T-joins with `ATPATH` on the continuous
  wall; square ends emit no relationship.
- Grid datums in elevations/sections: grids perpendicular to the view
  render as vertical dashed lines with the head bubble above the top of
  the walls (Revit-style); grids parallel to the view are hidden, and
  plan linework is not drawn edge-on.
- Door (`D`) and window (`O`) openings: click a wall to place (door
  0.9×2.1 m, window 1.2×1.2 m sill 0.9 m; offset snapped and clamped).
  Walls render as pieces around their openings — real holes with
  lintels and sills — plus a filling panel and a plan marker. Openings
  are hosted: they serialize inside the wall's `openings` array, list
  nested under their wall in the browser, and edit via offset / width /
  height / sill height.
- IFC: the wall body stays full and each opening exports as
  `IfcOpeningElement` (+`IfcRelVoidsElement`) filled by an
  `IfcDoor`/`IfcWindow` via `IfcRelFillsElement`, contained in the
  storey.
- Door swing symbols in plan: open leaf plus quarter arc, driven by the
  door's hinge jamb (start/end) and swing side (left/right of the wall
  direction), editable in the properties panel and serialized as
  `hinge_end`/`swing_side`.
- Openings on the same wall must not overlap along the axis
  (edge-to-edge is allowed); violations are rejected on add, edit and
  drag with a status message.
- Selected openings show a centre anchor: click it, move along the
  wall (ghost preview, snapped and clamped), click to confirm — the
  same click-move-click pattern as endpoint editing.
- Storey levels: every wall is hosted on a level (`level_id`), floor
  plans bind to one, and adding a level (Levels `+`) creates its floor
  plan 3 m above the topmost. Moving a level's elevation carries its
  walls; plans render only their own level; elevations/sections draw
  green level lines with name tags. Legacy files migrate to a
  synthesized Level 1. IFC exports one `IfcBuildingStorey` per level
  with walls contained accordingly.
- Sheets: `A101`-numbered sheets with an A1 titleblock rendered in
  paper space; place any view from the sheet's properties panel — each
  placement is a labelled frame sized by the view's ortho extent at its
  scale, positioned in paper millimetres. Serialized under `sheets`.
  Frames render the view's LIVE model content (plan or elevation
  linework, walls, slabs, annotations) scaled to paper and clipped to
  the frame with local clipping planes.
- Floor (`F`) and roof (`R`) slabs: two clicks span a rectangle on the
  active level; the outline is stored as a polygon (`slabs` key) with
  thickness and a z offset — the top face sits at level + offset, so
  floors hang below their level and roofs default to the storey top.
  Slabs render in plans (level-filtered), elevations and sheet frames,
  and export as `IfcSlab` (`FLOOR`/`ROOF`) in their level's storey.
- The Blender add-on gains `WeBIM → Rebuild Native Walls`: it builds
  native walls (joins and openings included) as viewport meshes via a
  pure-Python port of the wall geometry
  (`webim/domain/wall_geometry.py`) that is pytest-verified against
  the web implementation's reference values.
- Section views hatch cut faces: walls and slabs crossing the section
  plane (X = 0) draw their cut rectangles with 45° lines at 1.5 mm
  paper spacing (`src/application/sectionCuts.ts`), in the live
  viewport and inside sheet frames.
- The add-on's IFC export now voids native wall openings
  (`IfcOpeningElement` + `IfcRelVoidsElement`) and fills them with
  `IfcDoor`/`IfcWindow` via `IfcRelFillsElement` — verified by pytest
  against a real ifcopenshell round-trip.
- Two-way sync: moving a `NativeWall` mesh in Blender writes the plan
  delta back into the domain (`translate_wall`; z stays bound to the
  level, openings ride along) and rebuilds the meshes so joins
  recompute.
- The Python add-on domain (`webim/domain/project.py`) now parses and
  preserves `walls`/`openings`/`levels`/`sheets`, so a web-authored
  project survives a Blender round-trip, and the add-on's IFC export
  includes native walls (openings not yet voided on that path).
- Anchor endpoint editing: select a grid or wall, click an endpoint
  anchor, move, click to confirm (Esc cancels) — same click-move-click
  flow as the add-on.
- Technical views drive the camera: floor plans look down, elevations
  along +Y, sections along +X, framed by each view's ortho scale;
  drawing tools stay plan-only.
- Names auto-assigned `A, B, C…`; both endpoints get grid head bubbles
  (`Circle + Name`, `Hexagon + Name`, or `None`) placed outside the
  endpoint, sized in paper space from the 1:100 baseline of the active
  technical view.
- Line styles: Continuous/Dashed/Dotted/Dash Dot/Center/Hidden patterns
  tiled in paper millimetres per the view scale; ISO line weights.
- Project Browser: Views (Floor Plans/Sections/Elevations) and
  Model → Grids; Properties panel driven by selection.
- `Esc` clears the pending point or exits the tool; `Enter`/right-click
  exits; `Delete` removes the selected grid. Wheel zooms to cursor;
  middle/right/Shift-drag pans.
- Autosaves to `localStorage`.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest — domain, snapping, IFC export
npm run build      # typecheck + production bundle
```
