import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  projectId: z.string(),
  title: z.string().min(2).max(200),
  description: z.string().max(10_000).optional(),
  type: z
    .enum(["EOT", "COST", "PRICE_ESCALATION", "PAYMENT_DELAY", "DEFECT", "OTHER"])
    .default("EOT"),
  direction: z
    .enum(["CONTRACTOR_TO_OWNER", "OWNER_TO_CONTRACTOR", "TO_CONSULTANT"])
    .default("CONTRACTOR_TO_OWNER"),
  counterparty: z.string().max(200).optional(),
  contractRef: z.string().max(200).optional(),
  amountVnd: z.string().regex(/^\d+$/).optional(), // BigInt as string
  eotDays: z.number().int().min(0).max(3650).optional(),
  periodStart: z.string().optional(), // ISO date
  periodEnd: z.string().optional(),
  noticeDeadlineAt: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const claims = await prisma.claim.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        _count: { select: { events: true, evidence: true, legalBases: true } },
      },
    });
    return NextResponse.json({
      claims: claims.map((c) => ({ ...c, amountVnd: c.amountVnd?.toString() ?? null })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  const __rl = await rateLimitGuard(req, { name: "claims" });
  if (__rl) return __rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const data = parsed.data;
    await requireProject(data.projectId);

    const claim = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: data.projectId },
        select: { key: true },
      });
      if (!project) throw new Error("Project not found");
      const prefix = `${project.key}-CLM-`;
      const last = await tx.claim.findFirst({
        where: { projectId: data.projectId, key: { startsWith: prefix } },
        orderBy: { key: "desc" },
        select: { key: true },
      });
      let n = 1;
      if (last) {
        const parsedN = parseInt(last.key.slice(prefix.length), 10);
        if (!isNaN(parsedN)) n = parsedN + 1;
      }
      return tx.claim.create({
        data: {
          projectId: data.projectId,
          key: `${prefix}${String(n).padStart(3, "0")}`,
          title: data.title,
          description: data.description,
          type: data.type,
          direction: data.direction,
          counterparty: data.counterparty,
          contractRef: data.contractRef,
          amountVnd: data.amountVnd ? BigInt(data.amountVnd) : undefined,
          eotDays: data.eotDays,
          periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
          periodEnd: data.periodEnd ? new Date(data.periodEnd) : undefined,
          noticeDeadlineAt: data.noticeDeadlineAt ? new Date(data.noticeDeadlineAt) : undefined,
          createdById: session.userId,
        },
      });
    });

    await audit({
      action: "claim.create",
      entityType: "Claim",
      entityId: claim.id,
      actorId: session.userId,
      projectId: data.projectId,
      ...reqMeta(req),
      after: { key: claim.key, title: claim.title, type: claim.type },
    });

    return NextResponse.json({ ok: true, claim: { id: claim.id, key: claim.key } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
