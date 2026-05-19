// SpecPage detail + update. Re-embeds on body change.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";
import { specAi, aiConfig } from "@atlas/ai";

const PatchBody = z.object({
  title: z.string().min(2).max(200).optional(),
  body: z.string().min(2).max(60_000).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const page = await prisma.specPage.findUnique({ where: { id: params.id } });
    if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });
    await requireProject(page.projectId);
    return NextResponse.json({
      page: {
        id: page.id, slug: page.slug, title: page.title, body: page.body,
        updatedAt: page.updatedAt, embeddedAt: page.embeddedAt, embedModel: page.embedModel,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  
  const __rl = await rateLimitGuard(req, { name: "specs.id" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const existing = await prisma.specPage.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    await requireProject(existing.projectId);

    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const updated = await prisma.specPage.update({
      where: { id: params.id },
      data: { title: parsed.data.title, body: parsed.data.body },
    });

    await audit({
      action: "spec.update",
      entityType: "SpecPage",
      entityId: updated.id,
      actorId: session.userId,
      projectId: existing.projectId,
      ...reqMeta(req),
      after: { title: updated.title },
    });

    const bodyChanged = parsed.data.body && parsed.data.body !== existing.body;
    if (bodyChanged && aiConfig().enabled) {
      void embedAndStore(updated.id, `${updated.title}\n\n${updated.body}`);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

async function embedAndStore(pageId: string, text: string) {
  const r = await specAi.embedSpecText(text);
  if (!r.ok) return;
  await prisma.specPage.update({
    where: { id: pageId },
    data: { embedding: r.data as any, embeddedAt: new Date(), embedModel: r.model },
  }).catch(() => {});
}
