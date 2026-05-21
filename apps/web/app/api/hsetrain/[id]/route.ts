// PATCH /api/hsetrain/[id] — Revoke certificate.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({ action: z.enum(["REVOKE"]), note: z.string().max(500).optional() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "hsetrain.update" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const cert = await prisma.hseCertificate.findUnique({ where: { id: params.id } });
    if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (cert.state !== "ACTIVE") return NextResponse.json({ error: `Chứng chỉ đã ${cert.state}` }, { status: 422 });
    await prisma.hseCertificate.update({ where: { id: params.id }, data: { state: "REVOKED" } });
    await audit({ action: "hsetrain.revoke", entityType: "HseCertificate", entityId: params.id, actorId: session.userId, ...reqMeta(req), after: { state: "REVOKED", note: parsed.data.note ?? null } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
