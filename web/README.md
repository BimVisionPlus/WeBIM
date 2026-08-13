# WeBIM Web

Web-app port of the WeBIM Blender add-on grown into a construction
lifecycle workspace: Revit-style BIM authoring plus the platform modules
of the WeBIM concept — **Model | CDE | Plan | Standards | Drawings |
Atlas**, with QTO and clash detection as live schedule kinds.

Platform modules (all metadata lives in the synced project, so realtime
collaboration covers them for free; only binaries touch the server):

- **3D Viewer** — online BIM viewing (mục 1): orbit/zoom/pan perspective
  view built from the same wallPieces the 2D viewport uses (openings
  cut for real), slabs, per-level coloring, and linked IFC models as
  translucent boxes. "Render concept AI" (mục 11) captures the current
  view and sends it to the platform server: a self-hosted vision model
  writes a Vietnamese render brief + an English image prompt grounded
  in the massing (`AI_BASE_URL`), and with `SD_BASE_URL` the server also
  returns a real img2img concept render from your own Stable Diffusion.

- **CDE** — ISO 19650-style document containers: code, WIP/SHARED/
  PUBLISHED/ARCHIVED status, P/C revision numbering, notes, upload/
  download through the platform server's `/files` API (a swappable
  BYO-storage adapter).
- **Plan** — hạng mục/tasks with category, dates, status, progress,
  finish-to-start dependencies and a Gantt view (SVG timeline with week
  ticks, status-colored bars with progress fill, today line, dependency
  arrows — red when a task starts before its predecessor ends).
- **Standards** — QCVN/TCVN lookup with diacritic-insensitive search,
  tags and supersession chains (seed catalog; long-term source is the
  machine-checkable corpus).
- **Drawings** — PDF viewing straight from CDE revisions plus synced
  notes ("Hỏi AI" answers from a self-hosted model once `AI_BASE_URL`
  is set — see below).
- **QTO** — net quantities from the same wallPieces geometry the
  viewport renders (openings deducted, typed walls split per material
  layer), slab volumes, opening counts, CSV export.
- **Clash matrix** — system × system, each cell on/off with its own
  tolerance in metres (Navisworks' clash matrix, without the licence).
  Systems are the native categories plus one per linked IFC model, which
  in practice is the discipline. It wraps the engine rather than changing
  it: everything is still detected, the matrix only decides what is
  reported, so turning a cell back on cannot miss a clash that was never
  looked for. Suppressed counts are always shown — a filter that hides
  silently lies — and anything it cannot classify is kept, never dropped.
  Stored in the project (`clash_matrix`), so it travels and syncs; absent
  from the JSON until a cell is changed. The Blender add-on does not read
  this key, so a round-trip through `.blend` drops it.
- **Clash** — separating-axis footprint overlap × z-range checks with
  legitimate wall joins excluded and slab bearing tolerated; plus
  Navisworks-style linked-model screening: "Link IFC…" reads external
  IFC files (src/ifc/parseIfc.ts — SweptSolid extrusions with
  polyline/rectangle profiles and translation + z-rotation placement
  chains; unsupported bodies are counted and reported) into world AABBs
  and reports native-vs-linked hard clashes.

- **Climate** — per-orientation envelope screening (mục 9): façade
  and glazing areas plus WWR across 8 compass sectors (+Y = North,
  exterior face = normal pointing away from the plan centroid), with
  hot-humid-climate shading guidance in the spirit of QCVN 09:2017/BXD.
  An early-design screen, not an OTTV/energy calculation.

- **Dashboard** — one picture of the model and the coordination around it:
  stat tiles (elements, clashes, documents, mean progress) over five
  single-series bar charts — clashes per system pair, tasks and CDE
  documents by status, volume by material, openings by kind. Every number
  comes from the open project; nothing is fetched.

  Charts are hand-rolled SVG like the Gantt — five bar charts do not
  justify a charting dependency. Colours are the validated data-viz
  palette re-stepped for this app's panel and checked with the palette
  validator rather than by eye: a single sequential blue for magnitude, an
  ordinal blue ramp for the CDE workflow, and the reserved status colours
  for task state. Status green and red are close under deuteranopia, so
  every state row carries its own icon and written label — colour is
  reinforcement, never the message. Single series throughout means no
  legend is needed; the title names the series and rows are labelled
  directly.

  The suppressed-clash count is carried onto the tile and repeated under
  the chart. A dashboard that counts only what survived the clash matrix
  tells a coordinator the model is cleaner than it is.

- **IFC Data** — trích xuất & tổ hợp: property sets and element quantities
  from every linked IFC, unioned into one table, filterable, exportable as
  CSV. Each discipline exports its own file with its own psets, so the
  useful question — every element carrying `Pset_WallCommon.IsExternal`
  across KT and KC — cannot be answered inside a single file.

  Columns are the union across models and a cell is left **blank** where a
  model does not carry that property: the row survives and nothing is
  invented as zero. Column order is sorted rather than first-seen, so
  re-linking a file does not reshuffle a table someone is reading, and
  coverage (`filled/total`) is shown per column because a federated model
  carries hundreds of property names, most of them nearly empty.

  This needed the IFC reader to grow past geometry: `parseIfc` now follows
  `IfcRelDefinesByProperties` to `IfcPropertySet` and `IfcElementQuantity`
  and keeps each element's `GlobalId` — the only stable handle back to the
  authoring tool. Typed STEP values are unwrapped (`IFCBOOLEAN(.T.)`,
  `IFCLABEL('EI 60')`, `IFCLENGTHMEASURE(2.5)`); unset (`$`) yields nothing
  rather than the string "$".

- **4D** — mô phỏng tiến độ thi công: a date scrubber over the same 3D
  viewer, showing only what the plan says has been built by that date, plus
  a WebM export recorded off that canvas so the video is exactly what was
  on screen. Each task carries `elementIds` — the walls and slabs it
  builds — and the demo project ships sequenced, so the tab works on first
  run.

  An element counts as built when its task **finishes**, not when it
  starts: a half-built wall has no honest geometry, and drawing it whole
  while the task runs overstates progress on exactly the date someone is
  checking. Tasks in progress are counted and reported separately rather
  than rounded either way.

  The tab audits the sequence and says what it does not cover — elements no
  task claims (they would never appear), tasks that build nothing (normal:
  permits, procurement), and references to deleted elements. Without that,
  a plan covering half the model still ends on a finished building and
  looks correct.

  The other half of B11 is **PCCC**, below — it needed rooms first.

- **PCCC** — sàng lọc thoát nạn, on top of the rooms the domain now
  carries, with the thresholds read off **QCVN 06:2022/BXD hợp nhất Sửa đổi
  1:2023** (TT 06/2022/TT-BXD; sửa đổi theo TT 09/2023/TT-BXD, hiệu lực
  01/12/2023) rather than invented:

  | Kiểm tra | Nguồn |
  |---|---|
  | Hệ số không gian sàn, m²/người | Bảng G.9 |
  | Số người: thiết kế duyệt trước, bảng sau | G.3 |
  | Người trên mét lối ra: 165 / 115 / 80 theo bậc chịu lửa | G.2.1.1 |
  | Bề rộng tối thiểu 0,8 m — 1,2 m khi > 50 người (trừ F1.3) | 3.2.9 |
  | Phải có hai lối ra: ≥ 50 người, hoặc quá 25 m | 3.2.5 c), d) |
  | Cự ly tới lối ra gần nhất, nhà ở | Bảng G.1 |
  | Cự ly tới lối ra gần nhất, nhà công cộng | Bảng G.2a |
  | Hai lối ra cách ≥ ½ đường chéo (⅓ nếu có Sprinkler), ≥ 7 m | 3.2.8 |

  The first version of this screen keyed travel distance off **room usage**,
  which is not an axis the quy chuẩn uses at all: the limits depend on bậc
  chịu lửa, on where the door opens (giữa hai lối ra vs hành lang cụt) and
  on mật độ dòng người. Usage only sets the number of people. Fixing that
  meant restructuring the check, not correcting a constant — which is why
  the thresholds now live in tables keyed the way the document keys them,
  and `tests/pccc.test.ts` pins each one to its bảng by name.

  What the model still cannot answer is on screen too, because a page that
  looks authoritative about fire safety is worse than no page:

  - Distance is **straight-line** from the furthest corner to the nearest
    door, not the walked route around partitions and furniture. The real
    path is never shorter, so a room that fails here definitely fails; one
    that passes may still fail when the route is drawn.
  - Buồng thang bộ, hành lang chung and the fire rating of individual
    elements are not modelled, so the leg from the room door through the
    corridor to the stair is not added in.
  - Where Bảng G.9 has no row for a usage (phòng kỹ thuật, nhà để xe — the
    latter counts 2 người/ô đỗ, and WeBIM has no parking bays), occupancy is
    reported as **không xác định** and the room is excluded from the people
    total rather than silently counted as empty.

  Bậc chịu lửa, cấp nguy hiểm cháy kết cấu, nhóm nhà, mật độ dòng người and
  Sprinkler are per-project settings (`fire_settings`), because a finding is
  meaningless without the row it was judged from. Rooms are drawn with the
  **Room** tool — two opposite corners, like a slab — and carry a code, a
  usage and an optional occupancy override. Both serialize only once they
  differ from the default, so a project that never opened the tab round-trips
  byte-identical.

  The Standards module still lists QCVN 06 with `edition_verified: false`.
  That flag means the whole document has been checked page by page against
  công báo, which it has not — only the tables above were.

- **Atlas** — Atlas AEC (`../atlas/`, the project-management half of the
  platform) embedded whole, not linked to. Atlas is a Next.js app with
  its own server, so it cannot be compiled into this Vite bundle; the
  "Ứng dụng" pane frames it at its own origin, which keeps its session,
  routing and streaming intact while making it one more WeBIM tab. Atlas
  must permit the embed with `FRAME_ANCESTORS` — it sends
  `X-Frame-Options: SAMEORIGIN` otherwise, and a refused frame is not
  reportable cross-origin, so the header always offers "mở tab mới". The
  address is discovered rather than typed: `/atlas`, then `:3170`, then
  `:3000`, taking the first that identifies itself through Atlas's
  CORS-enabled `/api/webim/health`. Reachability alone picks up whatever
  else owns the port.
  The tab is the application and nothing else — uploading a model is
  something Atlas already does, so a second way to do it here was one
  panel too many.

- **Đẩy sang Atlas** (toolbar, next to Export IFC) — publishing the
  native project is a kind of export, not a screen, so it lives with the
  other exports and opens a dialog only while in use. What it does that
  Atlas cannot is take *this* project straight from the native domain,
  with no export-then-upload round trip: IFC is written in the browser,
  presigned, PUT to Atlas's S3/MinIO and registered, so the bytes never
  pass through the Atlas server. Authenticated by an org-scoped `wbm_…`
  key; same model name + revision replaces the previous upload rather
  than stacking duplicates. See `../README.md` → **Atlas AEC** for how to
  mint the key.

Platform server hardening:

- **Auth/roles** — token login (`POST /auth/login`) against
  `relay/users.json` (scrypt; generate entries with
  `node relay/auth.mjs hash <password>`), roles admin/editor/viewer
  enforced server-side: viewers read files and receive sync but their
  uploads are 403'd and their model-sync frames dropped by the relay
  (presence still passes). No users.json = open dev mode.
- **BYO storage** — `relay/storage.mjs` adapters: local disk (default)
  or any S3-compatible endpoint (AWS/MinIO) via hand-rolled SigV4 —
  set `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
  (+ `S3_REGION`). Tested against a fake S3 verifying signature shape.
- **Self-hosted AI** (`relay/ai.mjs`) — no closed API anywhere in the
  path, so hồ sơ and site imagery never leave the customer's network.
  Text and vision go to any OpenAI-compatible model server you run
  (Ollama, vLLM, llama.cpp, LM Studio) via `AI_BASE_URL` + `AI_MODEL`;
  `POST /ai/read-drawing` extracts a stored PDF's text layer with pdfjs
  and asks the model about it, answering into the Drawings module's
  "Hỏi AI" box. A scanned drawing has no text layer and is reported as
  needing OCR rather than guessed at. `POST /ai/render-concept` asks a
  vision model for a Vietnamese render brief + an English prompt, then
  — if `SD_BASE_URL` points at a self-hosted AUTOMATIC1111-compatible
  Stable Diffusion — img2img's the massing screenshot at denoising
  0.65, so it dresses the massing instead of inventing a building.
  Unset `AI_BASE_URL` and both routes answer a 501 naming what to run.
  `GET /health` reports the configured model. Verified end to end
  against a local Ollama.
- **Standards corpus** — `npm run import-corpus` (scripts/
  import-corpus.mjs) parses the machine-checkable qcvn-conflict-map
  repo (registry + cross-regulation conflicts) into corpus.json; the
  catalog merges corpus over seed with source badges, conflict refs
  and the corpus's own edition_verified honesty flag. Two seed
  supersessions verified against web sources 2026-08-10:
  QCVN 07:2016→07:2023/BXD, TCVN 5575:2012→5575:2024. The native BIM domain from `webim/domain` is ported 1:1 to
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
  recompute. Each wall also gets an editable 2-point axis curve
  (`NativeWallAxis`): grab an endpoint like a grid and
  `set_wall_axis` writes the new plan axis back (z level-bound).
- Blender draws door swing symbols (`NativeDoorSwing` curves: open
  leaf + quarter arc) from the same `door_swing` geometry as the web,
  pytest-matched to the web reference values.
- Wall types with layered assemblies: `WallTypeDatum` (named layers
  with material and thickness, serialized under `wall_types` and
  preserved by the Python domain). Typed walls derive their thickness
  from the layer sum — editing the assembly re-derives every instance —
  and draw layer interface lines in plan. IFC associates one
  `IfcMaterialLayerSet` (+`IfcMaterial` per material) with all walls of
  a type via `IfcRelAssociatesMaterial`.
- Dimension annotations (`M`): three clicks — two measured points
  (with full snapping) and a placement click choosing the line's side
  and offset. Rendered per owning floor plan (and in its sheet frames)
  with extension lines, 45° ticks and the measured value; offset
  editable, serialized under `dimensions`.
- Multi-user sync: element-level last-writer-wins merge (Lamport
  clocks, client id tie-break) — peers editing different elements merge
  cleanly, same-element conflicts take the newest edit, deletions
  propagate. Two parallel transports: a BroadcastChannel between tabs
  and a WebSocket to the relay service (`npm run relay`, port 8787 or
  `?relay=ws://…`), reconnecting with backoff and converging late
  joiners via state announce. The relay (`relay/server.mjs`) is a dumb
  fan-out that never inspects payloads; its only smarts is broadcasting
  a synthetic `leave` when a socket drops — tested with real sockets.
- Presence: each client broadcasts name, color, tool and current
  selection (heartbeat + on change, stale peers pruned). The toolbar
  shows a relay status dot and one chip per collaborator; elements a
  peer has selected get their colored dot in the Project Browser and
  render tinted in the peer's color in the viewport.
- Schedules — the last Project Browser branch: `ScheduleDatum`
  (name + kind, serialized under `schedules`, preserved by the Python
  domain) renders live derived tables in the main area — Walls
  (length/thickness/height/opening count with totals), Doors/Windows
  (mark/type/host/level/dims/sill) and Slabs (shoelace area,
  thickness, top elevation). Kind and name edit in the properties
  panel.
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

## Demo

A first visit opens on **Nhà phố demo 12×8** — an app that opens on "No
walls yet" demonstrates nothing. It is only ever seeded when
`localStorage` is empty, so it never overwrites work; **Demo** in the
toolbar reloads it deliberately.

The demo is built by `src/demo/seedProject.ts`, through the same domain
constructors the tools use, rather than shipped as JSON. A checked-in
`.webim.json` is a snapshot of a schema and schemas move: the file this
replaced had no `openings` at all while this README claimed it did. Built
from code, a changed signature stops the build instead of loading a
project with holes in it.

Two storeys of a 12×8 m house: seven grids in two families (so IFC export
takes the `RECTANGULAR IfcGrid` path), mitered brick walls plus a 110
partition, two doors and five windows, floor/roof slabs, a dimension,
sheet A101, WALL/OPENING/QTO/CLASH schedules, two CDE documents with
notes, and five planned tasks. Dates are fixed rather than relative to
today — a demo reading "trễ 400 ngày" next year is worse than one that is
plainly a sample.

## Demo tĩnh (miễn phí, không cần máy chủ)

```bash
npm run build:demo     # VITE_STANDALONE=1 → không mở socket nào
```

`dist/` ~950 KB, tải lên bất kỳ host tĩnh nào. Không có router nên không
cần cấu hình SPA fallback.

**Chạy được**: Model · 3D Viewer · Standards · Climate · QTO · Clash ·
Plan/Gantt · Export IFC · Open/Save JSON. Mọi thứ lưu trong `localStorage`.

**Cần máy chủ**: CDE + Drawings (kho file), cộng tác nhiều máy, AI. Ở chế
độ này chúng báo rõ lý do thay vì ném lỗi `Failed to fetch`.

Cloudflare Pages (miễn phí, nhận cả repo private, gắn được domain riêng):

| Thiết lập | Giá trị |
|-----------|---------|
| Build command | `cd web && npm ci && npm run build:demo` |
| Output directory | `web/dist` |
| Environment variable | `VITE_STANDALONE=1` |

GitHub Pages không dùng được: repo private cần gói trả phí — mà repo này
chưa công khai được vì phần mã kế thừa từ `Hoangduong314/WeBIM` chưa rõ
giấy phép (xem **Nguồn gốc** ở trên).

### DNS: `www.webim.vn`, giữ nameserver ở PA Việt Nam

Một bản ghi trong bảng **Cấu hình bản ghi tên miền** của PA:

| Host | Loại | Giá trị | TTL |
|------|------|---------|-----|
| `www` | `CNAME` | `<tên-project>.pages.dev` | 3600 |

Rồi thêm `www.webim.vn` vào **Custom domains** của project bên Cloudflare
Pages; chứng chỉ TLS Cloudflare tự cấp sau vài phút.

**`webim.vn` trần sẽ không mở được.** Apex không đặt CNAME được (RFC 1034),
mà Cloudflare Pages chỉ làm phẳng CNAME khi zone nằm trên nameserver của
Cloudflare — ở đây zone vẫn ở PA. Muốn apex chạy thì phải hoặc chuyển
nameserver sang Cloudflare, hoặc đổi sang host có IP apex cố định (Netlify
`75.2.60.5`). Người gõ thiếu `www` sẽ thấy lỗi tên miền, nên đây là việc
còn nợ chứ không phải chuyện nhỏ.

Uỷ quyền ở registry .vn đã đúng (`ns1/ns2.pavietnam.vn`) nhưng zone chưa
được nạp lên máy chủ PA — `dig @ns1.pavietnam.vn webim.vn SOA` còn rỗng,
nên resolver công cộng trả SERVFAIL. Lưu bản ghi đầu tiên thường sẽ tạo
zone; kiểm lại bằng `bash ../deploy/check-dns.sh` (hoặc `dig` ở trên).

## Deploy (HTTPS + domain)

See `../deploy/`: Caddy terminates TLS automatically (Let's Encrypt)
and serves the SPA + proxies `/api/*` (WebSocket included) to the
platform server; `docker compose --env-file .env up -d --build` after
pointing DNS and filling `.env`. The client auto-targets same-origin
`/api` in production (override with `VITE_API_BASE`).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest — domain, snapping, IFC export, AI adapter
npm run build      # typecheck + production bundle
```
