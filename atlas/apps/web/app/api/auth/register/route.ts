import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@atlas/db";
import { hashPassword, validatePasswordStrength } from "@atlas/auth";
import { audit, reqMeta, rateLimit, clientKey, logger, sendEmail, tplVerifyEmail } from "@atlas/lib";

const Body = z.object({
  email: z.string().email().max(200),
  name: z.string().min(2).max(120),
  password: z.string(),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const rl = await rateLimit({ key: `register:${clientKey(req)}`, max: 5, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() }, { status: 400 });
  }
  const { email, name, password, phone } = parsed.data;

  const strength = validatePasswordStrength(password);
  if (!strength.ok) return NextResponse.json({ error: strength.error }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email đã được đăng ký" }, { status: 409 });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, phone, passwordHash },
    select: { id: true, email: true, name: true },
  });

  // Issue an email-verification token. The user can sign in but `requireVerified()`
  // server helper gates everything past /verify-email until they click the link.
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
  await prisma.verificationToken.create({
    data: { identifier: user.email, token: tokenHash, expires },
  });

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const link = `${base}/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;
  const tpl = tplVerifyEmail({ name: user.name, link });
  void sendEmail({ to: user.email, ...tpl });

  const meta = reqMeta(req);
  await audit({
    action: "auth.register",
    entityType: "User",
    entityId: user.id,
    actorId: user.id,
    ...meta,
  });

  logger().info({ userId: user.id }, "auth.register");
  return NextResponse.json({ ok: true, user, needsVerification: true });
}
