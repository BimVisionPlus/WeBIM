// SpecPage list + create. Embedding is refreshed fire-and-forget on create/update
// so the Specs RAG search has fresh vectors without blocking the user.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";
import { specAi, aiConfig } from "@atlas/ai";

const Body = z.object({
  projectId: z.string(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "slug chỉ chứa a-z, 0-9, -"),
  title: z.string().min(2).max(200),
  body: z.string().min(2).max(60_000),
  parentId: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const pages = await prisma.specPage.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, slug: true, title: true, updatedAt: true, parentId: true,
        embeddedAt: true, embedModel: true,
      },
    });
    return NextResponse.json({ pages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "specs" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const page = await prisma.specPage.create({
      data: {
        projectId: data.projectId,
        slug: data.slug,
        title: data.title,
        body: data.body,
        parentId: data.parentId,
        authorId: session.userId,
      },
    });

    await audit({
      action: "spec.create",
      entityType: "SpecPage",
      entityId: page.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { slug: page.slug, title: page.title },
    });

    // Fire-and-forget embed refresh.
    if (aiConfig().enabled) void embedAndStore(page.id, `${page.title}\n\n${page.body}`);

    return NextResponse.json({ ok: true, page: { id: page.id, slug: page.slug } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

async function embedAndStore(pageId: string, text: string) {
  const r = await specAi.embedSpecText(text);
  if (!r.ok) return;
  await prisma.specPage.update({
    where: { id: pageId },
    data: {
      embedding: r.data as any,
      embeddedAt: new Date(),
      embedModel: r.model,
    },
  }).catch(() => {});
}
