/**
 * GET  /api/costpulse/boq?projectId=...   — current BoQ + lines
 * POST /api/costpulse/boq                  — create/replace BoQ for a project
 *                                            body: { projectId, name, contractValueVnd, lines: [...] }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject, AuthError } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const LineSchema = z.object({
  code: z.string().min(1).max(40),
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(20),
  qty: z.number().nonnegative(),
  unitPriceVnd: z.coerce.bigint(),
  category: z.string().max(80).optional(),
  costCode: z.string().max(40).optional(),
});

const Body = z.object({
  projectId: z.string(),
  name: z.string().min(2).max(200),
  contractValueVnd: z.coerce.bigint(),
  lines: z.array(LineSchema).min(1).max(5000),
});

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
    await requireProject(projectId);

    const boq = await prisma.boQ.findFirst({
      where: { projectId, isCurrent: true },
      include: { lines: { orderBy: { code: "asc" } } },
    });
    if (!boq) return NextResponse.json({ boq: null });
    return NextResponse.json({
      boq: {
        ...boq,
        contractValueVnd: boq.contractValueVnd.toString(),
        lines: boq.lines.map((l) => ({
          ...l,
          unitPriceVnd: l.unitPriceVnd.toString(),
          totalVnd: l.totalVnd.toString(),
        })),
      },
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  
  const __rl = await rateLimitGuard(req, { name: "costpulse.boq" });
  if (__rl) return __rl;
try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    await requireProject(d.projectId);

    const created = await prisma.$transaction(async (tx) => {
      await tx.boQ.updateMany({ where: { projectId: d.projectId, isCurrent: true }, data: { isCurrent: false } });
      const boq = await tx.boQ.create({
        data: {
          projectId: d.projectId,
          name: d.name,
          contractValueVnd: d.contractValueVnd,
          isCurrent: true,
        },
      });
      await tx.boQLine.createMany({
        data: d.lines.map((l) => ({
          boqId: boq.id,
          code: l.code,
          description: l.description,
          unit: l.unit,
          qty: l.qty,
          unitPriceVnd: l.unitPriceVnd,
          totalVnd: BigInt(Math.round(l.qty * 1000)) * l.unitPriceVnd / 1000n,
          category: l.category,
          costCode: l.costCode,
        })),
      });
      return boq;
    });

    await audit({
      action: "costpulse.boq.create",
      entityType: "BoQ",
      entityId: created.id,
      actorId: session.userId,
      projectId: d.projectId,
      ...reqMeta(req),
      after: { lines: d.lines.length, contractValueVnd: d.contractValueVnd.toString() },
    });

    return NextResponse.json({ boqId: created.id, lines: d.lines.length });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
