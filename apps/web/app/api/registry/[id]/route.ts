// PATCH /api/registry/[id] — Blacklist / Unblacklist / Update rating.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["BLACKLIST", "UNBLACKLIST", "UPDATE_RATING"]),
  reason: z.string().max(2000).optional(),
  rating: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "registry.update" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const profile = await prisma.contractorProfile.findUnique({ where: { id: params.id } });
    if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const update: Record<string, unknown> = {};
    if (parsed.data.action === "BLACKLIST") {
      if (profile.blacklisted) return NextResponse.json({ error: "Đã blacklist" }, { status: 422 });
      update.blacklisted = true;
      update.blacklistReason = parsed.data.reason ?? "Không rõ";
      update.blacklistAt = new Date();
    }
    if (parsed.data.action === "UNBLACKLIST") {
      update.blacklisted = false;
      update.blacklistReason = null;
      update.blacklistAt = null;
    }
    if (parsed.data.action === "UPDATE_RATING") {
      if (!parsed.data.rating) return NextResponse.json({ error: "Phải có rating" }, { status: 400 });
      const r = Number(parsed.data.rating);
      if (r < 0 || r > 5) return NextResponse.json({ error: "Rating phải 0-5" }, { status: 400 });
      update.rating = parsed.data.rating as unknown as never;
    }
    await prisma.contractorProfile.update({ where: { id: params.id }, data: update });
    await audit({ action: `registry.${parsed.data.action.toLowerCase()}`, entityType: "ContractorProfile", entityId: params.id, actorId: session.userId, ...reqMeta(req), after: update });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
