import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { presignUpload, projectKey, validateUpload, audit, reqMeta, rateLimitGuard } from "@atlas/lib";
import { prisma } from "@atlas/db";
import { requireProject, requireSession } from "@atlas/auth";

const Body = z.object({
  projectId: z.string(),
  kind: z.enum(["models", "drawings", "attachments", "markups"]),
  filename: z.string().max(255),
  contentType: z.string().max(120),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "upload" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { projectId, kind, filename, contentType, sizeBytes } = parsed.data;
    await requireProject(projectId);

    const check = validateUpload({ kind, filename, contentType, sizeBytes });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { key: true } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const key = projectKey(project.key, kind, filename);
    const uploadUrl = await presignUpload(kind, key, contentType);

    await audit({
      action: "upload.presigned",
      entityType: "Upload",
      actorId: session.userId,
      projectId,
      ...reqMeta(req),
      after: { kind, key, filename, sizeBytes },
    });

    return NextResponse.json({ uploadUrl, key, bucket: kind });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
