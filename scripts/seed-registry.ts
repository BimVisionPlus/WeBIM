import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({ where: { type: { in: ["NHA_THAU_CHINH", "NHA_THAU_PHU", "TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE", "NHA_CUNG_CAP"] } } });
  if (orgs.length === 0) { console.error("No contractor orgs found"); process.exit(1); }

  const samples = [
    { class: "HANG_I", capNo: "BXD-CCXD-22-04421", scope: ["Thi công dân dụng cấp đặc biệt", "Thi công công nghiệp"], staff: 28, totalStaff: 480, exp: 22, dares: 47, valueVnd: 3_200_000_000_000n, rating: "4.6" },
    { class: "HANG_II", capNo: "BXD-CCXD-22-09921", scope: ["Thi công dân dụng cấp I-II", "Thi công hạ tầng"], staff: 14, totalStaff: 220, exp: 12, dares: 28, valueVnd: 1_450_000_000_000n, rating: "4.2" },
    { class: "HANG_II", capNo: "BXD-CCXD-22-11203", scope: ["Tư vấn thiết kế dân dụng", "Tư vấn quản lý DA"], staff: 18, totalStaff: 92, exp: 14, dares: 65, valueVnd: 380_000_000_000n, rating: "4.4" },
    { class: "HANG_III", capNo: "SXD-HCM-23-00821", scope: ["Thi công MEP", "Thi công hoàn thiện"], staff: 6, totalStaff: 85, exp: 8, dares: 22, valueVnd: 220_000_000_000n, rating: "3.8" },
    { class: "HANG_III", capNo: "SXD-HCM-24-00112", scope: ["Cung cấp vật liệu bê tông", "Cung cấp thép XD"], staff: 4, totalStaff: 60, exp: 6, dares: 95, valueVnd: 150_000_000_000n, rating: "4.1" },
    { class: "CHUA_PHAN_HANG", capNo: null, scope: ["Thi công thời vụ"], staff: 2, totalStaff: 35, exp: 3, dares: 5, valueVnd: 18_000_000_000n, rating: "2.6", blacklist: "Chậm tiến độ DA Khu A 2025; xử phạt ATLĐ 2024." },
  ];

  for (let i = 0; i < orgs.length && i < samples.length; i++) {
    const org = orgs[i];
    const s = samples[i];
    await prisma.contractorProfile.upsert({
      where: { orgId: org.id },
      create: {
        orgId: org.id,
        legalName: org.name,
        mst: org.mst ?? `0${1000000000 + i}`,
        capabilityClass: s.class as never,
        capabilityNo: s.capNo,
        capabilityExpiry: s.capNo ? new Date("2028-12-31") : null,
        capabilityScope: s.scope,
        charteredEng: s.staff,
        totalStaff: s.totalStaff,
        yearsExperience: s.exp,
        pastProjects: s.dares,
        pastValueVnd: s.valueVnd,
        rating: new Prisma.Decimal(s.rating),
        blacklisted: !!(s as { blacklist?: string }).blacklist,
        blacklistReason: (s as { blacklist?: string }).blacklist ?? null,
        blacklistAt: (s as { blacklist?: string }).blacklist ? new Date("2025-08-20") : null,
      },
      update: { capabilityClass: s.class as never, rating: new Prisma.Decimal(s.rating) },
    });
    console.log(`  ✓ ${org.name} — ${s.class}${(s as { blacklist?: string }).blacklist ? " BLACKLIST" : ""}`);
  }
  console.log("✅ ContractorRegistry seeded");
}

main().finally(() => prisma.$disconnect());
