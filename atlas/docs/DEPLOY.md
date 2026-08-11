# Atlas AEC — Deployment Runbook

Single-VPS self-host (8 GB RAM minimum, 24 GB if running AI on the same box). Targets the closed-pilot phase with 3–5 CĐT/NT customers. Scale-out notes at the end.

---

## 0. First-time local setup (developer machine)

```bash
# Prereqs: Node 20+, pnpm 9, Docker, Postgres client (for backup script)
pnpm install
cp .env.example .env
# Edit .env — minimum required:
#   AUTH_SECRET   (run: openssl rand -base64 32)
#   AUTH_URL=http://localhost:3000
#   NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Start infra
pnpm infra:up                  # docker compose: postgres + minio + redis

# Database
pnpm db:generate
pnpm db:push                   # syncs schema (dev). Use db:migrate in prod.
pnpm db:seed                   # demo data: 1 project, 5 issues, 2 AI suggestions

# (Optional) AI stack — OSS, self-host
pnpm ai:up                     # boots Ollama + Whisper, pulls ~10 GB on first run
pnpm ai:logs                   # follow model-pull progress

# Dev
pnpm dev                       # web on :3000, landing on :3001
```

Confirm: `curl http://localhost:3000/api/health` → `{ ok: true, db: "up" }`.
Confirm AI: `curl http://localhost:3000/api/ai/health` → `200` (or `503` with structured reason if models still pulling).

### Demo credentials (after `pnpm db:seed`)

| Email | Vai trò | Tổ chức |
|---|---|---|
| `anh.nguyen@cofico.vn` | Chỉ huy trưởng (PM) | Cofico (NT chính) |
| `binh.tran@apave.com` | Giám sát (TVGS) | Apave |
| `cuong.le@vinhomes.vn` | CĐT (chủ đầu tư) | Vinhomes JSC |
| `dung.pham@aa-design.com` | Thiết kế (TVTK) | AA Corp |

Mật khẩu cho tất cả: **`demo1234!`** — đổi ngay trước khi giao demo cho client thật.

Demo path để show client: đăng nhập làm `dung.pham@aa-design.com` (TVTK) → mở RFI `VHGP-S9-RFI-001` → xem khung "Gợi ý AI" → nhấn "Áp dụng vào câu trả lời" → ký bằng nút "Lưu & chuyển ANSWERED".

---

## 1. Required env vars (production)

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres (use connection pooler / pgBouncer for >50 concurrent) |
| `AUTH_SECRET` | ✅ | 32+ chars. Rotation invalidates all sessions. |
| `AUTH_URL` | ✅ | Public URL (`https://atlas.example.vn`) |
| `NEXT_PUBLIC_BASE_URL` | ✅ | Same as AUTH_URL — used in invite emails |
| `S3_ENDPOINT` `S3_*` | ✅ | S3 / MinIO config. **Rotate the demo creds.** |
| `REDIS_URL` | recommended | Rate-limit + session store. Memory fallback if absent. |
| `RESEND_API_KEY` or `AUTH_EMAIL_SERVER` | ✅ for invites/reset | One of: Resend, SMTP url |
| `EMAIL_FROM` | ✅ if email | e.g. `Atlas AEC <no-reply@atlas-aec.vn>` |
| `APS_CLIENT_ID` `APS_CLIENT_SECRET` | for BIM viewer | Without these, model upload works but viewer stays in PENDING |
| `SENTRY_DSN` | recommended | Error tracking. Self-host with GlitchTip if needed. |
| `LOG_LEVEL` | optional | `info` default, `debug` for triage |
| `NEXT_PUBLIC_INDEXABLE` | optional | `true` to allow Google indexing the landing/legal pages |
| `AI_ENABLED` | optional | `false` to disable all AI calls (panels hide, endpoints return `disabled`). Default `true`. |
| `OLLAMA_BASE_URL` | when AI on | Default `http://localhost:11434`. Use LAN IP for shared GPU host. |
| `OLLAMA_LLM_MODEL` | when AI on | Default `qwen2.5:7b-instruct`. Smaller VPS: `qwen2.5:3b-instruct`. |
| `OLLAMA_VLM_MODEL` | when NCR vision on | Default `qwen2.5vl:7b`. |
| `OLLAMA_EMBED_MODEL` | when Specs RAG on | Default `bge-m3`. |
| `WHISPER_BASE_URL` | when voice on | Default `http://localhost:8009`. |
| `WHISPER_MODEL` | when voice on | Default `Systran/faster-whisper-medium`. |

---

## 1b. AI deployment topologies

**Option A — same box (simplest, ≤10 PM users).** Ollama + Whisper run on the same VPS as Next.js. Needs 24 GB RAM. Boot with `pnpm ai:up` next to `pnpm infra:up`. Models cached in `atlas-ollama` and `atlas-whisper` named volumes — survive container restart.

**Option B — dedicated GPU box (recommended for ≥10 users or NCR vision).** Put Ollama on a host with an RTX 4090 / A10G / L40S. Set `OLLAMA_BASE_URL=http://10.0.0.42:11434` in the app's `.env`. Network must be private — Ollama has no auth.

**Option C — air-gapped (CĐT lớn yêu cầu on-prem).**

```bash
# On a build machine with internet:
ollama pull qwen2.5:7b-instruct qwen2.5vl:7b bge-m3
docker save ollama/ollama:latest fedirz/faster-whisper-server:latest-cpu | gzip > ai-images.tar.gz
tar -czf ollama-models.tar.gz ~/.ollama/models

# Transfer ai-images.tar.gz + ollama-models.tar.gz + repo to the air-gapped host.
docker load < ai-images.tar.gz
# Mount ~/.ollama/models from the tar
```

Verify deployment: visit `/settings/ai` as any logged-in user — must show "✓ Sẵn sàng" badge with all models green.

---

## 2. Build & ship the container

```bash
docker build -f apps/web/Dockerfile -t atlas-aec/web:$(git rev-parse --short HEAD) .
# Smoke
docker run --rm -p 3000:3000 --env-file .env.prod atlas-aec/web:<sha>
```

Health: `GET /api/health` must return 200 within 30s of container start.

---

## 3. Migrations on deploy

```bash
# Run inside the same container/network as the new app version:
pnpm --filter @atlas/db prisma migrate deploy
```

Zero-downtime rule: **only additive migrations** in a single release. Renaming or dropping a column requires a 2-release deploy (add new → backfill → switch app → drop old in next release).

---

## 4. Backups

```bash
# Cron (every 2h):
0 */2 * * * /opt/atlas-aec/scripts/backup.sh >> /var/log/atlas-backup.log 2>&1
```

Required env for the script: `DATABASE_URL`, optionally `BACKUP_S3_BUCKET` + `BACKUP_S3_ENDPOINT` + AWS creds.

**Restore drill (do this BEFORE first paying customer):**

```bash
gunzip -c atlas-aec-db-<ts>.sql.gz | psql "$STAGING_DATABASE_URL"
```

S3/MinIO buckets: use bucket-level versioning + replication to a second region/provider.

---

## 5. TLS + reverse proxy

Recommended stack: Caddy or Traefik in front of the container.

```caddy
atlas.example.vn {
  encode gzip
  reverse_proxy localhost:3000
}
```

Caddy auto-issues Let's Encrypt cert. HSTS already enforced by `middleware.ts` in prod.

---

## 6. Observability

- **Health:** `GET /api/health` — wire to uptime monitor (UptimeRobot / cron-job.org).
- **Errors:** Sentry / GlitchTip if `SENTRY_DSN` set. Otherwise `LOG_LEVEL=info` → stdout, scrape into Loki/Grafana.
- **Audit log:** stored in `AuditEvent` table. Surface via SQL for compliance review (NĐ 06/2021 — quản lý nhật ký).

---

## 7. Security checklist before opening to pilot users

- [ ] Rotated S3/MinIO credentials from `.env.example` defaults.
- [ ] `AUTH_SECRET` generated fresh per environment.
- [ ] HTTPS enforced (Caddy/Traefik + HSTS).
- [ ] Backups running + one successful restore drill completed.
- [ ] Rate limit working (test: 10× wrong-password login → 6th locks out 15 min).
- [ ] Sentry receiving events (force one with `curl /api/_test_error`).
- [ ] Privacy + Terms reviewed by legal counsel (the in-repo VN drafts are starting points, not legal advice).
- [ ] Antivirus scanner deployed on the upload bucket (ClamAV via Lambda/event-driven or async worker).
- [ ] APS callback URL whitelisted in Autodesk console if using BIM viewer.
- [ ] **Demo password rotated.** `pnpm db:seed` creates 4 users with `demo1234!` — change before any non-sandbox env.
- [ ] **AI host firewalled.** If `OLLAMA_BASE_URL` points to another machine, restrict 11434/8000 to the app's IP only — Ollama/Whisper have no auth layer.
- [ ] **AI suggestion review.** Train TVTK/CĐT users that AI output is *suggestion only*; the workflow guard (`@atlas/workflows`) is what enforces signoff.

---

## 8. Scaling notes (when pilot →  v1 GA)

- **Postgres:** add read replica when issue table > 10M rows. Move audit log to a separate timescale-partitioned table.
- **APS pipeline:** replace fire-and-forget in `apps/web/app/api/drawings/route.ts` with a BullMQ worker reading from Redis.
- **File uploads:** add a presign-signing edge proxy + ClamAV scanner. Reject objects whose post-upload size mismatches the presigned content-length.
- **Multi-region:** dual-write S3 → secondary region. Postgres logical replication to standby.

---

## 9. Disaster recovery RTO/RPO targets (pilot)

| Metric | Target |
|---|---|
| RTO (recovery time) | ≤ 4 hours |
| RPO (data loss tolerance) | ≤ 2 hours (matches backup cadence) |
| Audit log retention | 5 years minimum |
| Hồ sơ nghiệm thu retention | full warranty period of project + 5 years (NĐ 06/2021) |
