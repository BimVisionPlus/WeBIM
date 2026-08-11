/**
 * POST /api/daily-log/[logId]/sign
 *
 * Record a signoff on a daily log. NĐ 06/2021 Điều 10 mandates that the
 * site daily log carry signatures from both the contractor's site
 * supervisor (giám sát thi công CĐT — `signoffByCdtId`) and the consulting
 * supervisor (TVGS — `signoffByGsId`). Either can sign first; `signedAt`
 * is stamped only when BOTH parties have signed.
 *
 * Body: { role: "CDT" | "GS" }
 *
 * On a duplicate sign (same role, same user) the request is idempotent —
 * returns 200 with `noop: true`. On a duplicate sign (same role, different
 * user) it overwrites the prior signer (the most recent person to click
 * the button is the authoritative signatory).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { requireSession, requireProject } from "@atlas/auth";
import { audit, reqMeta, rateLimitGuard } from "@atlas/lib";

const Body = z.object({
  role: z.enum(["CDT", "GS"]),
});

export async function POST(req: NextRequest, { params }: { params: { logId: string } }) {
  const __rl = await rateLimitGuard(req, { name: "daily-log-sign" });
  if (__rl) return __rl;
  try {
    const session = await requireSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const log = await prisma.dailyLog.findUnique({ where: { id: params.logId } });
    if (!log) return NextResponse.json({ error: "Nhật ký không tồn tại" }, { status: 404 });
    await requireProject(log.projectId);

    const role = parsed.data.role;
    const currentSigner = role === "CDT" ? log.signoffByCdtId : log.signoffByGsId;
    if (currentSigner === session.userId) {
      return NextResponse.json({ ok: true, log, noop: true });
    }

    const update: Record<string, unknown> = {};
    if (role === "CDT") update.signoffByCdtId = session.userId;
    else update.signoffByGsId = session.userId;

    // Stamp signedAt once both sides are present.
    const willHaveCdt = role === "CDT" || !!log.signoffByCdtId;
    const willHaveGs = role === "GS" || !!log.signoffByGsId;
    if (willHaveCdt && willHaveGs && !log.signedAt) {
      update.signedAt = new Date();
    }

    const updated = await prisma.dailyLog.update({
      where: { id: log.id },
      data: update,
    });

    await audit({
      action: "daily_log.sign",
      entityType: "DailyLog",
      entityId: log.id,
      actorId: session.userId,
      projectId: log.projectId,
      ...reqMeta(req),
      after: { role, fullySigned: !!update.signedAt },
    });

    return NextResponse.json({ ok: true, log: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
