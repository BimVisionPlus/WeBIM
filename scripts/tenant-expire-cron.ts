/**
 * Cron job: tenant lifecycle automation.
 *
 * Runs daily (e.g. 03:00 VN time). Three jobs:
 *
 *   1. ACTIVE → EXPIRED: tenants past tenantExpiresAt
 *   2. EXPIRED → ARCHIVED: tenants 7 days past expiration (read-only window)
 *   3. ARCHIVED → DELETED: tenants 30 days past archival (purge data)
 *
 * Also sends reminder emails 3 days before expiry.
 *
 * Run: tsx scripts/tenant-expire-cron.ts
 * Or: docker exec atlas-aec-web-1 sh -c "cd /app && node ... " (via host cron)
 */
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../packages/lib/src";

const prisma = new PrismaClient();

const READ_ONLY_DAYS = 7;
const PURGE_AFTER_DAYS = 30;

async function expireActive() {
  const now = new Date();
  const expired = await prisma.organization.findMany({
    where: {
      isTenantDemo: true,
      tenantStatus: "ACTIVE",
      tenantExpiresAt: { lt: now },
    },
  });
  for (const t of expired) {
    await prisma.organization.update({
      where: { id: t.id },
      data: { tenantStatus: "EXPIRED" },
    });
    if (t.prospectEmail) {
      sendEmail({
        to: t.prospectEmail,
        subject: `Sandbox Viwase đã hết hạn — ${t.prospectCompany ?? t.name}`,
        html: `<p>Chào ${t.prospectName ?? "bạn"},</p>
          <p>Sandbox <code>${t.slug}.aecplatform.vn</code> đã hết hạn pilot 14 ngày. Bạn vẫn xem được dữ liệu trong ${READ_ONLY_DAYS} ngày nữa, sau đó sandbox sẽ tự đóng.</p>
          <p>Nếu muốn giữ dữ liệu + thêm seat, upgrade lên Pro: <a href="https://app.aecplatform.vn/pricing">/pricing</a></p>
          <p>Hoặc reply email này để liên hệ Atlas team.</p>`,
        text: `Sandbox ${t.slug}.aecplatform.vn đã hết hạn. Còn ${READ_ONLY_DAYS} ngày read-only. Upgrade: https://app.aecplatform.vn/pricing`,
      }).catch(() => {});
    }
  }
  console.log(`✓ Expired ${expired.length} active tenant(s)`);
}

async function archiveExpired() {
  const cutoff = new Date(Date.now() - READ_ONLY_DAYS * 86_400_000);
  const stale = await prisma.organization.findMany({
    where: {
      isTenantDemo: true,
      tenantStatus: "EXPIRED",
      tenantExpiresAt: { lt: cutoff },
    },
  });
  for (const t of stale) {
    await prisma.organization.update({
      where: { id: t.id },
      data: { tenantStatus: "ARCHIVED" },
    });
  }
  console.log(`✓ Archived ${stale.length} expired tenant(s)`);
}

async function purgeArchived() {
  // Find archived more than PURGE_AFTER_DAYS days ago (use updatedAt as a proxy)
  const cutoff = new Date(Date.now() - PURGE_AFTER_DAYS * 86_400_000);
  const old = await prisma.organization.findMany({
    where: {
      isTenantDemo: true,
      tenantStatus: "ARCHIVED",
      updatedAt: { lt: cutoff },
    },
    select: { id: true, slug: true },
  });
  for (const t of old) {
    // Cascade delete via Prisma — every project, issue, etc. with onDelete: Cascade goes too.
    try {
      await prisma.organization.delete({ where: { id: t.id } });
      console.log(`   purged ${t.slug}`);
    } catch (e: any) {
      console.error(`   failed to purge ${t.slug}: ${e.message}`);
    }
  }
  console.log(`✓ Purged ${old.length} archived tenant(s)`);
}

async function sendExpiryReminders() {
  const in3days = new Date(Date.now() + 3 * 86_400_000);
  const in2days = new Date(Date.now() + 2 * 86_400_000);
  const candidates = await prisma.organization.findMany({
    where: {
      isTenantDemo: true,
      tenantStatus: "ACTIVE",
      tenantExpiresAt: { gte: in2days, lte: in3days },
    },
  });
  for (const t of candidates) {
    if (!t.prospectEmail) continue;
    sendEmail({
      to: t.prospectEmail,
      subject: `[Reminder] Sandbox Viwase còn 3 ngày — ${t.prospectCompany ?? t.name}`,
      html: `<p>Chào ${t.prospectName ?? "bạn"},</p>
        <p>Sandbox <code>${t.slug}.aecplatform.vn</code> sẽ hết hạn pilot trong 3 ngày tới.</p>
        <p>Nếu cần thêm thời gian thử nghiệm, reply email này.</p>
        <p>Nếu sẵn sàng dùng chính thức, xem giá: <a href="https://app.aecplatform.vn/pricing">/pricing</a></p>`,
      text: `Sandbox ${t.slug}.aecplatform.vn còn 3 ngày. Liên hệ partners@aecplatform.vn để gia hạn.`,
    }).catch(() => {});
  }
  console.log(`✓ Sent ${candidates.length} expiry reminder(s)`);
}

async function main() {
  console.log(`==> Tenant cron @ ${new Date().toISOString()}`);
  await sendExpiryReminders();
  await expireActive();
  await archiveExpired();
  await purgeArchived();
  console.log("==> Done");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
