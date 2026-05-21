// POST /api/tenderforge — Create TenderPackage (HSMT bên mời / HSDT nhà thầu).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  orgId: z.string(),
  code: z.string().min(3).max(64),
  perspective: z.enum(["BEN_MOI", "NHA_THAU"]),
  title: z.string().min(2).max(300),
  packageType: z.string().min(2).max(60),
  selectionMethod: z.string().min(2).max(120),
  estimatedValueVnd: z.string().regex(/^\d+$/).optional(),
  bidSecurityVnd: z.string().regex(/^\d+$/).optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "tenderforge.create" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    // Verify session user belongs to orgId
    const membership = await prisma.membership.findFirst({ where: { userId: session.userId, orgId: d.orgId } });
    if (!membership) return NextResponse.json({ error: "Bạn không thuộc tổ chức này" }, { status: 403 });
    const pkg = await prisma.tenderPackage.create({
      data: {
        orgId: d.orgId, code: d.code, perspective: d.perspective, title: d.title,
        packageType: d.packageType, selectionMethod: d.selectionMethod,
        estimatedValueVnd: d.estimatedValueVnd ? BigInt(d.estimatedValueVnd) : null,
        bidSecurityVnd: d.bidSecurityVnd ? BigInt(d.bidSecurityVnd) : null,
        state: "DRAFT",
      },
    });
    await audit({ action: "tenderforge.create", entityType: "TenderPackage", entityId: pkg.id, actorId: session.userId, ...reqMeta(req), after: { code: d.code, perspective: d.perspective } });
    return NextResponse.json({ ok: true, id: pkg.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
