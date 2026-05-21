// Demo seed for TenderForge.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PACKAGES = [
  {
    code: "HSDT-2026-CFC-018",
    perspective: "NHA_THAU" as const,
    title: "HSDT gói Xây lắp toà C — Vinhomes Q9",
    packageType: "Xây lắp",
    selectionMethod: "Đấu thầu rộng rãi qua mạng",
    estimatedValueVnd: 152_500_000_000n,
    bidSecurityVnd: 3_000_000_000n,
    state: "AWARDED",
    submittedAt: new Date("2026-02-18"),
    awardedAt: new Date("2026-03-05"),
    submissionRef: "EGP-2026-04221",
    sections: [
      { seq: 1, code: "I", title: "Đơn dự thầu", source: "TEMPLATE" },
      { seq: 2, code: "II", title: "Thỏa thuận liên danh", source: "MANUAL" },
      { seq: 3, code: "III", title: "Bảo đảm dự thầu (BidBond VCB)", source: "TEMPLATE" },
      { seq: 4, code: "IV", title: "Năng lực kinh nghiệm nhà thầu", source: "AUTO_FROM_PROFILE" },
      { seq: 5, code: "V", title: "Giải pháp & biện pháp thi công", source: "TEMPLATE" },
      { seq: 6, code: "VI", title: "Bảng giá dự thầu chi tiết", source: "AUTO_FROM_BOQ" },
      { seq: 7, code: "VII", title: "Tiến độ thi công 18 tháng", source: "MANUAL" },
    ],
  },
  {
    code: "HSDT-2026-CFC-021",
    perspective: "NHA_THAU" as const,
    title: "HSDT gói MEP — Royal Bay Đà Nẵng",
    packageType: "Xây lắp MEP",
    selectionMethod: "Đấu thầu rộng rãi qua mạng",
    estimatedValueVnd: 48_200_000_000n,
    bidSecurityVnd: 1_000_000_000n,
    state: "SUBMITTED",
    submittedAt: new Date("2026-05-15"),
    submissionRef: "EGP-2026-09812",
    sections: [
      { seq: 1, code: "I", title: "Đơn dự thầu", source: "TEMPLATE" },
      { seq: 2, code: "II", title: "Bảo đảm dự thầu (BidBond BIDV)", source: "TEMPLATE" },
      { seq: 3, code: "III", title: "Năng lực kinh nghiệm", source: "AUTO_FROM_PROFILE" },
      { seq: 4, code: "IV", title: "Bảng giá MEP", source: "AUTO_FROM_BOQ" },
    ],
  },
  {
    code: "HSDT-2026-CFC-029",
    perspective: "NHA_THAU" as const,
    title: "HSDT gói Hoàn thiện — Capital House",
    packageType: "Xây lắp hoàn thiện",
    selectionMethod: "Chào hàng cạnh tranh",
    estimatedValueVnd: 12_500_000_000n,
    state: "READY",
    sections: [
      { seq: 1, code: "I", title: "Đơn dự thầu", source: "TEMPLATE" },
      { seq: 2, code: "II", title: "Năng lực + chứng chỉ hành nghề", source: "AUTO_FROM_PROFILE" },
      { seq: 3, code: "III", title: "Bảng giá hoàn thiện", source: "AUTO_FROM_BOQ" },
    ],
  },
  {
    code: "HSMT-2026-VHGP-04",
    perspective: "BEN_MOI" as const,
    title: "HSMT gói Hạ tầng kỹ thuật giai đoạn 2",
    packageType: "Xây lắp hạ tầng",
    selectionMethod: "Đấu thầu rộng rãi qua mạng",
    estimatedValueVnd: 89_500_000_000n,
    state: "SUBMITTED",
    submittedAt: new Date("2026-05-08"),
    sections: [
      { seq: 1, code: "Chương 1", title: "Chỉ dẫn nhà thầu", source: "TEMPLATE" },
      { seq: 2, code: "Chương 2", title: "Yêu cầu năng lực", source: "MANUAL" },
      { seq: 3, code: "Chương 3", title: "Đánh giá HSDT", source: "TEMPLATE" },
      { seq: 4, code: "Chương 4", title: "Biểu mẫu", source: "TEMPLATE" },
      { seq: 5, code: "Chương 5", title: "Hồ sơ thiết kế + BoQ", source: "AUTO_FROM_BOQ" },
    ],
  },
];

async function main() {
  const ntOrg = await prisma.organization.findFirst({ where: { type: "NHA_THAU_CHINH" } });
  const cdtOrg = await prisma.organization.findFirst({ where: { type: "CHU_DAU_TU" } });
  if (!ntOrg || !cdtOrg) { console.error("Need NT_CHINH + CHU_DAU_TU orgs"); process.exit(1); }

  for (const p of PACKAGES) {
    const orgId = p.perspective === "BEN_MOI" ? cdtOrg.id : ntOrg.id;
    const pkg = await prisma.tenderPackage.upsert({
      where: { orgId_code: { orgId, code: p.code } },
      create: {
        orgId, code: p.code, perspective: p.perspective, title: p.title,
        packageType: p.packageType, selectionMethod: p.selectionMethod,
        estimatedValueVnd: p.estimatedValueVnd, bidSecurityVnd: (p as { bidSecurityVnd?: bigint }).bidSecurityVnd ?? null,
        state: p.state, submittedAt: (p as { submittedAt?: Date }).submittedAt, awardedAt: (p as { awardedAt?: Date }).awardedAt,
        submissionRef: (p as { submissionRef?: string }).submissionRef,
      },
      update: { state: p.state },
    });
    await prisma.tenderSection.deleteMany({ where: { packageId: pkg.id } });
    await prisma.tenderSection.createMany({
      data: p.sections.map((s) => ({ packageId: pkg.id, ...(s as Record<string, unknown>) })) as never,
    });
    console.log(`  ✓ ${p.code} — ${p.state} (${p.sections.length} chương)`);
  }
  console.log("✅ TenderForge seeded");
}

main().finally(() => prisma.$disconnect());
