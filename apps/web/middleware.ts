/**
 * Edge middleware: enforce HTTPS in prod + add security headers.
 *
 * NOTE: NextAuth runs at the route handler layer, not edge. Per-route rate
 * limiting happens inside each route handler — putting it in middleware would
 * require Redis access from the edge runtime, which complicates Docker self-host.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Security headers (in addition to next.config headers — belt + braces).
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");

  // Force HTTPS in prod — but only for real public hosts. Localhost and
  // private/loopback ranges are never reachable from the internet, so
  // redirecting them to https just breaks `next start` smoke tests in CI
  // (which run NODE_ENV=production on http://localhost:3000 and otherwise
  // get a 301 chain on every request, breaking NextAuth's csrf bootstrap).
  if (process.env.NODE_ENV === "production") {
    const host = req.headers.get("host") ?? "";
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
