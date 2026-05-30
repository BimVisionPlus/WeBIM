/**
 * PATCH /api/projects/:id — update mutable project fields (currently: department).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  department: z
    .enum(["CONG_VIEC", "DAU_THAU", "HANH_CHINH", "TAI_CHINH_KE_TOAN", "PHAT_TRIEN_THI_TRUONG", "CONG_VIEC_KHAC"])
    .optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rl = await rateLimitGuard(req, { name: "projects.patch" });
  if (rl) return rl;
  try {
    const params = await ctx.params;
    const { session } = await requireProject(params.id);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    if (!d.department) return NextResponse.json({ error: "Không có trường nào để cập nhật" }, { status: 400 });

    const before = await prisma.project.findUnique({ where: { id: params.id }, select: { department: true } });
    if (!before) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: { department: d.department },
      select: { id: true, department: true },
    });

    await audit({
      action: "project.update.department",
      entityType: "Project",
      entityId: params.id,
      actorId: session.userId,
      projectId: params.id,
      ...reqMeta(req),
      before: { department: before.department },
      after: { department: updated.department },
    });

    return NextResponse.json({ project: updated });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
