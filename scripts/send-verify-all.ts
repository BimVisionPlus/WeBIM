/**
 * Send a verification email to every existing user with `emailVerified = null`.
 * Run-once admin tool — DO NOT schedule.
 *
 *   pnpm exec tsx scripts/send-verify-all.ts                  # dry-run
 *   APPLY=1 pnpm exec tsx scripts/send-verify-all.ts          # actually send
 *
 * Generates a 24h token for each user (re-using existing tokens if recent)
 * and sends the tplVerifyEmail email. Idempotent on token (unique constraint).
 */

import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@atlas/db";
import { sendEmail, tplVerifyEmail, logger } from "@atlas/lib";

const APPLY = process.env.APPLY === "1";
const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

async function main() {
  const log = logger();
  const targets = await prisma.user.findMany({
    where: { emailVerified: null },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${targets.length} unverified users.`);
  if (targets.length === 0) return;
  if (!APPLY) {
    console.log("DRY-RUN (set APPLY=1 to actually send):");
    for (const u of targets.slice(0, 20)) {
      console.log(`  • ${u.email}  (created ${u.createdAt.toISOString()})`);
    }
    if (targets.length > 20) console.log(`  … and ${targets.length - 20} more`);
    return;
  }

  let sent = 0, failed = 0;
  for (const u of targets) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      await prisma.verificationToken.create({
        data: { identifier: u.email, token: tokenHash, expires },
      });
    } catch (err) {
      log.warn({ email: u.email, err }, "token_already_exists_or_clash");
    }
    const link = `${BASE}/verify-email?token=${token}&email=${encodeURIComponent(u.email)}`;
    const tpl = tplVerifyEmail({ name: u.name, link });
    const r = await sendEmail({ to: u.email, ...tpl });
    if (r.ok) {
      sent++;
      console.log(`  ✓ ${u.email}  (${r.transport})`);
    } else {
      failed++;
      console.error(`  ✗ ${u.email}`);
    }
  }
  console.log(`\nDone. sent=${sent} failed=${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
