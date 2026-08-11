// POST /api/stakeholders/document — Log a new incoming/outgoing letter.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  agencyId: z.string(),
  projectId: z.string().optional(),
  direction: z.enum(["INCOMING", "OUTGOING"]),
  docNo: z.string().min(2).max(64),
  docDate: z.string(),
  subject: z.string().min(2).max(500),
  category: z.string().max(80).optional(),
  dueAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimitGuard(req, { name: "stakeholders.doc" });
  if (rl) return rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const doc = await prisma.agencyDocument.create({
      data: {
        agencyId: d.agencyId, projectId: d.projectId ?? null,
        direction: d.direction, docNo: d.docNo,
        docDate: new Date(d.docDate), subject: d.subject,
        category: d.category ?? null,
        dueAt: d.dueAt ? new Date(d.dueAt) : null,
        status: d.direction === "INCOMING" ? "Đang xử lý" : "Đã gửi",
      },
    });
    await audit({ action: "stakeholders.doc.create", entityType: "AgencyDocument", entityId: doc.id, actorId: session.userId, ...reqMeta(req), after: { docNo: d.docNo, direction: d.direction } });
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json({ error: e.message ?? "Internal" }, { status: e.status ?? 500 });
  }
}
