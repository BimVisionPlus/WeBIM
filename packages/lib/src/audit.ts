/**
 * Audit log writer.
 *
 * Always best-effort: a failed audit insert must NOT break the user action.
 * Compliance posture for NĐ 06/2021 (who changed what, when) — but a missing
 * audit row is recoverable; a 500 in the user flow is not.
 */

import { prisma } from "@atlas/db";
import { logger } from "./log";

type AuditArgs = {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  orgId?: string | null;
  projectId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function audit(args: AuditArgs) {
  try {
    await prisma.auditEvent.create({
      data: {
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId ?? null,
        actorId: args.actorId ?? null,
        orgId: args.orgId ?? null,
        projectId: args.projectId ?? null,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
        before: (args.before as any) ?? undefined,
        after: (args.after as any) ?? undefined,
      },
    });
  } catch (err) {
    logger().error({ err, args }, "audit.write_failed");
  }
}

/** Extract IP + UA from a Next.js NextRequest (or any Request-like). */
export function reqMeta(req: Request | undefined | null): { ip?: string; userAgent?: string } {
  if (!req) return {};
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined;
  return { ip, userAgent: h.get("user-agent") ?? undefined };
}
