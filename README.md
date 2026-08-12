# WeBIM

WeBIM là add-on BIM authoring độc lập cho Blender, hướng đến workflow giống Revit. Native BIM domain là nguồn dữ liệu authoring; Blender phục vụ viewport/UI và IFC là định dạng import/export qua IfcOpenShell. Dự án không import API nội bộ của Bonsai.


## Nguồn gốc

Dự án khởi đầu từ `Hoangduong314/WeBIM` (commit `a5e6ad3`, khởi tạo Blender
extension) và từ đó được phát triển độc lập trong repo này. Kho gốc chưa công bố
giấy phép, nên phần mã kế thừa từ đó vẫn thuộc bản quyền của tác giả gốc — cần
làm rõ giấy phép trước khi phát hành công khai.


## Atlas AEC — quản lý dự án

`atlas/` là Atlas AEC, nửa quản lý dự án của nền tảng (Site/RFI/submittal,
nghiệm thu NĐ 06/2021, hồ sơ hoàn công, Models + canvas review). Nó được
đưa vào đây bằng `git subtree`, giữ nguyên lịch sử của repo gốc:

```bash
# kéo bản mới từ upstream
git subtree pull --prefix=atlas atlas main

# đẩy thay đổi trong atlas/ ngược lên upstream
git subtree push --prefix=atlas atlas main
```

Remote `atlas` trỏ tới `git@github.com:aec-platform/atlas.git`; thêm lại
sau khi clone bằng `git remote add atlas <url>`.

### Atlas là một tab của WeBIM

Module **Atlas** trong WeBIM Web nhúng nguyên ứng dụng Atlas AEC — toàn bộ
module, session và định tuyến của nó — chứ không phải một liên kết. Atlas là
app Next.js có server riêng nên không biên dịch chung vào bundle Vite được;
nó chạy ở origin của chính nó và được frame vào tab.

Atlas phải cho phép nhúng: đặt `FRAME_ANCESTORS=https://webim.vn`. Không có
biến này thì Atlas gửi `X-Frame-Options: SAMEORIGIN` (mặc định cũ, giữ
nguyên) và tab hiện ô trống — trình duyệt không báo được frame bị từ chối
qua khác origin, nên header của tab luôn có sẵn "Mở tab mới".

### Quy trình phối hợp & tiêu chí chuyển giai đoạn

Trang `/processes` trong Atlas. `WorkflowTemplate` sẵn có lưu DAG dạng JSON
mờ và không có phòng ban, nên không trả lời được hai câu hỏi thực tế: *quy
trình của phòng tôi là gì* và *bước 3 ai làm, hạn nào*. Bốn model mới —
`ProcessTemplate` / `ProcessStep` / `ProcessRun` / `ProcessTask` — mô tả đúng
thứ người ta chạy: một checklist có thứ tự, thuộc về một phòng ban, áp vào
dự án thì sinh việc có người phụ trách, hạn và tiến độ trên từng bước.

- **Tiêu chí, không phải động từ.** Mỗi bước có `criteria` viết thành thứ
  kiểm được: *"Khối lượng khớp với bóc tách; sai lệch > 5% phải có giải
  trình"* chứ không phải *"hoàn thành công việc"*.
- **Điểm dừng (`isGate`)** — run không tự đóng khi còn điểm dừng chưa đạt.
  Một stage gate đi vòng qua được thì chỉ là trang trí.
- **Hạn cộng dồn**: bước 3 đến hạn sau khi bước 1 và 2 đã tiêu hết số ngày
  của chúng — đúng nghĩa một quy trình tuần tự.
- ITP (`ItpTemplate`/`ItpItem`) giữ nguyên vai trò nghiệm thu chất lượng
  hiện trường theo TCVN. Đây là nửa văn phòng: phối hợp nội bộ và chuyển
  giai đoạn. Hai bên gặp nhau ở điểm dừng, nơi ITP là bằng chứng.

Seed: `scripts/seed-processes.ts` (nằm trong `seed-all.sh`) — 5 quy trình
mẫu cho các phòng Công việc / Hành chính / Tài chính / Đấu thầu, **seed cho
mọi tổ chức có thành viên** chứ không chỉ tổ chức đầu tiên: tài khoản demo
nào đăng nhập cũng phải thấy.

### Seed dữ liệu demo cho Atlas

```bash
cd atlas && bash scripts/seed-all.sh
```

Chạy migrate, seed gốc (tổ chức · người dùng · dự án) rồi toàn bộ 25 seed
theo module. Chạy lại được — các seed đều upsert hoặc kiểm tra trước.

Script tồn tại vì chạy lẻ từng seed vướng hai cái bẫy, mà vướng cái nào
cũng chỉ nhận được một stack trace của Prisma: `DATABASE_URL` (Prisma CLI
tự đọc `.env`, script tsx thì không) và `tsx` chỉ nằm trong
`packages/db`, không có ở thư mục gốc.

Đăng nhập demo: `anh.nguyen@cofico.vn` / `demo1234!`

### Cầu nối WeBIM → Atlas Models

WeBIM dựng model, Atlas chạy giấy tờ quanh nó. Module **Atlas** trong
WeBIM Web xuất IFC ngay trên trình duyệt rồi đăng vào Models của một dự
án Atlas:

```text
WeBIM Web  ──POST /api/webim/presign──►  Atlas   (xin quyền, kiểm định dạng)
           ──PUT  presigned URL──────►  S3/MinIO (bytes không qua Atlas)
           ──POST /api/webim/commit──►  Atlas   (tạo Model + chạy APS)
```

Các route nằm ở `atlas/apps/web/app/api/webim/`, xác thực bằng `ApiKey`
theo tổ chức thay vì session — WeBIM Web chạy ở origin riêng nên không
có cookie Auth.js. Riêng `/api/webim/health` không cần key: nó chỉ trả
`{"service":"atlas"}` kèm CORS để tab Atlas **tự nhận ra** Atlas đang
chạy ở đâu. Không có nó thì "có server trả lời" là tất cả những gì biết
được từ origin khác — và cổng 3000 trên máy lập trình thường là Dagster
hay Grafana chứ không phải Atlas.

```bash
# phát hành key (chỉ hiện một lần)
cd atlas
pnpm exec tsx scripts/webim-issue-key.ts --user ky.su@congty.vn --days 180
pnpm exec tsx scripts/webim-issue-key.ts --revoke wbm_1a2b3c4d

# origin của WeBIM Web mà Atlas chấp nhận (mặc định: vite 5173/5174)
WEBIM_ALLOWED_ORIGINS=https://webim.congty.vn
```

Key mang quyền `projects:read` + `models:write`, chỉ thấy dự án thuộc
tổ chức của chính nó, và ghi audit dưới tên người phát hành. Đẩy lại
cùng tên + phiên bản sẽ ghi đè bản cũ thay vì tạo trùng.

## Kiến trúc

```text
Native BIM domain
       ↓
Blender adapter / viewport
       ↓
IFC export adapter
       ↓
IfcOpenShell → .ifc
```

```text
webim/
├── domain/                 # native model; không bpy/IfcOpenShell
│   └── project.py          # NativeBimProject, GridDatum
├── core/
│   └── session.py          # authoring session + persistence/export boundary
├── tools/                  # IFC adapter cũ, đang được di chuyển dần
└── blender/
    ├── persistence.py      # lưu native JSON vào .blend
    └── tools/grid/         # modal, renderer, panel
```

## Native BIM Project

- `NativeBimProject` giữ dữ liệu authoring hiện hành.
- Không cần tạo project thủ công; tool đầu tiên tự tạo project mặc định nếu chưa có.
- Native model được serialize vào custom property `webim_native_project` của Blender scene khi lưu `.blend`.
- Khi mở lại `.blend`, add-on khôi phục native project từ JSON.
- IFC không bị thay đổi trong lúc người dùng vẽ Grid.
- Wall hiện vẫn dùng IFC implementation cũ và sẽ được chuyển sang native domain ở giai đoạn tiếp theo.
- Native domain đọc và giữ nguyên `walls`/`openings`/`levels`/`sheets` do WeBIM Web (thư mục `web/`) tạo ra; Export IFC của add-on cũng xuất các native wall này (có void cho opening). Blender dựng chúng trong viewport qua **WeBIM → Rebuild Native Walls** (`webim/blender/tools/wall/`), và đồng bộ tự chạy lại sau khi nhận project từ web.

## Native Grid Drawing Tool

- Chọn **Shift+A → WeBIM → Grid** để vào chế độ vẽ.
- Hai lần click tạo ngay một `GridDatum` độc lập, giống Revit.
- Công cụ tiếp tục chạy để vẽ trục kế tiếp.
- Con trỏ tự bắt endpoint của Grid hiện có theo bán kính màn hình.
- Sau điểm đầu, preview tự khóa theo trục X/Y khi nằm trong góc snap.
- Điểm thường vẫn được làm tròn theo `Snap increment`.
- Khi chọn một Grid trong Object Mode, click anchor tròn ở đầu mút, rê chuột đến vị trí mới rồi click để xác nhận. Có thể nhập khoảng thay đổi có dấu và nhấn Enter; native geometry chỉ được commit khi xác nhận.
- Cả hai đầu Grid có `GridHeadAnnotation` riêng nằm ngoài endpoint. Type mặc định `Circle + Name` gồm vòng tròn và tên trục; có thể đổi cả hai sang `Hexagon + Name` hoặc `None` và điều chỉnh `Annotation scale` trong Grid Properties.
- Blender representation là một assembly: Grid Curve là root, hai `GridHeadAnnotation` là child objects. Vì vậy Move/Rotate root tác động cả Grid và hai head, nhưng annotation vẫn giữ object/type riêng để thay thế như Revit.
- Có thể dùng Duplicate mặc định của Blender (`Shift+D`, menu Duplicate hoặc `Alt+D`). WeBIM nhận diện representation bị copy, cấp stable native Grid ID và tên trục mới, tách linked Curve data khi cần, rồi tạo hai bubble mới cho Grid bản sao.
- Module `Views` quản lý camera kỹ thuật native gồm Floor Plan, Section và Elevation. Mọi view kỹ thuật dùng camera `ORTHO`, khóa ba trục rotation, có drawing scale riêng (ví dụ 1:50, 1:100) và view extent riêng.
- Grid annotation dùng paper-scale của camera đang active: kích thước model-space được quy đổi từ baseline 1:100, nên khi chuyển view hoặc đổi scale, hai bubble được cập nhật theo view.
- Project Browser và Properties đã tách khỏi N-Panel. Chia giao diện thành hai `Properties Editor`, mở tab Scene của Blender rồi đặt bộ chọn WeBIM của ô thứ nhất thành `Project Browser`, ô thứ hai thành `Properties`. Mỗi ô giữ chế độ riêng theo area, nên có thể dock cạnh viewport giống bố cục Revit.
- `Project Browser` hiển thị cây `Views → Floor Plans / Sections / Elevations`, `Model → Grids`, cùng các nhánh chuẩn bị cho Sheets và Schedules. Click tên view để mở camera; dùng icon Duplicate/Delete để quản lý view; click Grid để chọn representation trong viewport.
- `WeBIM Properties` hiển thị semantic properties theo selection: Grid, Technical View hoặc Wall. N-Panel viewport không còn đăng ký các panel Grid/Wall/View cũ.
- Tên được tự gán `A, B, C...`, không ép U/V/W lúc authoring.
- Mỗi Blender Curve giữ metadata:
  - `webim_id`
  - `webim_class = GridDatum`
  - `grid_name`
  - `grid_system`
- `Esc` xóa điểm đang chọn hoặc thoát; `Enter`/chuột phải thoát công cụ.

## Export IFC

**Save Blender** và **Export IFC** là hai thao tác khác nhau:

- `Ctrl+S`: lưu native project vào `.blend`.
- **Export IFC**: tạo một snapshot IFC từ native model.

Khi export, WeBIM nhóm GridDatum theo `grid_system` và phương hình học:

- Hai họ phương → `IfcGrid.UAxes` và `IfcGrid.VAxes`.
- Ba họ phương → thêm `IfcGrid.WAxes`, kiểu `TRIANGULAR`.
- Chỉ một họ hoặc hệ không hợp lệ → giữ từng trục dưới dạng `IfcAnnotation` với `ObjectType = WEBIM_GRID_AXIS`.
- Nhiều grid system được xuất thành nhiều `IfcGrid` riêng.
- Native model trong session không bị thay đổi sau export.

Mapping:

```text
Native GridDatum.name        → IfcGridAxis.AxisTag
Native GridDatum curve       → IfcGridAxis.AxisCurve
Native grid_system           → IfcGrid.Name
Standalone/invalid GridDatum → IfcAnnotation
```

## Chạy test

```bash
uv sync --extra dev
env -u PYTHONPATH .venv/Scripts/pytest.exe -q
env -u PYTHONPATH .venv/Scripts/ruff.exe check webim tests scripts
```

Việc bỏ biến `PYTHONPATH` ngăn Python của dự án đọc nhầm binary NumPy từ môi trường Hermes.

## Build và cài add-on

```bash
env -u PYTHONPATH .venv/Scripts/python.exe scripts/build_addon.py
```

Trong Blender:

1. **Edit > Preferences > Add-ons > Install from Disk**.
2. Chọn `dist/webim-0.1.0.zip` hoặc dùng symbolic link khi phát triển.
3. Bật **WeBIM**.
4. Mở **3D View > Sidebar > WeBIM**.
5. Chọn **Shift+A → WeBIM → Grid**; project được tạo tự động.
6. Click hai điểm cho mỗi trục.
7. Lưu authoring project bằng `.blend`; chọn **Export IFC** khi cần trao đổi.

Các lệnh tạo phần tử nằm trong submenu **Add → WeBIM**. N-Panel chỉ hiển thị thông số Wall/Grid; lệnh xuất IFC nằm tại **File → Export → WeBIM (.ifc)**.

Với Blender 5.2/Python 3.13 trên máy phát triển hiện tại, IfcOpenShell 0.8.5 nằm tại `C:\Users\ADMIN\AppData\Roaming\Blender Foundation\Blender\5.2\scripts\modules`.

## Nguyên tắc

- Native BIM domain là source of truth cho authoring.
- Domain không được import `bpy`, `ifcopenshell`, `bonsai.core` hay `bonsai.tool`.
- Blender object là viewport representation, không phải business model duy nhất.
- IFC được tạo tại import/export boundary và phải được validation độc lập.
- Mỗi behavior mới bắt đầu bằng test RED.
- Wall và các tool cũ được migrate sang native domain theo từng vertical slice.
