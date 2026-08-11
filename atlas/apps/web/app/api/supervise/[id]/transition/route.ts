// POST /api/supervise/[id]/transition — TVGS → NT → CDT sign chain.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  action: z.enum(["TVGS_SIGN", "NT_SIGN", "CDT_SIGN", "FINALIZE"]),
  certSerial: z.string().max(64).optional(),
});

const NEXT: Record<string, string> = { TVGS_SIGN: "TVGS_SIGNED", NT_SIGN: "NT_SIGNED", CDT_SIGN: "CDT_SIGNED", FINALIZE: "FINALIZED" };
const FROM: Record<string, string[]> = { TVGS_SIGN: ["DRAFT"], NT_SIGN: ["TVGS_SIGNED"], CDT_SIGN: ["NT_SIGNED"], FINALIZE: ["CDT_SIGNED"] };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "supervise.transition" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const entry = await prisma.superviseEntry.findUnique({ where: { id: params.id } });
    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(entry.projectId);
    const allowed = FROM[parsed.data.action] ?? [];
    if (!allowed.includes(entry.state)) return NextResponse.json({ error: `Không thể ${parsed.data.action} từ ${entry.state}` }, { status: 422 });
    const now = new Date();
    const update: Record<string, unknown> = { state: NEXT[parsed.data.action] };
    const cert = parsed.data.certSerial ?? `MOCK-CA-${Date.now()}`;
    if (parsed.data.action === "TVGS_SIGN") { update.tvgsSignedAt = now; update.tvgsCertSerial = cert; }
    if (parsed.data.action === "NT_SIGN") { update.ntSignedAt = now; update.ntCertSerial = cert; }
    if (parsed.data.action === "CDT_SIGN") { update.cdtSignedAt = now; update.cdtCertSerial = cert; }
    await prisma.superviseEntry.update({ where: { id: params.id }, data: update });
    await audit({ action: `supervise.${parsed.data.action.toLowerCase()}`, entityType: "SuperviseEntry", entityId: params.id, actorId: session.userId, projectId: entry.projectId, ...reqMeta(req), after: { state: NEXT[parsed.data.action] } });
    return NextResponse.json({ ok: true, state: NEXT[parsed.data.action] });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
