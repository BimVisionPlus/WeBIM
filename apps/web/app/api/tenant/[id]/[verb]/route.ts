/**
 * POST /api/tenant/[id]/[verb] — admin tenant lifecycle actions.
 *
 * verb ∈ { extend | archive | convert | expire }
 *
 * Auth: requireSession + isSuperAdmin.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const VALID_VERBS = new Set(["extend", "archive", "convert", "expire"]);

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: { id: string; verb: string } | Promise<{ id: string; verb: string }> }) {
  const rl = await rateLimitGuard(req, { name: "tenant.lifecycle" }); if (rl) return rl;
  try {
    const { id, verb } = await ctx.params;
    if (!VALID_VERBS.has(verb)) return NextResponse.json({ error: "Verb không hợp lệ" }, { status: 400 });

    const session = await requireSession();
    if (!session.isSuperAdmin) return NextResponse.json({ error: "Cần quyền super-admin" }, { status: 403 });

    const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, slug: true, isTenantDemo: true, tenantStatus: true, tenantExpiresAt: true } });
    if (!org || !org.isTenantDemo) return NextResponse.json({ error: "Không tìm thấy tenant" }, { status: 404 });

    let update: any = {};
    switch (verb) {
      case "extend": {
        const newExpires = new Date((org.tenantExpiresAt ?? new Date()).getTime() + 7 * 86_400_000);
        update = { tenantExpiresAt: newExpires, tenantStatus: "ACTIVE" };
        break;
      }
      case "expire":
        update = { tenantStatus: "EXPIRED", tenantExpiresAt: new Date() };
        break;
      case "archive":
        update = { tenantStatus: "ARCHIVED" };
        break;
      case "convert":
        update = { tenantStatus: "CONVERTED", isTenantDemo: false };
        break;
    }

    await prisma.organization.update({ where: { id }, data: update });
    await audit({
      action: `tenant.${verb}`,
      entityType: "Organization",
      entityId: id,
      actorId: session.userId,
      orgId: id,
      ...reqMeta(req),
      before: { status: org.tenantStatus, expiresAt: org.tenantExpiresAt },
      after: update,
    });

    return NextResponse.json({ ok: true, slug: org.slug, verb });
  } catch (e: any) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
