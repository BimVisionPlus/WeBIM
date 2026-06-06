/**
 * GET /api/tenant/allow-subdomain?domain=<slug>.aecplatform.vn
 *
 * Caddy on_demand_tls hits this endpoint before issuing an ACME cert
 * for a brand-new subdomain. We return 200 only if a tenant with that
 * slug exists in DB. This prevents random strangers from spamming
 * Let's Encrypt with cert requests for fake subdomains (which would
 * burn through the 50/week wildcard rate limit).
 *
 * No auth — Caddy calls this server-to-server.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";

export const dynamic = "force-dynamic";

const ALLOWED_BASE = process.env.TENANT_BASE_DOMAIN ?? "aecplatform.vn";
const STATIC_HOSTS = new Set(["www", "app", "api", "admin", "status", "mail", "blog", "marketing", "demo", "start"]);

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain") ?? "";
  if (!domain.endsWith(`.${ALLOWED_BASE}`)) return new NextResponse("nope", { status: 400 });
  const slug = domain.slice(0, -1 * (ALLOWED_BASE.length + 1));
  if (!slug || STATIC_HOSTS.has(slug)) return new NextResponse("nope", { status: 400 });
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) return new NextResponse("nope", { status: 400 });

  const exists = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, tenantStatus: true, isTenantDemo: true },
  });
  if (!exists) return new NextResponse("nope", { status: 404 });
  if (!exists.isTenantDemo) return new NextResponse("not a tenant", { status: 404 });
  if (exists.tenantStatus === "ARCHIVED") return new NextResponse("archived", { status: 404 });

  return new NextResponse("ok", { status: 200 });
}
