# Wildcard TLS options for `*.aecplatform.vn`

When I added `*.aecplatform.vn { ... }` to the Caddyfile, the cert fetch failed because:

- Let's Encrypt + ZeroSSL **require DNS-01** for wildcard certs
- The current Caddy image is `caddy:2-alpine` — **no DNS provider plugins** are baked in
- The repeated failed cert attempts caused TLS handshake errors on the main domain too
- Reverted to restore service

Below are the three real options to enable wildcards. **Option A** is the right one for production.

## Option A — Per-subdomain on_demand_tls (no plugins, no wildcards)

Caddy can fetch a separate cert per subdomain as soon as a real request arrives. No DNS plugin needed. Trade-off: cold-start latency on a brand-new subdomain (~3-5s for ACME), and Let's Encrypt rate limit caps at 50 certs/week/domain.

```caddyfile
{
    on_demand_tls {
        ask https://app.aecplatform.vn/api/tenant/allow-subdomain
    }
}

# This block replaces the wildcard one I tried
https://{host}.aecplatform.vn {
    @tenant_subdomain {
        not host aecplatform.vn www.aecplatform.vn app.aecplatform.vn status.aecplatform.vn
    }

    tls {
        on_demand
    }
    reverse_proxy web:3000 {
        header_up Host {host}
    }
}
```

You'd need to expose a tiny endpoint at `/api/tenant/allow-subdomain` that returns 200 if the slug exists in DB (prevents random strangers from triggering ACME requests for fake subdomains).

Setup:
1. Add wildcard DNS record (still required) `* A 142.132.170.171`
2. Update Caddyfile
3. Add `/api/tenant/allow-subdomain` route (5 min)
4. Reload Caddy

## Option B — Cloudflare DNS-01 (best for production, scales infinitely)

Requires:
- DNS at Cloudflare (yours is currently at `ns1/ns2.matbao.vn` — Mat Bão)
- Either move DNS to Cloudflare, OR have Mat Bão API access (Mat Bão has a less-documented API)
- Caddy image with `caddy-dns/cloudflare` plugin baked in

```dockerfile
FROM caddy:2-builder-alpine AS builder
RUN xcaddy build --with github.com/caddy-dns/cloudflare
FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
```

```caddyfile
*.aecplatform.vn {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    reverse_proxy web:3000 {
        header_up Host {host}
    }
}
```

The `CF_API_TOKEN` env var is already set, but I haven't verified it has DNS edit permission for `aecplatform.vn`. The token might be for a different purpose (Cloudflare Workers AI). If you confirm DNS access is included in the token's scope AND DNS is at Cloudflare, this is the cleanest setup.

## Option C — Move DNS to Cloudflare + use HTTP-01 (simplest)

If you move DNS from Mat Bão → Cloudflare:
1. Sign up Cloudflare free plan
2. Add `aecplatform.vn` zone
3. Update nameservers at registrar from `ns1.matbao.vn` → Cloudflare's NS
4. Wait 1-24h for propagation
5. Add wildcard A record `* → 142.132.170.171` (DNS only, NOT proxied — proxied wildcards need Pro plan)
6. Caddy's existing config will work with HTTP-01 once DNS resolves

After step 5: each new tenant subdomain triggers an on-demand cert fetch on first visit (~3-5s) then cached. No additional code changes.

## Recommendation

**Option A** is the right path right now because:
- Wildcards aren't actually needed — we issue one cert per active tenant slug
- 50 certs/week is plenty for an early-stage pilot
- Zero DNS migration risk
- Works with current Mat Bão DNS

To do Option A I still need:
1. **DNS wildcard A record** (`*.aecplatform.vn → 142.132.170.171`) at Mat Bão — 1 minute, pure click
2. **One new API route** I can build and deploy in 5 min: `GET /api/tenant/allow-subdomain?domain=<slug>.aecplatform.vn` returns 200 if a tenant with that slug exists
3. **Updated Caddyfile** with on_demand_tls block

Total: ~10 minutes work after you add the DNS record.

## Current state (post-revert)

- Main domains `aecplatform.vn`, `app.aecplatform.vn`, `status.aecplatform.vn` — all working ✅
- Wildcard `*.aecplatform.vn` block — removed from Caddyfile ✅
- All multi-tenant code (middleware, banner, API, CRM) — still deployed and working
- Tenant provisioning at `/api/tenant/provision` — still works (15s)
- Banner test tenant `banner-test-1780757751` — still in DB, ACTIVE

The single piece blocking real end-to-end usage = DNS wildcard record. Pick A / B / C and I'll do the code side.
