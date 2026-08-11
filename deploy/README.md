# Deploy WeBIM với HTTPS + domain

Domain chính thức: **webim.vn** (Atlas nằm ở `atlas.webim.vn`, xem
`../atlas/README-DEPLOY.md`).

## Chuẩn bị
1. Máy chủ có Docker + docker compose, mở cổng 80/443.
2. Trỏ DNS về IP máy chủ — Caddy chỉ xin được chứng chỉ khi bản ghi đã
   phân giải:

   | Bản ghi | Tên | Giá trị |
   |---------|-----|---------|
   | A | `webim.vn` | IP máy chủ |
   | A | `www.webim.vn` | IP máy chủ (tuỳ chọn) |
   | A | `atlas.webim.vn` | IP máy chủ chạy Atlas |

   Kiểm tra trước khi deploy: `dig +short webim.vn` phải ra đúng IP.
3. `cp deploy/.env.example deploy/.env` và điền:
   - `WEBIM_DOMAIN` — Caddy tự xin chứng chỉ Let's Encrypt cho domain này.
   - `WEBIM_SECRET` — `openssl rand -hex 32`.
   - `AI_BASE_URL` + `AI_MODEL` — model server tự host tương thích OpenAI
     (Ollama/vLLM/llama.cpp) để bật AI đọc bản vẽ + brief render (tuỳ chọn).
   - `SD_BASE_URL` — Stable Diffusion tự host (A1111/SD.Next/Forge) để sinh
     ảnh concept thật (tuỳ chọn).
   - `S3_*` — BYO storage (tuỳ chọn; bỏ trống thì file lưu trong volume).
4. Tạo tài khoản: `node web/relay/auth.mjs hash <mật-khẩu>` rồi ghép vào
   `deploy/users.json` theo `web/relay/users.example.json`.
   (Không có users.json = open mode, chỉ dùng cho thử nghiệm.)

## Chạy

Một lệnh trên máy chủ mới (Ubuntu/Debian) — tự cài Docker, sinh
`WEBIM_SECRET`, build và chờ chứng chỉ:

```bash
sudo bash deploy/bootstrap.sh webim.vn
```

Script dừng ngay nếu DNS chưa trỏ về máy này: Let's Encrypt xác thực qua
HTTP nên Caddy sẽ quay vòng xin chứng chỉ mà không báo gì rõ ràng.
Chạy lại bao nhiêu lần cũng được — đó cũng là đường redeploy.

Hoặc làm tay:

```bash
cd deploy
docker compose --env-file .env up -d --build
```

Client build sẵn tự dùng same-origin `/api` (HTTPS + wss) — không cần
cấu hình gì thêm; muốn API ở nơi khác thì build với `VITE_API_BASE`.

Module **Atlas** mặc định trỏ tới `https://atlas.webim.vn`; đổi bằng
`VITE_ATLAS_BASE` lúc build. Phía Atlas phải đặt
`WEBIM_ALLOWED_ORIGINS=https://webim.vn` thì trình duyệt mới gọi được
`/api/webim/*` (mặc định chỉ cho vite dev 5173/5174).

## Kiến trúc
```
Internet ──443──▶ Caddy (TLS tự động)
                   ├─ /api/* ──▶ relay:8787 (files + auth + AI + ws sync)
                   └─ /      ──▶ static SPA (dist)
```
