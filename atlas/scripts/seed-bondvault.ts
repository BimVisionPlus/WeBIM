// Demo seed for BondVault. Run: pnpm --filter @atlas/db exec tsx ../../scripts/seed-bondvault.ts
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) {
    console.error("Project VHGP-S9 not found");
    process.exit(1);
  }
  const contractor = await prisma.organization.findFirst({ where: { type: "NHA_THAU_CHINH" } });

  const bonds = [
    {
      bondNumber: "BL-VCB-2026-04221",
      issuerBank: "Vietcombank",
      beneficiary: "Công ty CP Vinhomes",
      type: "BAO_LANH_THUC_HIEN" as const,
      amountVnd: 28_500_000_000n,
      pctOfContract: new Prisma.Decimal("10.000"),
      contractValueVnd: 285_000_000_000n,
      contractRef: "HĐ 18/2026/HĐKT-VHGP",
      issuedAt: new Date("2026-01-08"),
      effectiveFrom: new Date("2026-01-10"),
      expiresAt: new Date("2027-12-31"),
      status: "ACTIVE" as const,
      feeVnd: 855_000_000n,
      feeRate: new Prisma.Decimal("1.5000"),
      bankApiSyncedAt: new Date("2026-05-20"),
      bankApiStatus: "ACTIVE",
    },
    {
      bondNumber: "BL-BIDV-2026-00188",
      issuerBank: "BIDV",
      beneficiary: "Công ty CP Vinhomes",
      type: "BAO_LANH_TAM_UNG" as const,
      amountVnd: 42_750_000_000n,
      pctOfContract: new Prisma.Decimal("15.000"),
      contractValueVnd: 285_000_000_000n,
      contractRef: "HĐ 18/2026/HĐKT-VHGP",
      issuedAt: new Date("2026-01-11"),
      effectiveFrom: new Date("2026-01-12"),
      expiresAt: new Date("2026-12-31"),
      status: "ACTIVE" as const,
      feeVnd: 641_250_000n,
      bankApiSyncedAt: new Date("2026-05-20"),
      bankApiStatus: "ACTIVE",
    },
    {
      bondNumber: "BL-TCB-2025-09921",
      issuerBank: "Techcombank",
      beneficiary: "Công ty CP Vinhomes",
      type: "BAO_LANH_BAO_HANH" as const,
      amountVnd: 14_250_000_000n,
      pctOfContract: new Prisma.Decimal("5.000"),
      contractValueVnd: 285_000_000_000n,
      contractRef: "HĐ 16/2025/HĐKT-VHGP-A",
      issuedAt: new Date("2025-12-20"),
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-06-15"),
      status: "ACTIVE" as const,
      notes: "BLBH phần phụ 12 tháng — sắp release tháng 6/2026.",
    },
    {
      bondNumber: "BL-MB-2024-22087",
      issuerBank: "MB Bank",
      beneficiary: "Công ty CP Vinhomes",
      type: "BAO_LANH_THUC_HIEN" as const,
      amountVnd: 4_500_000_000n,
      contractRef: "HĐ 09/2024/HĐKT-VHGP-Toa-B",
      issuedAt: new Date("2024-06-15"),
      effectiveFrom: new Date("2024-07-01"),
      expiresAt: new Date("2025-12-31"),
      status: "RELEASED" as const,
      releasedAt: new Date("2026-01-12"),
      releasedNote: "Đã hoàn thành nghiệm thu, giải phóng BL.",
    },
  ];

  for (const b of bonds) {
    await prisma.contractBond.upsert({
      where: { projectId_bondNumber: { projectId: project.id, bondNumber: b.bondNumber } },
      create: { projectId: project.id, contractorOrgId: contractor?.id ?? null, ...b },
      update: { status: b.status, bankApiSyncedAt: b.bankApiSyncedAt },
    });
    console.log(`  ✓ ${b.bondNumber} — ${b.type} ${b.status}`);
  }
  console.log("✅ BondVault seeded");
}

main().finally(() => prisma.$disconnect());
