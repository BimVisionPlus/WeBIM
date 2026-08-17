# WeBIM — Threat model, phân loại dữ liệu, RPO/RTO

*17/08/2026. Đọc cùng `docs/KIEN-TRUC.md`. Ngắn có chủ đích: tài liệu an
ninh không ai đọc thì bảo vệ được ai.*

## 1. Phân loại dữ liệu dự án

| Lớp | Dữ liệu | Nơi sống | Nhạy cảm |
|---|---|---|---|
| A — Bí mật vận hành | WEBIM_SECRET, mật khẩu băm (scrypt), VNPay hash secret | `.env`, `accounts.json` (volume) | CAO — lộ là giả mạo được token/thanh toán |
| B — Dữ liệu khách | Mô hình (snapshot), file CDE, markup | volume `relay_data` | CAO — tài sản thiết kế của khách |
| C — Danh tính & quyền | accounts, memberships, plan/credit | volume `relay_users` | TRUNG — lộ là biết ai làm dự án nào |
| D — Nhật ký | audit.jsonl | volume `relay_users` | TRUNG — hành vi người dùng |
| E — Công khai | Catalog QCVN/TCVN, corpus, landing | repo/git | KHÔNG |

Nguyên tắc: lớp A không bao giờ vào git (rsync deploy exclude `.env`,
`users.json` — đã có bài học suýt mất); lớp B+C+D chỉ rời máy chủ qua
backup có kiểm soát.

## 2. Threat model (STRIDE rút gọn, theo thực tế đã vá)

| Mối đe doạ | Đường vào | Phòng thủ hiện có |
|---|---|---|
| Giả mạo danh tính | Đoán mật khẩu | scrypt + timing-safe; rate-limit 20/phút/IP trên auth |
| Token bị thu hồi vẫn sống | Tab cũ của tài khoản đã xoá | verify tra tài khoản SỐNG mỗi request (vá 17/8 — bắt được trong drill dọn QA) |
| Đọc dữ liệu dự án người khác | API file/list/snapshot/WS | Cưỡng chế membership server-side cả 4 đường; /list không lộ tên file |
| Sửa mô hình trái phép | WS frame | Frame theo projectId, viewer/không-thành-viên bị nuốt |
| Nuốt tài nguyên (DoS mềm) | Body/frame khổng lồ | Trần 30MB HTTP (destroy sớm) + 30MB WS maxPayload |
| Dữ liệu độc phá client | NaN/Infinity trong toạ độ, JSON cụt | Assert tại biên domain; fromJson lọc rác; audit đọc bỏ dòng cụt |
| Clickjacking/sniffing | Trình duyệt | HSTS 1y, nosniff, X-Frame-Options DENY, Referrer/Permissions-Policy |
| Trả tiền giả | Callback VNPay giả | HMAC-SHA512 verify cả return lẫn IPN; settle idempotent |
| Mất máy chủ | Cháy volume/xoá nhầm | Backup hằng ngày 14 bản + restore drill (mục 3) |

Chưa phòng (biết và chấp nhận ở quy mô hiện tại — xem ROADMAP):
- Virus scan file upload (CDE nhận mọi file từ người đã đăng nhập).
- Quota dung lượng per-user (một editor có thể ghi đầy đĩa — trần 30MB/file
  làm chậm, không chặn).
- Backup nằm CÙNG máy chủ (offsite là việc kế tiếp của C6).
- 2FA; khoá tài khoản sau N lần sai (mới có rate-limit theo IP).

## 3. RPO / RTO

- **RPO (mất tối đa bao nhiêu dữ liệu): 24 giờ** — backup cron 02:20 giờ
  VN mỗi ngày (volumes relay + config + pg_dump Atlas, giữ 14 bản tại
  `/root/backups`). Dữ liệu trong ngày chưa backup sẽ mất nếu cháy máy.
- **RTO (bao lâu chạy lại): ~30 phút** — dựng máy mới theo
  `docs/SELF-HOST.md`, bung backup vào volume, `docker compose up`.
- **Restore drill 17/08/2026: ĐÃ CHẠY THẬT** — bung bản backup mới nhất ra
  thư mục tạm trên server, xác minh: `accounts.json` đọc được + đúng user,
  `memberships.json` parse được, tar volume relay_data mở được, pg_dump
  Atlas gunzip hợp lệ. Backup chưa từng restore thử là backup trên niềm
  tin; lịch drill: mỗi quý một lần, ghi kết quả vào file này.
- Điểm yếu đã nêu: backup cùng máy → thảm hoạ mất cả máy chủ (Hetzner
  mất node) là mất cả backup. Việc kế tiếp: rsync `/root/backups` sang
  storage thứ hai (Hetzner Storage Box hoặc S3) — khi đó RPO giữ 24h
  nhưng sống sót được thảm hoạ toàn máy.
