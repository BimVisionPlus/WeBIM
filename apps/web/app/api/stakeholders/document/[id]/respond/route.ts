// POST /api/stakeholders/document/[id]/respond — Mark a document as responded.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({ note: z.string().max(2000).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = await rateLimitGuard(req, { name: "stakeholders.doc.respond" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const doc = await prisma.agencyDocument.findUnique({ where: { id: params.id } });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.agencyDocument.update({
      where: { id: params.id },
      data: { respondedAt: new Date(), status: "Đã trả lời", body: parsed.data.note ?? doc.body },
    });
    await audit({ action: "stakeholders.doc.respond", entityType: "AgencyDocument", entityId: params.id, actorId: session.userId, ...reqMeta(req), after: { docNo: doc.docNo } });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
