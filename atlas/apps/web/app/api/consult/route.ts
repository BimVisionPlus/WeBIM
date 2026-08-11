// POST /api/consult — Create a timesheet entry.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  projectId: z.string().optional(),
  workerName: z.string().min(2).max(120),
  role: z.string().min(2).max(120),
  workDate: z.string(),
  hours: z.string().regex(/^\d+(\.\d+)?$/),
  description: z.string().min(2).max(2000),
  rateVndPerHour: z.string().regex(/^\d+$/).optional(),
  billable: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "consult.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const membership = await prisma.membership.findFirst({ where: { userId: session.userId, orgId: d.orgId } });
    if (!membership) return NextResponse.json({ error: "Bạn không thuộc tổ chức này" }, { status: 403 });
    const hours = d.hours as unknown as never;
    const rate = d.rateVndPerHour ? BigInt(d.rateVndPerHour) : null;
    const amount = rate ? BigInt(Math.round(Number(d.hours) * Number(rate))) : null;
    const t = await prisma.consultantTimesheet.create({
      data: {
        orgId: d.orgId, projectId: d.projectId ?? null, userId: session.userId,
        workerName: d.workerName, role: d.role,
        workDate: new Date(d.workDate), hours,
        description: d.description, billable: d.billable,
        rateVndPerHour: rate, amountVnd: amount,
      },
    });
    await audit({ action: "consult.create", entityType: "ConsultantTimesheet", entityId: t.id, actorId: session.userId, ...reqMeta(req), after: { workDate: d.workDate, hours: d.hours } });
    return NextResponse.json({ ok: true, id: t.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
