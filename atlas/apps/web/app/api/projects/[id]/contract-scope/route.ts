import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({ contractScope: z.string().max(10000).nullable() });

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "project.contractscope.patch" }); if (rl) return rl;
  try {
    const params = await ctx.params;
    const { session } = await requireProject(params.id);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const updated = await prisma.project.update({ where: { id: params.id }, data: { contractScope: parsed.data.contractScope }, select: { id: true, contractScope: true } });
    await audit({ action: "project.update.contractScope", entityType: "Project", entityId: params.id, actorId: session.userId, projectId: params.id, ...reqMeta(req) });
    return NextResponse.json({ project: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
