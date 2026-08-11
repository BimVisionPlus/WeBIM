import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@atlas/db";
import { hashPassword } from "./password";

const RESET_TTL_MS = 30 * 60 * 1000;

function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export async function issuePasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null; // do not leak existence
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  return token;
}

export async function consumePasswordReset(token: string, newPassword: string) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return false;

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash, failedLogins: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  return true;
}
