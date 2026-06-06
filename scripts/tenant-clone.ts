/**
 * CLI wrapper around @atlas/lib's cloneTenant().
 *
 * Usage:
 *   tsx scripts/tenant-clone.ts \
 *     --slug acme-corp --name "ACME Pilot" --email ceo@acme.com
 */
import { cloneTenant, type CloneOpts } from "@atlas/lib";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const get = (k: string): string | undefined => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const opts: CloneOpts = {
  slug: get("slug") ?? "",
  name: get("name") ?? "",
  prospectEmail: get("email") ?? "",
  prospectName: get("name-prospect"),
  prospectCompany: get("company"),
  prospectIndustry: get("industry"),
  prospectSource: get("source") ?? "cli",
  templateSlug: get("template") ?? "cofico",
  pilotDays: get("days") ? Number(get("days")) : 14,
};

if (!opts.slug || !opts.name || !opts.prospectEmail) {
  console.error("Usage: tsx tenant-clone.ts --slug <slug> --name <name> --email <email>");
  process.exit(1);
}

const prisma = new PrismaClient();

cloneTenant(opts)
  .then(async (r) => {
    console.log("✓ Tenant cloned");
    console.log(`   orgId: ${r.orgId}`);
    console.log(`   ownerUserId: ${r.ownerUserId}`);
    console.log(`   signin URL: https://${opts.slug}.aecplatform.vn/signin-magic?token=${r.signinToken}`);
    console.log(`   stats:`, r.stats);
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("✗ Clone failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
