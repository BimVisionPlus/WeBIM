# Multi-tenant subdomain infrastructure

How to wire `*.aecplatform.vn` so each tenant subdomain reaches the
same Next.js container.

## 1. DNS — wildcard A record

At your DNS provider (Cloudflare / VNPT / GoDaddy / etc.) add:

```
Type: A
Name: *
Value: 142.132.170.171   (Hetzner VPS IP)
TTL: auto
Proxied: no  (if Cloudflare — set to "DNS only" not "Proxied")
```

Cloudflare wildcard SSL needs Pro plan ($25/mo) for proxied wildcards.
For "DNS only" mode you'll need a wildcard cert from Let's Encrypt
(below). Most Cloudflare free-plan users will run "DNS only" + Caddy
auto-cert.

Verify:
```bash
dig +short test-tenant.aecplatform.vn  # should return 142.132.170.171
dig +short anything.aecplatform.vn    # should return 142.132.170.171
```

## 2. Reverse proxy — Caddy (recommended)

Caddy auto-fetches Let's Encrypt wildcard certs via DNS-01 challenge.

`/opt/atlas-aec/Caddyfile`:
```caddy
*.aecplatform.vn, aecplatform.vn, app.aecplatform.vn {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }

    reverse_proxy web:3000 {
        header_up Host {host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-For {remote}
        header_up X-Real-IP {remote}
    }

    encode gzip
    log {
        output stdout
        format console
    }
}
```

The Cloudflare DNS plugin needs an API token with `Zone.DNS:Edit`
permission. Set `CLOUDFLARE_API_TOKEN=...` in your env.

Add to `docker-compose.prod.yml`:
```yaml
caddy:
  image: caddy:2-alpine
  build:
    context: .
    dockerfile: Caddyfile.dockerfile  # see below
  restart: unless-stopped
  ports: ["80:80", "443:443"]
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy_data:/data
    - caddy_config:/config
  environment:
    - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
  depends_on: [web]

volumes:
  caddy_data:
  caddy_config:
```

`Caddyfile.dockerfile` (to include the Cloudflare plugin):
```dockerfile
FROM caddy:2-builder-alpine AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare
FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

## 3. Reverse proxy — nginx (alternative)

If you prefer nginx, you'll need a wildcard cert from certbot:

```bash
# One-time cert fetch (requires DNS-01 via Cloudflare)
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cf.ini \
  -d 'aecplatform.vn' -d '*.aecplatform.vn'
```

`/etc/nginx/sites-enabled/aecplatform.conf`:
```nginx
server {
    listen 443 ssl http2;
    server_name aecplatform.vn *.aecplatform.vn;

    ssl_certificate /etc/letsencrypt/live/aecplatform.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aecplatform.vn/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Cert auto-renew:
```bash
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

## 4. Application env

Add to `/opt/atlas-aec/.env.production`:
```bash
TENANT_BASE_DOMAIN=aecplatform.vn
TENANT_TEMPLATE_SLUG=cofico        # default org cloned for new tenants
```

## 5. Cron — tenant lifecycle

Daily 03:00 VN time, expire / archive / purge tenants:

```bash
# /etc/cron.d/tenant-lifecycle
0 20 * * * root /usr/bin/docker exec atlas-aec-web-1 sh -c 'cd /app && node /app/scripts/tenant-expire-cron.js' >> /var/log/tenant-cron.log 2>&1
```

(20:00 UTC = 03:00 ICT.)

Or use the existing worker cron if you have one.

## 6. Verify end-to-end

```bash
# After deploy, hit a fake subdomain — should 404 (not a tenant yet)
curl -I https://nonexistent.aecplatform.vn  # → 404 or sign-up redirect

# Self-serve provision
curl -X POST https://aecplatform.vn/api/tenant/provision \
  -H "Content-Type: application/json" \
  -d '{"slug":"qa-test","name":"QA Pilot","email":"qa@example.com","company":"QA Corp"}'
# → { ok: true, url: "https://qa-test.aecplatform.vn", signinUrl: "..." }

# Hit the new subdomain
curl -I https://qa-test.aecplatform.vn  # → 200

# Sales CRM
curl https://app.aecplatform.vn/admin/tenants  # → list with qa-test row
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `<slug>.aecplatform.vn` returns 502 | Caddy can't reach `web` container | Check `docker compose ps web` running |
| Cert error on subdomain | Wildcard cert not fetched | `caddy reload` and check logs for ACME challenge |
| Subdomain reaches main app instead of tenant | middleware.ts not deployed | Check `apps/web/middleware.ts` includes `extractTenantSlug` |
| Visit count not bumping | `logTenantVisit` not called | Hook into root layout server component |

## Cost

Hetzner Cloud + Cloudflare DNS:
- Hetzner CCX23 (existing): $34/mo
- Cloudflare Free plan: $0
- Caddy + Let's Encrypt: $0
- **Total marginal cost per tenant: $0** until DB hits 100GB or you saturate CPU

Each tenant adds ~5-10MB to Postgres (cloned data). 100 tenants = ~1GB.
Neon Pro plan = $19/mo for 10GB. So budget $0.20/tenant/mo at scale.
