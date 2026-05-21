// POST /api/methods — Create MethodStatement (project instance, optionally from template).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  code: z.string().min(3).max(64),
  category: z.enum(["COC", "DAO_DAT", "BE_TONG_KHOI", "KET_CAU", "KET_CAU_THEP", "MEP", "HOAN_THIEN", "CAU_GIANG_GIO", "HAN_CO_DIEN", "KHAC"]),
  title: z.string().min(2).max(300),
  scope: z.string().min(2).max(500),
  templateId: z.string().optional(),
  body: z.string().min(10).max(50000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "methods.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    let bodyText = d.body;
    let tcvnRefs: string[] = [];
    if (d.templateId) {
      const tpl = await prisma.methodStatement.findUnique({ where: { id: d.templateId } });
      if (tpl) { bodyText = bodyText ?? tpl.body; tcvnRefs = tpl.tcvnRefs; }
    }
    const ms = await prisma.methodStatement.create({
      data: {
        projectId: d.projectId, isTemplate: false, code: d.code, category: d.category,
        title: d.title, scope: d.scope, body: bodyText ?? `# ${d.title}\n\n${d.scope}`,
        tcvnRefs, templateId: d.templateId ?? null, state: "DRAFT",
      },
    });
    await audit({ action: "methods.create", entityType: "MethodStatement", entityId: ms.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { code: d.code } });
    return NextResponse.json({ ok: true, id: ms.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
