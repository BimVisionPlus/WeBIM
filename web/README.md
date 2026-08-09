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
