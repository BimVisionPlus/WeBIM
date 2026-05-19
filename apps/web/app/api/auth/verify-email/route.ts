/**
 * GET /api/auth/verify-email?token=…&email=… — consume a verification token.
 *
 * Idempotent: a second click after success simply redirects to /signin.
 * Tokens are SHA-256 hashed in storage; we hash the inbound token to match.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@atlas/db";
import { audit, reqMeta, rateLimit, clientKey } from "@atlas/lib";

export async function GET(req: NextRequest) {
  const rl = await rateLimit({ key: `verify-email:${clientKey(req)}`, max: 20, windowSec: 600 });
  if (!rl.allowed) return NextResponse.json({ error: "Quá nhiều yêu cầu" }, { status: 429 });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const email = url.searchParams.get("email")?.toLowerCase();
  if (!token || !email) return NextResponse.json({ error: "missing token/email" }, { status: 400 });

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const row = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: tokenHash } },
  });
  if (!row) return NextResponse.json({ error: "Token không hợp lệ hoặc đã sử dụng" }, { status: 400 });
  if (row.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { identifier_token: { identifier: email, token: tokenHash } } });
    return NextResponse.json({ error: "Token đã hết hạn" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({ where: { email }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({ where: { identifier_token: { identifier: email, token: tokenHash } } }),
  ]);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  await audit({
    action: "auth.email_verified",
    entityType: "User",
    entityId: user?.id ?? null,
    ...reqMeta(req),
  });

  return NextResponse.json({ ok: true, verified: true });
}
