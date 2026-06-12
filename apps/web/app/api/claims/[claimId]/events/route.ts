import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta } from "@atlas/lib";

const Body = z.object({
  occurredAt: z.string(), // ISO date
  kind: z
    .enum([
      "DELAY_START",
      "DELAY_END",
      "INSTRUCTION",
      "NOTICE",
      "RESPONSE",
      "SITE_CONDITION",
      "PAYMENT",
      "MEETING",
      "OTHER",
    ])
    .default("OTHER"),
  title: z.string().min(2).max(200),
  detail: z.string().max(5_000).optional(),
  sourceTable: z.string().max(40).optional(),
  sourceId: z.string().max(40).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const session = await requireSession();
    const claim = await prisma.claim.findUnique({ where: { id: params.claimId } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(claim.projectId);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;

    const event = await prisma.claimEvent.create({
      data: {
        claimId: claim.id,
        occurredAt: new Date(d.occurredAt),
        kind: d.kind,
        title: d.title,
        detail: d.detail,
        sourceTable: d.sourceTable,
        sourceId: d.sourceId,
        createdById: session.userId,
      },
    });

    await audit({
      action: "claim.event.add",
      entityType: "ClaimEvent",
      entityId: event.id,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
      after: { claimKey: claim.key, title: d.title, occurredAt: d.occurredAt },
    });

    return NextResponse.json({ ok: true, event: { id: event.id } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

    const claim = await prisma.claim.findUnique({ where: { id: params.claimId } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(claim.projectId);

    await prisma.claimEvent.delete({ where: { id: eventId, claimId: claim.id } });

    await audit({
      action: "claim.event.delete",
      entityType: "ClaimEvent",
      entityId: eventId,
      actorId: session.userId,
      projectId: claim.projectId,
      ...reqMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
