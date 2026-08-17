# WeBIM — Audit & Kiến trúc chốt

*Bản chốt 17/08/2026, sau audit toàn repo + production. Đây là tài liệu quyết
định: mỗi mục "CHỐT" là điều đã quyết, code sau này theo nó; đổi thì sửa
tài liệu này trước.*

## 1. Hiện trạng (audit)

### Số liệu
| Hạng mục | Giá trị |
|---|---|
| WeBIM Web | 57 file TS/TSX, ~18.400 dòng; 389 test vitest xanh |
| Runtime deps | 7 (react, three, web-ifc, pdfjs-dist, ws…) — cố ý mỏng |
| Relay | Node thuần, zero-dep, 3 file (server/auth/members) + storage adapter |
| Atlas | Next.js + Prisma + Postgres, ~40 module, stack riêng |
| Production | Hetzner CPX32 (150GB, dùng 27%), Caddy + Docker, HTTPS |
| TODO/FIXME trong code | 0 |

### Dòng dữ liệu hiện tại
```
Browser (localStorage: project JSON ≤5MB)
   │  LWW theo từng phần tử, WebSocket
   ▼
Relay (KHÔNG lưu project state — chỉ chuyển tiếp frame)
   │  users.json (danh tính) · memberships.json (quyền theo dự án)
   ▼
Storage volume (file nhị phân CDE, key = projectId/…; S3-compatible tuỳ chọn)
```

### Điểm mạnh giữ nguyên
- Domain thuần (`domain/project.ts`) không dính UI — test được, port được
  (Blender add-on dùng chung mô hình).
- Sync LWW theo phần tử + undo theo phần tử cùng một đơn vị dữ liệu.
- Phân quyền theo dự án cưỡng chế ở server (file, /list, WebSocket).
- Validate tại biên domain (NaN/Infinity chết ở cửa — bài học vòng test 3).
- Relay zero-dep: một `node server.mjs` là chạy — giữ được lời hứa self-host.

### Lỗ hổng xếp theo rủi ro
1. **Server không lưu project state** *(chặn GĐ2)* — "late joiner nhận state
   từ peer đang online". Không ai online = thành viên mới nhận dự án RỖNG;
   một mình đổi máy = mất dự án. CDE chưa phải "DB của mình" chừng nào
   nguồn sự thật còn nằm trong localStorage từng browser.
2. **Không có backup production** *(rủi ro ngay bây giờ)* — volume relay
   (file CDE, memberships) và Postgres Atlas chưa có cron backup nào.
3. **localStorage 5MB** — dự án lớn (nhiều markup, nhiều phần tử) sẽ đụng
   trần; hiện chỉ mesh cache là được miễn lưu bền.
4. **users.json tĩnh, mount read-only** — không tự đăng ký, không đổi mật
   khẩu, thêm người là SSH sửa file *(chặn GĐ3 onboarding/billing)*.
5. **Hai hệ danh tính** — relay users.json và Atlas (Auth.js + Postgres)
   không biết nhau; người dùng đăng nhập hai lần.
6. **Relay đơn node, không rate-limit HTTP** — đủ cho GĐ1-2, phải sửa
   trước khi mở đăng ký công khai.

## 2. Kiến trúc CHỐT

### C1. Nguồn sự thật của dự án chuyển về server *(việc đầu tiên của GĐ2)*
Relay lưu snapshot project JSON theo `projectId` (file trong storage volume,
ghi tmp+rename, giữ N bản gần nhất). Client: mở dự án → GET snapshot → merge
LWW với bản local → sync như cũ; mỗi commit đẩy snapshot (debounce). Không
đổi giao thức frame — chỉ thêm persistence hai đầu. localStorage hạ xuống
làm cache offline, hết vai nguồn sự thật.

### C2. Relay giữ triết lý zero-dep, dữ liệu là FILE
users/memberships/project-snapshots đều là file JSON trong volume (ghi
tmp+rename). KHÔNG thêm database vào relay chừng nào chưa đụng giới hạn
thật (đo bằng số dự án/người dùng, không đoán). Khi đụng: SQLite trước,
Postgres sau — và quyết định đó ghi vào đây trước khi code.

### C3. Danh tính hợp nhất VỀ PHÍA relay, không phải Atlas
Relay là chủ tài khoản (nhẹ, self-host được, không kéo Postgres vào gói
free). GĐ3 thêm: API đăng ký + đổi mật khẩu (users.json chuyển sang volume
ghi được), token refresh. Atlas nhận SSO từ relay (JWT chung WEBIM_SECRET)
ở GĐ5 — trước đó chấp nhận hai lần đăng nhập, KHÔNG xây hai hệ billing.

### C4. Billing bám vào tier đã có
`Section.tier` (FREE/CORE/PLUS/BIM) là nguồn sự thật của paywall. Gói:
Free (Công cụ + BIM demo), Team (CORE + PLUS theo số ghế), Enterprise
(self-host + hỗ trợ). Enforcement server-side theo claim trong token —
UI chỉ hiển thị, không phải hàng rào.

### C5. Atlas là vệ tinh, không phải lõi
Atlas phục vụ nhóm A (quy trình ISO, stage-gate, nhân sự) qua iframe +
deep-link như hiện tại. Không di cư dữ liệu WeBIM vào Prisma; không để
tính năng lõi (CDE/View/Plan) phụ thuộc Atlas sống hay chết.

### C6. Đường ổn định vận hành (GĐ3)
Backup cron hằng ngày (volumes relay + `pg_dump` Atlas, giữ 14 bản, rsync
sang chỗ thứ hai), health-check + alert đơn giản, rate-limit HTTP trên
relay, log xoay vòng. *(Backup đã bật ngay trong đợt audit này — mục 3.)*

## 3. Việc đã làm ngay trong đợt audit
- Bật cron backup hằng ngày trên production: volume relay (users,
  memberships, file CDE) + dump Postgres Atlas → `/root/backups`, giữ 14
  bản (xem `deploy/backup.sh`).
- Dọn 21GB build cache Docker; thêm prune vào cron tuần.

## 4. Bản đồ 6 giai đoạn ↔ quyết định
| GĐ | Nội dung | Quyết định chi phối |
|---|---|---|
| 1 | Audit + chốt kiến trúc | tài liệu này |
| 2 | Luồng Project→CDE→View→Plan→QCVN/PDF | C1 (server lưu dự án) |
| 3 | Ổn định, billing, onboarding, support | C2, C3, C4, C6 |
| 4 | Collab, clash, QTO, audit trail | C1 (audit log cạnh snapshot) |
| 5 | Dashboard, BCF, cost mapping, hardening | C3 (SSO), C4 (enforcement) |
| 6 | Enterprise/self-host, vi khí hậu, render credit | C2 (self-host = copy volume) |
