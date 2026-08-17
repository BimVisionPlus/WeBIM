# WeBIM — Self-host (gói Enterprise)

*Toàn bộ nền tảng chạy trên một máy chủ của bạn: một container Caddy (TLS
tự động) + một container relay Node zero-dependency. Dữ liệu là FILE trong
Docker volume — backup bằng cách chép thư mục, không có database phải nuôi.*

## Yêu cầu
- Máy chủ Linux có Docker + Docker Compose (2 vCPU / 4 GB đủ cho một công ty vừa).
- Một domain trỏ A record về máy chủ (Caddy tự xin Let's Encrypt).
- (Tuỳ chọn) GPU hoặc máy chạy Ollama nếu muốn bật AI đọc bản vẽ.

## Cài đặt
```bash
git clone https://github.com/BimVisionPlus/WeBIM && cd WeBIM/deploy
cp .env.example .env
```

Sửa `.env`:

| Biến | Giá trị |
|---|---|
| `WEBIM_DOMAIN` | domain của bạn, vd `bim.congty.vn` |
| `WEBIM_SECRET` | `openssl rand -hex 32` — ký token đăng nhập |
| `WEBIM_REGISTRATION` | **`closed`** cho nội bộ (quản trị viên cấp tài khoản) — mặc định `open` |
| `AI_BASE_URL` / `AI_MODEL` | trỏ Ollama/vLLM nếu dùng AI; bỏ trống = tắt |
| `VNPAY_*` | bỏ trống — self-host không cần cổng thanh toán |

Tạo tài khoản quản trị đầu tiên (seed):
```bash
node ../web/relay/auth.mjs hash 'mật-khẩu-mạnh'
```
Dán kết quả vào `users.json` cạnh `docker-compose.yml` (đổi `username` và
`role` thành `admin`) theo mẫu `{"users":[ ... ]}`. Từ lần chạy đầu, tài
khoản sống trong volume (`accounts.json`) — đăng ký thêm, đổi mật khẩu, cấp
gói đều qua UI/API, không sửa file nữa.

Chạy:
```bash
docker compose up -d --build
```

## Sau khi chạy
- Cấp gói không hạn cho người dùng nội bộ (không có billing trong self-host):
  `PUT /auth/users/<u>/plan` body `{"plan":"enterprise","months":null}` với
  token admin — hoặc để mặc định: hạn mức Free chỉ giới hạn số dự án
  *riêng tư tự đăng ký*, dự án được mời không giới hạn.
- **Backup**: `backup.sh` trong thư mục này + cron (xem `docs/KIEN-TRUC.md`
  mục C6). Dữ liệu cần giữ: volume `deploy_relay_users` (tài khoản, quyền,
  audit) và `deploy_relay_data` (file CDE, snapshot dự án) + `.env`,
  `users.json`.
- **Nâng cấp phiên bản**: `git pull && docker compose up -d --build web relay`
  — dữ liệu nằm trong volume, không mất qua rebuild.
- Atlas (quy trình ISO, stage-gate, nhân sự) là stack tuỳ chọn nặng hơn
  (Next.js + Postgres) — xem `deploy/atlas-override.yml`; bỏ qua nếu chỉ cần
  lõi CDE/BIM.

## Kiểm tra sức khoẻ
```bash
curl -s https://<domain>/api/health
```
`{"ok":true,"auth":true,...}` là chạy. Nhật ký kiểm toán: pane Thành viên
của từng dự án, hoặc file `audit.jsonl` trong volume.
