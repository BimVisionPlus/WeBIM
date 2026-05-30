import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  territoryId: z.string().optional(),
  name: z.string().min(2).max(300),
  clientName: z.string().max(200).optional(),
  province: z.string().max(80).optional(),
  estValueVnd: z.coerce.bigint().optional(),
  source: z.string().max(120).optional(),
  status: z.enum(["POTENTIAL","TRACKING","WON","LOST","ARCHIVED"]).default("POTENTIAL"),
  nextActionAt: z.string().optional(),
  note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "leads.create" }); if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const rec = await prisma.projectLead.create({
      data: {
        orgId: d.orgId, territoryId: d.territoryId, name: d.name, clientName: d.clientName,
        province: d.province, estValueVnd: d.estValueVnd, source: d.source, status: d.status,
        nextActionAt: d.nextActionAt ? new Date(d.nextActionAt) : undefined,
        note: d.note,
      },
    });
    await audit({ action: "lead.create", entityType: "ProjectLead", entityId: rec.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { name: rec.name, status: rec.status } });
    return NextResponse.json({ lead: { ...rec, estValueVnd: rec.estValueVnd?.toString() ?? null } });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
