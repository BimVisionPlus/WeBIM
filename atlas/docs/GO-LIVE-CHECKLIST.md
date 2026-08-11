# Go-live checklist — aecplatform.vn

Step-by-step cho người vận hành. Mỗi bước có ETA. Tổng từ lúc Hetzner approve đến lúc live: **~45 phút**.

> Mọi việc thao tác qua web/registrar — không cần coding. Đánh dấu ✅ khi xong.

---

## 🔴 PHẢI làm trước go-live

### [ ] 1. Hetzner VPS provision · ETA 5p

1. https://console.hetzner.cloud → đăng nhập (đợi verify approve qua email)
2. Project `aecplatform` → **+ Add Server**
3. Image: **Ubuntu 22.04** · Type: **CX22** (4vCPU 8GB 80GB · €4.51/m) · Location: **Helsinki** hoặc **Nuremberg**
4. SSH Keys → **Add SSH Key** → paste:
   ```
   ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINHNkvVWQUPsqgCaPDoMltnfiW4eIzwDLLgtUBjbGxx9 aecplatform-vn-deploy
   ```
5. Firewall: open ports **22, 80, 443** (ICMP cho ping cũng OK)
6. Create → note **public IPv4** (vd `5.75.123.45`) — copy lưu ngay

**→ Paste cho tôi:** `root@<IP>` để tôi SSH vào deploy.

---

### [ ] 2. DNS A records tại Mat Bao · ETA 5p sửa + 10p propagate

1. https://id.matbao.vn → đăng nhập
2. Menu **Dịch vụ của tôi** → **Tên miền** → click `aecplatform.vn`
3. Tab **Quản lý DNS** (hoặc **DNS Record**) → bạn sẽ thấy các record A hiện tại đang trỏ Vercel `76.76.21.21`
4. **Xoá** các A record Vercel cũ
5. **Thêm 4 A records mới** trỏ về VPS IP (thay `5.75.123.45` bằng IP thật):
   | Type | Host (Name) | Value | TTL |
   |---|---|---|---|
   | A | `@` (apex) | `5.75.123.45` | 300 |
   | A | `www` | `5.75.123.45` | 300 |
   | A | `app` | `5.75.123.45` | 300 |
   | A | `status` | `5.75.123.45` | 300 |
6. **Lưu** → đợi 5-10 phút propagate
7. Verify từ terminal: `dig +short aecplatform.vn app.aecplatform.vn` — phải trả VPS IP

> ⚠️ **Lưu ý:** sau khi đổi DNS, Vercel project hiện tại sẽ stop serve qua aecplatform.vn (nhưng vẫn chạy ở `*.vercel.app` URL gốc). Có thể decommission Vercel sau khi VPS chạy ổn định 24h.

---

### [ ] 3. Resend API key + verify domain · ETA 10p

1. https://resend.com/api-keys → tạo key tên `aecplatform-prod` → **Permission: Sending access** → **Domain: aecplatform.vn**
2. Copy `re_xxxxxxxxxxxxxx` — **paste cho tôi**
3. https://resend.com/domains → add `aecplatform.vn` (nếu chưa)
4. Resend in ra **3 DNS records (TXT + DKIM CNAME)** cần thêm vào Mat Bao:
   - `_resend` TXT — domain verification
   - `resend._domainkey` TXT — DKIM signing key
   - `_dmarc` TXT — DMARC policy (`v=DMARC1; p=quarantine; rua=mailto:dpo@aecplatform.vn`)
5. Quay lại Mat Bao DNS panel → **Thêm 3 TXT records** đúng như Resend hiện ra
6. Đợi ~10p → click **Verify** ở Resend dashboard

> **Tại sao quan trọng:** không verify → email từ `no-reply@aecplatform.vn` bị Gmail mark spam → user không nhận được password reset.

---

## 🟡 NÊN làm trong tuần đầu

### [ ] 4. Sentry signup · ETA 5p

1. https://sentry.io/signup → free tier 5k events/month
2. **Create Project** → Platform: **Next.js** → Project name: `atlas-aec-web`
3. Copy **DSN** (dạng `https://abc@xyz.ingest.sentry.io/123`)
4. **Paste cho tôi** → tôi update `.env.production` (Sentry SDK đã wire sẵn trong code)

### [ ] 5. UptimeRobot · ETA 5p

1. https://uptimerobot.com/signUp → free 50 monitors
2. Add 3 monitors:
   - `https://app.aecplatform.vn/api/health` — HTTP keyword: `"ok":true` — interval 5p
   - `https://aecplatform.vn/` — HTTP 200 — interval 5p
   - `https://status.aecplatform.vn/` — HTTP 200 — interval 5p
3. Alert contacts: email + Telegram (free)

### [ ] 6. Decommission Vercel project (sau 24h ổn định)

1. https://vercel.com → project hiện tại của aecplatform.vn
2. **Settings** → **Domains** → remove `aecplatform.vn` + `app.aecplatform.vn`
3. **Delete project** hoặc keep as backup (free plan thì 0đ)

### [ ] 7. Daily backup cron · ETA 2p (tôi tự setup sau khi SSH được)

`scripts/backup.sh` đã có. Tôi thêm cron sau khi deploy:
```cron
0 3 * * *  cd /opt/atlas-aec && BACKUP_S3_BUCKET=aecplatform-backup ./scripts/backup.sh >> /var/log/atlas-backup.log 2>&1
```

### [ ] 8. GitHub Secrets cho CI/CD · ETA 5p

`.github/workflows/deploy.yml` đã có. Cần bạn add 4 GitHub secrets:
1. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
2. Add từng cái:
   - `VPS_HOST` = `<VPS IP>`
   - `VPS_USER` = `root`
   - `VPS_SSH_KEY` = content file `~/.ssh/aecplatform_deploy` (tôi sẽ paste cho bạn copy)
   - `VPS_ENV_PRODUCTION` = content `.env.production` (tôi sẽ paste sau khi điền đủ)
3. Push to main → workflow tự deploy

---

## 🟢 NÊN làm trong tháng đầu (optional)

### [ ] 9. AI stack (Ollama + bge-m3 + Qwen2.5)

Hetzner GEX44 (€184/m) hoặc Lambda Labs A6000 (~$0.80/h spot). Set `OLLAMA_BASE_URL` + `AI_ENABLED=true`.

### [ ] 10. VNPT-CA / Viettel-CA chữ ký số

Đăng ký doanh nghiệp → CA cấp USB token + API. Wire vào `VNPT_CA_API` env.

### [ ] 11. HĐĐT Viettel/MISA/BKAV

Khi bắt đầu invoice khách → đăng ký provider → wire `EINVOICE_API_KEY` + `EINVOICE_MST`.

### [ ] 12. Legal pages

- ✅ `/privacy` (đã có)
- ✅ `/terms` (đã có)
- ✅ `/data-protection` (vừa tạo — NĐ 13/2023)
- [ ] Đăng ký với A05 (Bộ Công an) — hồ sơ đánh giá tác động dữ liệu trước khi chuyển ra nước ngoài (do Neon ở Singapore)

---

## 🚀 Lệnh smoke test sau go-live

```bash
./scripts/pre-launch-smoke.sh
```

Kết quả mong đợi: `✅ GO LIVE READY` (~50 checks)

---

## TLDR đường găng

```
Hetzner approve → Bạn paste VPS IP
                        ↓
                Tôi SSH + deploy (15p)
                        ↓
            Bạn đổi DNS Mat Bao (5p)
                        ↓
        Bạn verify Resend domain DNS (10p)
                        ↓
            Caddy issue TLS cert (~1p auto)
                        ↓
              ./pre-launch-smoke.sh
                        ↓
                  🎉 LIVE
```

Tổng thời gian thực: **~45 phút** từ Hetzner approve đến khách truy cập được.
