import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  projectId: z.string().optional(),
  vehiclePlate: z.string().min(2).max(20),
  driverName: z.string().min(2).max(120),
  purpose: z.string().min(2).max(300),
  startAt: z.string(),
  endAt: z.string().optional(),
  status: z.enum(["SCHEDULED","IN_USE","RETURNED","CANCELLED"]).default("SCHEDULED"),
  note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "vehicledispatch.create" }); if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const rec = await prisma.vehicleDispatch.create({
      data: {
        orgId: d.orgId, projectId: d.projectId,
        vehiclePlate: d.vehiclePlate, driverName: d.driverName, purpose: d.purpose,
        startAt: new Date(d.startAt),
        endAt: d.endAt ? new Date(d.endAt) : undefined,
        status: d.status, note: d.note,
      },
    });
    await audit({ action: "vehicledispatch.create", entityType: "VehicleDispatch", entityId: rec.id, actorId: session.userId, orgId: d.orgId, ...reqMeta(req), after: { plate: rec.vehiclePlate, purpose: rec.purpose } });
    return NextResponse.json({ dispatch: rec });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
