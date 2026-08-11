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

   Kiểm tra trước khi deploy:

   ```bash
   bash deploy/check-dns.sh webim.vn <IP-máy-chủ>
   ```

   Script phân biệt ba thứ mà `dig` báo giống hệt nhau (đều là "không có
   gì"): chưa đăng ký · zone chưa bật ở nhà cung cấp DNS · chưa thêm bản
   ghi A. Nó hỏi thẳng nameserver được uỷ quyền nên một NXDOMAIN còn kẹt
   trong cache không làm cấu hình đúng trông như hỏng.
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

Module **Atlas** nhúng nguyên ứng dụng Atlas AEC trong tab, mặc định trỏ
tới `https://atlas.webim.vn`; đổi bằng `VITE_ATLAS_BASE` lúc build. Phía
Atlas cần hai biến:

- `FRAME_ANCESTORS=https://webim.vn` — cho phép WeBIM nhúng. Không có thì
  Atlas trả `X-Frame-Options: SAMEORIGIN` và tab hiện ô trống.
- `WEBIM_ALLOWED_ORIGINS=https://webim.vn` — cho phép gọi `/api/webim/*`
  (mặc định chỉ mở cho vite dev 5173/5174).

`bootstrap.sh --with-atlas` tự đặt cả hai.

## Chạy Atlas cùng máy

Một Caddy giữ chứng chỉ cho cả hai tên; Atlas chạy như một compose project
riêng, cắm vào mạng `webim_edge` dưới alias `atlas-web`.

```bash
sudo bash deploy/bootstrap.sh webim.vn --with-atlas
```

`deploy/atlas-override.yml` không sửa gì trong `atlas/` (đó là git subtree —
sửa vào sẽ đụng độ mỗi lần `git subtree pull`). Nó chỉ:

- tắt Caddy riêng của Atlas (hai Caddy không cùng chiếm 80/443),
- thêm Postgres + Redis chạy tại chỗ thay cho Neon/Upstash,
- gác `landing` + `scraper` sau profile `full` cho nhẹ máy,
- mở Postgres ở `127.0.0.1:55432` để chạy migration và phát hành API key
  từ repo trên host (image Next standalone không có prisma CLI).

Sau khi lên, chạy migration + phát hành key — script in sẵn lệnh kèm mật
khẩu đã sinh.

### Cấu hình máy

| Chạy gì | Tối thiểu | Ghi chú |
|---------|-----------|---------|
| WeBIM Web + relay | 2 vCPU · 4 GB · 40 GB | dư sức |
| + Atlas | 4 vCPU · **16 GB** · **160 GB** | build Next đỉnh ~4 GB |
| + AI tự host | thêm GPU | để `AI_BASE_URL` rỗng ⇒ route trả 501 gọn gàng |

Trên Hetzner: `CX32` (4 vCPU/8 GB/80 GB) đủ cho WeBIM một mình; chạy kèm
Atlas thì lấy `CPX41`/`CX42` (16 GB, 160–240 GB) — 8 GB không swap sẽ bị OOM
đúng giữa lúc build Next, báo về chỉ là `exit code 137`. Script tự cấp 4 GB
swap khi thấy RAM < 12 GB, nhưng đĩa 80 GB vẫn chật cho image Atlas +
Postgres + MinIO. (Giá tham khảo, tự kiểm lại lúc mua.)

Hetzner đặt ở EU: hồ sơ công trình sẽ nằm ngoài Việt Nam. Đủ cho pilot/demo;
trước khi có khách CĐT thật thì cân nhắc chuyển sang VPS trong nước.

## Kiến trúc
```
Internet ──443──▶ Caddy (TLS tự động)
   webim.vn        ├─ /api/* ──▶ relay:8787 (files + auth + AI + ws sync)
                   └─ /      ──▶ static SPA (dist)
   atlas.webim.vn  └────────────▶ atlas-web:3000 (Next) ─▶ postgres · redis · minio
```
