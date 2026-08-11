/**
 * Edge middleware: HTTPS enforcement + security headers + tenant subdomain.
 *
 * Tenant subdomain resolution (module D):
 *   - host = aecplatform.vn / app.aecplatform.vn → main, no tenant
 *   - host = <slug>.aecplatform.vn → set x-tenant-slug header for downstream
 *
 * NOTE: NextAuth runs at the route handler layer, not edge. Per-route rate
 * limiting happens inside each route handler.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const MAIN_HOSTS = new Set([
  "aecplatform.vn",
  "www.aecplatform.vn",
  "app.aecplatform.vn",
  "localhost:3170",
  "localhost:3000",
  "127.0.0.1:3170",
]);

// Paths only allowed on the main domain — block on tenant subdomains.
const MAIN_ONLY_PATHS = ["/admin/tenants", "/admin/system"];

function extractTenantSlug(host: string): string | null {
  if (MAIN_HOSTS.has(host)) return null;
  const hostNoPort = host.split(":")[0]!;
  if (!hostNoPort.endsWith(".aecplatform.vn")) return null;
  const slug = hostNoPort.slice(0, -".aecplatform.vn".length);
  if (!slug || slug === "www" || slug === "app") return null;
  // Valid DNS label: lowercase alphanumeric + hyphen, 2-40 chars
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return null;
  return slug;
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const slug = extractTenantSlug(host);

  // Build request headers — server components read these via next/headers().
  const requestHeaders = new Headers(req.headers);
  if (slug) {
    requestHeaders.set("x-tenant-slug", slug);

    // Block main-only paths on tenant subdomains
    if (MAIN_ONLY_PATHS.some((p) => req.nextUrl.pathname.startsWith(p))) {
      const main = req.nextUrl.clone();
      main.host = "app.aecplatform.vn";
      return NextResponse.redirect(main, 302);
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // Security headers (on response)
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
  if (slug) res.headers.set("x-tenant-slug", slug);

  // Force HTTPS in prod
  if (process.env.NODE_ENV === "production") {
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("0.0.0.0") ||
      host.startsWith("[::1]");
    if (!isLocal) {
      const proto = req.headers.get("x-forwarded-proto");
      if (proto && proto !== "https") {
        const url = req.nextUrl.clone();
        url.protocol = "https:";
        return NextResponse.redirect(url, 301);
      }
      res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Skip Next internals, static, and APS viewer assets.
    "/((?!_next/static|_next/image|favicon.ico|api/health).*)",
  ],
};
