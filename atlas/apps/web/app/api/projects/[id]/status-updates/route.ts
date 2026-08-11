import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(2).max(20000),
  pctComplete: z.coerce.number().min(0).max(100).optional(),
});

export async function POST(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "project.statusupdate.create" }); if (rl) return rl;
  try {
    const params = await ctx.params;
    const { session } = await requireProject(params.id);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const upd = await prisma.projectStatusUpdate.create({
      data: { projectId: params.id, title: d.title, body: d.body, pctComplete: d.pctComplete, authorId: session.userId },
    });
    await audit({ action: "project.status.update", entityType: "ProjectStatusUpdate", entityId: upd.id, actorId: session.userId, projectId: params.id, ...reqMeta(req), after: { title: upd.title } });
    return NextResponse.json({ update: upd });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
