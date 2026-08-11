// POST /api/materialtrace — Create MaterialLot.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  lotCode: z.string().min(2).max(64),
  materialName: z.string().min(2).max(200),
  category: z.enum(["XI_MANG", "THEP", "KINH", "GACH", "BE_TONG_TUOI", "SON", "PHU_GIA", "OTHER"]),
  manufacturer: z.string().min(2).max(200),
  origin: z.string().max(120).optional(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/),
  unit: z.string().min(1).max(20),
  crCertNo: z.string().max(64).optional(),
  coDocUrl: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "materialtrace.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);
    const lot = await prisma.materialLot.create({
      data: {
        projectId: d.projectId, lotCode: d.lotCode, materialName: d.materialName,
        category: d.category, manufacturer: d.manufacturer, origin: d.origin ?? null,
        receivedAt: new Date(),
        quantity: d.quantity as unknown as never, unit: d.unit,
        crCertNo: d.crCertNo ?? null, coDocUrl: d.coDocUrl ?? null,
        qrCode: `https://app.aecplatform.vn/material/${d.lotCode}`,
        testRefs: [], state: "RECEIVED",
      },
    });
    await audit({ action: "materialtrace.create", entityType: "MaterialLot", entityId: lot.id, actorId: session.userId, projectId: d.projectId, ...reqMeta(req), after: { lotCode: d.lotCode } });
    return NextResponse.json({ ok: true, id: lot.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
