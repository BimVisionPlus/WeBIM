import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, runApsPipeline, logger, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  name: z.string().min(2).max(200),
  discipline: z.enum([
    "KIEN_TRUC", "KET_CAU", "CO_DIEN_M", "CO_DIEN_E", "CO_DIEN_P",
    "PCCC", "CANH_QUAN", "HA_TANG", "NOI_THAT",
  ]),
  revision: z.string().min(1).max(20),
  fileKey: z.string().min(1).max(500),
  fileSizeBytes: z.number().int().nonnegative(),
  fileName: z.string().min(1).max(255),
});

function inferFormat(name: string) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "OTHER";
  switch (ext) {
    case "IFC": return "IFC";
    case "RVT": case "RFA": return "RVT";
    case "NWD": return "NWD";
    case "NWC": return "NWC";
    case "DWG": return "DWG";
    case "DXF": return "DXF";
    case "PDF": return "PDF";
    default: return "OTHER";
  }
}

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "drawings" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { projectId, name, discipline, revision, fileKey, fileSizeBytes, fileName } = parsed.data;
    await requireProject(projectId);

    const format = inferFormat(fileName) as any;

    const model = await prisma.model.create({
      data: {
        projectId,
        name,
        discipline,
        revision,
        fileUrl: fileKey,
        fileSizeBytes: BigInt(fileSizeBytes),
        format,
        apsTranslationStatus: "PENDING",
        uploadedByUserId: session.userId,
      },
    });

    await audit({
      action: "model.create",
      entityType: "Model",
      entityId: model.id,
      actorId: session.userId,
      projectId,
      ...reqMeta(req),
      after: { name, format, fileSizeBytes },
    });

    // Fire-and-forget APS pipeline. In production, replace with Redis queue.
    runApsPipeline(model.id).catch((err) => logger().error({ err, modelId: model.id }, "aps.fire_forget_err"));

    return NextResponse.json({ ok: true, modelId: model.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
