import { createHash, randomBytes } from "node:crypto";
import type { MemberRole } from "@atlas/db";
import { prisma } from "@atlas/db";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return randomBytes(32).toString("base64url");
}

export async function createInvite(args: {
  email: string;
  orgId: string;
  projectId?: string;
  role: MemberRole;
  invitedById: string;
}) {
  const token = generateToken();
  const invite = await prisma.invite.create({
    data: {
      email: args.email.toLowerCase(),
      orgId: args.orgId,
      projectId: args.projectId,
      role: args.role,
      invitedById: args.invitedById,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  return { invite, token };
}

export async function findValidInvite(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { org: true, invitedBy: { select: { name: true, email: true } } },
  });
  if (!invite) return null;
  if (invite.revokedAt) return null;
  if (invite.acceptedAt) return null;
  if (invite.expiresAt < new Date()) return null;
  return invite;
}

export function buildInviteLink(token: string, baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;
}
