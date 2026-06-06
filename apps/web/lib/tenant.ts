/**
 * Tenant context resolution helpers (module D — Sandbox per customer).
 *
 * Reads `x-tenant-slug` header set by edge middleware, looks up the
 * Organization by slug, returns context object.
 *
 * Server-side only (uses `next/headers`).
 */
import { headers } from "next/headers";
import { prisma } from "@atlas/db";

export type TenantContext = {
  slug: string | null;
  org: { id: string; name: string; slug: string; isTenantDemo: boolean; tenantStatus: string | null; tenantExpiresAt: Date | null; prospectName: string | null; prospectCompany: string | null } | null;
  expired: boolean;
};

/**
 * Read the current tenant context. Returns null org for the main domain.
 *
 * Call from server components or route handlers.
 */
export async function getTenantContext(): Promise<TenantContext> {
  const h = await headers();
  const slug = h.get("x-tenant-slug");
  if (!slug) return { slug: null, org: null, expired: false };

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true, name: true, slug: true,
      isTenantDemo: true, tenantStatus: true, tenantExpiresAt: true,
      prospectName: true, prospectCompany: true,
    },
  });
  if (!org) return { slug, org: null, expired: false };

  const expired = org.isTenantDemo && org.tenantExpiresAt
    ? Date.now() > org.tenantExpiresAt.getTime()
    : false;

  return { slug, org, expired };
}

/**
 * Fire-and-forget visit logger. Bumps Organization.visitCount + writes a
 * TenantVisit row. Call from a server component on initial render.
 */
export async function logTenantVisit(opts: {
  orgId: string;
  userId?: string | null;
  path: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.organization.update({
        where: { id: opts.orgId },
        data: { lastVisitedAt: new Date(), visitCount: { increment: 1 } },
      }),
      prisma.tenantVisit.create({
        data: {
          orgId: opts.orgId,
          userId: opts.userId ?? null,
          path: opts.path,
          ip: opts.ip ?? null,
          userAgent: opts.userAgent ?? null,
        },
      }),
    ]);
  } catch {
    // Visit logging is best-effort; don't block page render.
  }
}
