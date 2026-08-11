// One-shot demo seed for VolumeMeter. Run: pnpm --filter @atlas/db exec tsx ../../scripts/seed-volumemeter.ts
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) {
    console.error("Project VHGP-S9 not found — run pnpm db:seed first.");
    process.exit(1);
  }

  const sheets = [
    {
      code: "QTO-VHGP-S9-MONG-001",
      title: "Bóc khối lượng móng cọc khối A",
      scope: "Khối A — trục 1-8, cọc D800 L=42m",
      source: "IFC_AUTO" as const,
      state: "CDT_APPROVED",
      ntSubmittedAt: new Date("2026-03-15"),
      tvgsVerifiedAt: new Date("2026-03-17"),
      cdtApprovedAt: new Date("2026-03-19"),
      lines: [
        { seq: 1, workCode: "AB.13211", description: "Cọc khoan nhồi D800, L=42m, B25", unit: "m", qtyEstimated: "3360.0", qtyExecuted: "3402.0", unitPriceVnd: 2_850_000n },
        { seq: 2, workCode: "AB.13311", description: "Bê tông đài cọc B30", unit: "m3", qtyEstimated: "485.0", qtyExecuted: "492.5", unitPriceVnd: 2_150_000n },
        { seq: 3, workCode: "AF.61221", description: "Cốt thép đài cọc D16-D25", unit: "tấn", qtyEstimated: "62.4", qtyExecuted: "63.8", unitPriceVnd: 22_500_000n },
      ],
    },
    {
      code: "QTO-VHGP-S9-COTTHEP-T12",
      title: "Cốt thép sàn tầng 12",
      scope: "Tầng 12 trục A-F, sàn dày 200mm",
      source: "HYBRID" as const,
      state: "TVGS_VERIFIED",
      ntSubmittedAt: new Date("2026-05-08"),
      tvgsVerifiedAt: new Date("2026-05-10"),
      lines: [
        { seq: 1, workCode: "AF.61222", description: "Cốt thép sàn D10-D14", unit: "tấn", qtyEstimated: "18.5", qtyExecuted: "19.2", unitPriceVnd: 22_500_000n },
        { seq: 2, workCode: "AF.81121", description: "Bê tông sàn B30 SCC", unit: "m3", qtyEstimated: "142.0", qtyExecuted: "144.5", unitPriceVnd: 2_080_000n },
      ],
    },
    {
      code: "QTO-VHGP-S9-MEP-CT-001",
      title: "Cấp thoát nước tầng 1-5",
      scope: "Toà A — tầng 1 đến 5",
      source: "MANUAL" as const,
      state: "NT_SUBMITTED",
      ntSubmittedAt: new Date("2026-05-19"),
      lines: [
        { seq: 1, workCode: "BB.18121", description: "Ống PPR D32 nóng-lạnh", unit: "m", qtyEstimated: "850.0", qtyExecuted: "868.0", unitPriceVnd: 95_000n },
        { seq: 2, workCode: "BB.18221", description: "Ống PVC D110 thoát", unit: "m", qtyEstimated: "320.0", qtyExecuted: "315.0", unitPriceVnd: 142_000n },
      ],
    },
  ];

  for (const s of sheets) {
    const lines = s.lines.map((l) => ({
      ...l,
      qtyEstimated: new Prisma.Decimal(l.qtyEstimated),
      qtyExecuted: new Prisma.Decimal(l.qtyExecuted),
    }));
    const totalValue = s.lines.reduce(
      (sum, l) => sum + BigInt(Math.round(Number(l.qtyExecuted) * Number(l.unitPriceVnd))),
      0n,
    );
    await prisma.takeoffSheet.upsert({
      where: { projectId_code: { projectId: project.id, code: s.code } },
      create: {
        projectId: project.id,
        code: s.code,
        title: s.title,
        scope: s.scope,
        source: s.source,
        state: s.state,
        totalLines: lines.length,
        totalValue,
        ntSubmittedAt: s.ntSubmittedAt,
        tvgsVerifiedAt: (s as { tvgsVerifiedAt?: Date }).tvgsVerifiedAt,
        cdtApprovedAt: (s as { cdtApprovedAt?: Date }).cdtApprovedAt,
        lines: { create: lines },
      },
      update: {},
    });
    console.log(`  ✓ ${s.code} — ${s.state} (${lines.length} dòng)`);
  }
  console.log("✅ VolumeMeter seeded");
}

main().finally(() => prisma.$disconnect());
