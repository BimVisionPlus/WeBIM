# WeBIM — Roadmap triage (bản đối chiếu 17/08/2026)

*Đối chiếu roadmap 12 tháng (input của founder) với trạng thái repo thực tế
(422 test, production app.webim.vn) và các quyết định trong
`docs/KIEN-TRUC.md`. Bốn cột: ĐÃ XONG (kèm bằng chứng), KẾ TIẾP (kỹ thuật,
theo thứ tự), VIỆC CỦA CON NGƯỜI, và QUYẾT ĐỊNH CẦN CHỐT.*

## 1. ĐÃ XONG (đừng làm lại)

| Mục trong roadmap | Trạng thái |
|---|---|
| Audit code; map code→feature | `docs/KIEN-TRUC.md` — audit + 6 quyết định C1–C6 |
| Threat model, phân loại dữ liệu, backup/RPO/RTO | `docs/THREAT-MODEL.md` (mới) |
| Multi-project + project + membership | Snapshot server theo dự án, claim/mời/role, "Mở từ máy chủ" |
| Auth admin/editor/viewer; invite; đổi/reset mật khẩu | Roles ✔, mời thành viên ✔, tự đổi ✔, admin reset ✔ (mới) |
| Audit log server | JSONL append-only + UI "Nhật ký dự án" |
| Backup + restore test | Cron hằng ngày 14 bản + restore drill đã chạy (xem THREAT-MODEL) |
| CDE trạng thái WIP/Shared/Published, revision P/C | ✔ (folder ISO 19650: chưa — xem Kế tiếp) |
| BYO-S3/MinIO | Storage adapter S3-compatible qua env |
| Quyền tải/xem theo dự án | Cưỡng chế server: file, /list, WS, snapshot |
| Hạng mục/owner/trạng thái/deadline; dashboard tiến độ | Plan + chip hồ sơ + cảnh báo thiếu PUBLISHED |
| Gantt + dependency (FS dạng dependsOn) | ✔ (kéo-thả, critical path: chưa) |
| Corpus QCVN chuẩn hoá + hiệu lực/thay thế + nguồn | qcvn-conflict-map + crawler vbpl.vn hằng tuần |
| Tìm không dấu + citation điều/bảng | ✔ (filter lĩnh vực/năm: chưa) |
| Viewer PDF + annotation + comment sync | Markup đồng bộ theo dự án |
| Hỏi đáp bản vẽ có AI self-host; từ chối khi AI tắt | ✔ (Q&A văn bản QCVN: chưa) |
| Entitlement + quota AI + subscription | Free/Team + credit render + VNPay-ready |
| Permission test, E2E mức API | 422 test vitest gồm enforcement server |
| Realtime presence, conflict (LWW + undo collab) | ✔ |
| BCF export | BCF 2.1, unzip chuẩn (round-trip import: chưa) |
| Mapping mã hiệu/đơn giá | Cost codes + tổng theo mã định mức |
| WWR/OTTV QCVN 09 | Ước tính 3 thành phần, hệ số khai báo |
| Render credit | Free 10 / Team 200, đếm server |
| Self-host package | `docs/SELF-HOST.md` |
| Security review vòng 1 | 4 vòng manual test, vá NaN/data-loss/token-revoke |

## 2. KẾ TIẾP — kỹ thuật, theo thứ tự đề xuất

1. **Organization/workspace** — lớp trên dự án: org chứa members + dự án,
   mời theo org, billing theo org (ghế). Đây là mục lớn nhất chưa có và là
   điều kiện của "Team" đúng nghĩa.
2. **Telemetry/product analytics tối thiểu** — đếm sự kiện phía server
   (đăng ký, claim, upload, render) đã có trong audit.jsonl; cần bảng tổng
   hợp activation/WAU cho founder đọc. Không nhúng tracker bên thứ ba.
3. **Error tracking + uptime** — relay log lỗi có cấu trúc + health check
   ngoài (cron curl + báo khi fail); đủ dùng trước khi cần Sentry.
4. **Viewer IFC hardening/perf** — instancing + progressive load + memory
   budget cho model lớn; bộ test model chuẩn KT/KC/MEP + file lỗi.
5. **CDE nâng**: cấu trúc folder ISO 19650, multipart + checksum cho file
   lớn, approval workflow, quota/retention.
6. **Gantt kéo-thả + critical path; import Excel.**
7. **Clash mesh-level** (tam giác, dùng mesh web-ifc trong phiên) + issue
   assignment + BCF round-trip (import).
8. **PDF nâng**: measurement, so sánh 2 phiên bản, OCR/citation vùng.
9. **Q&A văn bản QCVN có trích điều khoản** (corpus đã máy-đọc-được).
10. **Public API + webhook** — sau khi organization ổn định.

## 3. VIỆC CỦA CON NGƯỜI (không code thay được)

- Phỏng vấn 5 design partners; chốt 3 use case lõi (khuyến nghị giữ trục
  hiện tại: CDE → View → Plan).
- Onboard 10 organization; office hour 2 buổi/tuần; đo NPS, sửa friction.
- Case study, demo video, community launch, referral.
- Điều khoản sử dụng / privacy / SLA beta (tôi soạn nháp được, cần bạn duyệt).
- Đăng ký VNPay merchant (điền credential là tiền chạy).
- Hire trigger, P&L review, chọn regional/vertical.

## 4. QUYẾT ĐỊNH CẦN CHỐT (khuyến nghị kèm theo)

1. **Pricing Free/Pro/Team vs Free/Team/Enterprise hiện tại.** Khuyến
   nghị: thêm **Pro** (cá nhân: không giới hạn dự án riêng, 100 credit,
   ~1.990.000₫/năm) giữa Free và Team; Team gắn với organization (theo
   ghế) khi mục 2.1 xong; Enterprise = self-host. Chưa đổi code cho tới
   khi bạn chốt giá.
2. **Postgres migration / read replica / queue** — MÂU THUẪN với quyết
   định C2 (file-based tới khi đo được giới hạn). Khuyến nghị GIỮ C2, đặt
   ngưỡng đo cụ thể: >200 tài khoản hoặc >500 dự án hoặc p95 ghi
   snapshot >1s thì mở lại quyết định — ghi vào KIEN-TRUC trước khi code.
3. **Tên sản phẩm** — "WeBIM" đã dùng khắp nơi (domain, org, docs).
   Khuyến nghị chốt luôn, đổi sau này đắt vô ích.
4. **Telemetry** — khuyến nghị chỉ dùng dữ liệu server-side đã có
   (audit.jsonl), không nhúng analytics bên thứ ba vào app: hợp khẩu vị
   khách xây dựng VN và khỏi viết privacy policy phức tạp.
5. **"Audit 11 demo"** — cần bạn liệt kê 11 demo nào (repo ~70 cái);
   khung audit dùng lại được từ KIEN-TRUC.
