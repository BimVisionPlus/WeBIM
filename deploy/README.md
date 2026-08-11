# Deploy WeBIM với HTTPS + domain

## Chuẩn bị
1. Máy chủ có Docker + docker compose, mở cổng 80/443.
2. Trỏ DNS `A`/`AAAA` của domain về máy chủ.
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
```bash
cd deploy
docker compose --env-file .env up -d --build
```

Client build sẵn tự dùng same-origin `/api` (HTTPS + wss) — không cần
cấu hình gì thêm; muốn API ở nơi khác thì build với `VITE_API_BASE`.

## Kiến trúc
```
Internet ──443──▶ Caddy (TLS tự động)
                   ├─ /api/* ──▶ relay:8787 (files + auth + AI + ws sync)
                   └─ /      ──▶ static SPA (dist)
```
