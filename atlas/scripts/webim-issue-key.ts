/**
 * Mint an API key for the WeBIM bridge.
 *
 *   pnpm exec tsx scripts/webim-issue-key.ts --user anh.nguyen@cofico.vn
 *   pnpm exec tsx scripts/webim-issue-key.ts --user … --name "Máy trạm Blender 03" --days 180
 *   pnpm exec tsx scripts/webim-issue-key.ts --revoke wbm_1a2b3c4d
 *
 * The secret is printed once and never stored — only its SHA-256 goes to the
 * database. Paste it into WeBIM Web → module Atlas.
 */

import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCOPES = ["projects:read", "models:write"];

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function revoke(prefix: string) {
  const key = await prisma.apiKey.findFirst({ where: { prefix, revokedAt: null } });
  if (!key) {
    console.error(`Không tìm thấy key đang hoạt động với prefix ${prefix}`);
    process.exit(1);
  }
  await prisma.apiKey.update({ where: { id: key.id }, data: { revokedAt: new Date() } });
  console.log(`Đã thu hồi key ${prefix} (${key.name}).`);
}

async function issue() {
  const email = arg("--user");
  if (!email) {
    console.error("Thiếu --user <email>. Key hành động thay mặt người phát hành.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, memberships: { select: { orgId: true, role: true } } },
  });
  if (!user) {
    console.error(`Không tìm thấy user ${email}`);
    process.exit(1);
  }

  const orgId = arg("--org") ?? user.memberships[0]?.orgId;
  if (!orgId) {
    console.error(`${email} chưa thuộc tổ chức nào — truyền --org <orgId>.`);
    process.exit(1);
  }
  if (!user.memberships.some((m) => m.orgId === orgId)) {
    console.error(`${email} không phải thành viên của tổ chức ${orgId}.`);
    process.exit(1);
  }

  // `wbm_` marks the bridge keys apart from any other key an org holds.
  const secret = `wbm_${randomBytes(24).toString("hex")}`;
  const days = Number(arg("--days") ?? 365);
  const expiresAt = Number.isFinite(days) && days > 0
    ? new Date(Date.now() + days * 86_400_000)
    : null;

  const key = await prisma.apiKey.create({
    data: {
      orgId,
      name: arg("--name") ?? `WeBIM — ${email}`,
      keyHash: createHash("sha256").update(secret, "utf8").digest("hex"),
      prefix: secret.slice(0, 8),
      scopes: SCOPES,
      expiresAt,
      createdByUserId: user.id,
    },
  });

  console.log("");
  console.log(`  Key    : ${secret}`);
  console.log(`  Prefix : ${key.prefix}`);
  console.log(`  Org    : ${orgId}`);
  console.log(`  Quyền  : ${SCOPES.join(" ")}`);
  console.log(`  Hết hạn: ${expiresAt ? expiresAt.toISOString().slice(0, 10) : "không"}`);
  console.log("");
  console.log("  Chỉ hiện một lần. Dán vào WeBIM Web → Atlas → API key.");
  console.log("");
}

async function main() {
  const toRevoke = arg("--revoke");
  if (toRevoke) await revoke(toRevoke);
  else await issue();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
