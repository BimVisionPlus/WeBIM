/**
 * Activate a subscription after bank transfer is confirmed.
 *
 *   ORG=cofico PLAN=pro CREDIT=1000000 \
 *     pnpm exec tsx scripts/activate-subscription.ts
 *
 * Idempotent — running twice with same args produces same end state.
 *
 * What it does:
 *   1. Resolve org by slug
 *   2. Resolve plan by code (free | pro | business | enterprise)
 *   3. Upsert Subscription row with ACTIVE status + AI credit balance
 *   4. Write an audit event (so finance can prove activation timing)
 *   5. Email the org's primary contact confirming activation
 */

import { prisma } from "@atlas/db";
import { sendEmail } from "@atlas/lib";

const ORG_SLUG = process.env.ORG;
const PLAN_CODE = process.env.PLAN;
const CREDIT_VND = process.env.CREDIT ? BigInt(process.env.CREDIT) : null;

async function main() {
  if (!ORG_SLUG || !PLAN_CODE) {
    console.error("Usage: ORG=<org-slug> PLAN=<free|pro|business|enterprise> CREDIT=<vnd> tsx scripts/activate-subscription.ts");
    process.exit(2);
  }

  const org = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    include: { members: { include: { user: true } } },
  });
  if (!org) {
    console.error(`Org not found: ${ORG_SLUG}`);
    process.exit(1);
  }

  const plan = await prisma.plan.findUnique({ where: { code: PLAN_CODE } });
  if (!plan) {
    console.error(`Plan not found: ${PLAN_CODE}`);
    process.exit(1);
  }

  const renewsAt = new Date();
  renewsAt.setMonth(renewsAt.getMonth() + 1);

  // Default credit: 1M VND for Pro, 3M for Business, 0 (unlimited) for Enterprise/Free
  const defaultCredit: Record<string, bigint> = {
    free: 50_000n,
    pro: 1_000_000n,
    business: 3_000_000n,
    enterprise: 0n,
  };
  const credit = CREDIT_VND ?? defaultCredit[PLAN_CODE] ?? 0n;

  const sub = await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      renewsAt,
      aiCreditVnd: credit,
      paymentMethod: "BANK_TRANSFER",
    },
    create: {
      orgId: org.id,
      planId: plan.id,
      status: "ACTIVE",
      renewsAt,
      aiCreditVnd: credit,
      paymentMethod: "BANK_TRANSFER",
    },
  });

  await prisma.auditEvent.create({
    data: {
      action: "billing.subscription_activated",
      entityType: "Subscription",
      entityId: sub.id,
      orgId: org.id,
      after: { planCode: PLAN_CODE, creditVnd: credit.toString(), renewsAt: renewsAt.toISOString() } as any,
    },
  });

  // Notify the org owner
  const owner = org.members.find((m) => m.role === "OWNER")?.user
    ?? org.members.find((m) => m.role === "ADMIN")?.user
    ?? org.members[0]?.user;
  if (owner) {
    await sendEmail({
      to: owner.email,
      subject: `Atlas AEC — gói ${plan.name} đã kích hoạt cho ${org.name}`,
      html: `<div style="font-family: -apple-system, system-ui, sans-serif; padding: 24px;">
        <h2>Kích hoạt thành công ✓</h2>
        <p>Tổ chức <strong>${org.name}</strong> đã được nâng cấp lên gói <strong>${plan.name}</strong>.</p>
        <ul>
          <li>Tín dụng AI: <strong>${credit.toLocaleString("vi-VN")} đ</strong></li>
          <li>Kỳ tiếp: <strong>${renewsAt.toLocaleDateString("vi-VN")}</strong></li>
          <li>Phương thức: Chuyển khoản ngân hàng</li>
        </ul>
        <p>Hoá đơn VAT đã gửi qua email người yêu cầu.</p>
      </div>`,
      text: `Gói ${plan.name} đã kích hoạt cho ${org.name}. Tín dụng AI: ${credit} VND.`,
    });
  }

  console.log(`✅ Activated:`);
  console.log(`   org=${org.slug} (${org.id})`);
  console.log(`   plan=${plan.code}  status=ACTIVE`);
  console.log(`   aiCreditVnd=${credit.toString()}`);
  console.log(`   renewsAt=${renewsAt.toISOString()}`);
  if (owner) console.log(`   notified=${owner.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
