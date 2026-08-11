// One-shot demo seed for PaymentRail. Run: pnpm tsx scripts/seed-paymentrail.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) {
    console.error("Project VHGP-S9 not found — run pnpm db:seed first.");
    process.exit(1);
  }

  const contractor = await prisma.organization.findFirst({ where: { type: "NHA_THAU_CHINH" } });

  const samples = [
    {
      code: "TT-VHGP-S9-2026-03-001",
      period: "2026-03",
      paymentType: "GIAI_DOAN" as const,
      fundSource: "NGAN_SACH" as const,
      contractValueVnd: 285_000_000_000n,
      workDoneVnd: 18_500_000_000n,
      cumulativeWorkVnd: 142_300_000_000n,
      advanceDeductionVnd: 1_850_000_000n,
      retentionVnd: 925_000_000n,
      vatRate: 8,
      vatVnd: 1_258_000_000n,
      netPayableVnd: 16_983_000_000n,
      state: "PAID",
      ntSignedAt: new Date("2026-04-02"),
      tvgsSignedAt: new Date("2026-04-04"),
      cdtApprovedAt: new Date("2026-04-08"),
      kbnnSubmittedAt: new Date("2026-04-09"),
      kbnnTxId: "KBNN-HCM-202604-08842",
      kbnnStatus: "PAID",
      paidAt: new Date("2026-04-14"),
      paidVnd: 16_983_000_000n,
    },
    {
      code: "TT-VHGP-S9-2026-04-001",
      period: "2026-04",
      paymentType: "GIAI_DOAN" as const,
      fundSource: "NGAN_SACH" as const,
      contractValueVnd: 285_000_000_000n,
      workDoneVnd: 22_750_000_000n,
      cumulativeWorkVnd: 165_050_000_000n,
      advanceDeductionVnd: 2_275_000_000n,
      retentionVnd: 1_137_500_000n,
      vatRate: 8,
      vatVnd: 1_547_000_000n,
      netPayableVnd: 20_884_500_000n,
      state: "KBNN_SUBMITTED",
      ntSignedAt: new Date("2026-05-03"),
      tvgsSignedAt: new Date("2026-05-05"),
      cdtApprovedAt: new Date("2026-05-09"),
      kbnnSubmittedAt: new Date("2026-05-10"),
      kbnnTxId: "KBNN-HCM-202605-04221",
      kbnnStatus: "PENDING",
    },
    {
      code: "TT-VHGP-S9-2026-05-001",
      period: "2026-05",
      paymentType: "GIAI_DOAN" as const,
      fundSource: "NGAN_SACH" as const,
      contractValueVnd: 285_000_000_000n,
      workDoneVnd: 15_200_000_000n,
      cumulativeWorkVnd: 180_250_000_000n,
      advanceDeductionVnd: 1_520_000_000n,
      retentionVnd: 760_000_000n,
      vatRate: 8,
      vatVnd: 1_033_600_000n,
      netPayableVnd: 13_953_600_000n,
      state: "TVGS_SIGNED",
      ntSignedAt: new Date("2026-05-18"),
      tvgsSignedAt: new Date("2026-05-20"),
    },
    {
      code: "TU-VHGP-S9-2026-01-001",
      period: "2026-01",
      paymentType: "TAM_UNG" as const,
      fundSource: "NGAN_SACH" as const,
      contractValueVnd: 285_000_000_000n,
      workDoneVnd: 0n,
      cumulativeWorkVnd: 0n,
      advanceDeductionVnd: 0n,
      retentionVnd: 0n,
      vatRate: 8,
      vatVnd: 0n,
      netPayableVnd: 42_750_000_000n,
      state: "PAID",
      notes: "Tạm ứng hợp đồng 15% theo TT 08/2022 Điều 7.",
      cdtApprovedAt: new Date("2026-01-12"),
      kbnnSubmittedAt: new Date("2026-01-13"),
      paidAt: new Date("2026-01-18"),
      paidVnd: 42_750_000_000n,
    },
  ];

  for (const s of samples) {
    await prisma.paymentApplication.upsert({
      where: { projectId_code: { projectId: project.id, code: s.code } },
      create: { projectId: project.id, contractorOrgId: contractor?.id ?? null, contractRef: "HĐ 18/2026/HĐKT-VHGP", acceptanceIds: [], changeOrderIds: [], attachmentIds: [], ...s },
      update: {},
    });
    console.log(`  ✓ ${s.code} — ${s.state}`);
  }
  console.log("✅ PaymentRail seeded");
}

main().finally(() => prisma.$disconnect());
