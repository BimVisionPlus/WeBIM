import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@atlas/db";
import { findValidInvite, requireSession, hashPassword, validatePasswordStrength } from "@atlas/auth";
import { audit, reqMeta, rateLimit, clientKey } from "@atlas/lib";

const Body = z.object({
  token: z.string().min(10),
  // If user is signing up at the same time as accepting:
  name: z.string().min(2).max(120).optional(),
  password: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `invite:${clientKey(req)}`, max: 10, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: "Quá nhiều yêu cầu" }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  const { token, name, password } = parsed.data;

  const invite = await findValidInvite(token);
  if (!invite) return NextResponse.json({ error: "Lời mời không hợp lệ hoặc đã hết hạn" }, { status: 400 });

  // Resolve user: either current session, or create-on-accept.
  let userId: string | null = null;
  try {
    const session = await requireSession();
    userId = session.userId;
  } catch {
    // Not signed in — accept-and-create path requires name + password.
    if (!name || !password) {
      return NextResponse.json({ error: "Vui lòng đăng ký với họ tên và mật khẩu" }, { status: 401 });
    }
    const strength = validatePasswordStrength(password);
    if (!strength.ok) return NextResponse.json({ error: strength.error }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email đã có tài khoản, vui lòng đăng nhập trước rồi mở lại liên kết" },
        { status: 409 },
      );
    }
    const passwordHash = await hashPassword(password);
    const u = await prisma.user.create({
      data: { email: invite.email, name, passwordHash, emailVerified: new Date() },
      select: { id: true },
    });
    userId = u.id;
  }

  if (!userId) return NextResponse.json({ error: "Không xác định được tài khoản" }, { status: 500 });

  // Create membership idempotently, then mark invite accepted.
  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_orgId: { userId, orgId: invite.orgId } },
      update: {},
      create: { userId, orgId: invite.orgId, role: invite.role },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  await audit({
    action: "invite.accepted",
    entityType: "Invite",
    entityId: invite.id,
    actorId: userId,
    orgId: invite.orgId,
    ...reqMeta(req),
  });

  return NextResponse.json({ ok: true, orgId: invite.orgId });
}
