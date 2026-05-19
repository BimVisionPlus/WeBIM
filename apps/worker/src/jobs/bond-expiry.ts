/**
 * Surface bonds expiring in the next 30 days so the WinWork dashboard's
 * "expiringBonds" card is fresh. Auto-flip ACTIVE → EXPIRED for past-due bonds.
 */

import { prisma } from "@atlas/db";

export async function warnExpiringBonds() {
  const now = new Date();
  // Auto-expire past-due
  const expired = await prisma.bidBond.updateMany({
    where: { status: "ACTIVE", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  const soonCount = await prisma.bidBond.count({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: new Date(now.getTime() + 30 * 86_400_000) },
    },
  });
  return { ok: true, note: `auto-expired=${expired.count} expiring30d=${soonCount}` };
}
