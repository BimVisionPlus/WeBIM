/**
 * Seed Đơn vị (BusinessUnit) for Cofico + distribute existing projects across them.
 * Idempotent on (orgId, code).
 *
 * Run:
 *   DATABASE_URL=... pnpm exec tsx ../../scripts/seed-business-units.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COFICO_SLUG = "cofico";

// Realistic Cofico sub-units (chi nhánh / ban điều hành / tổng đội).
const UNITS: Array<{ code: string; name: string; description: string; province: string }> = [
  { code: "BCH-HN",    name: "Ban điều hành Hà Nội",            description: "Phụ trách các dự án khu vực Hà Nội + lân cận (Hưng Yên, Bắc Ninh, Vĩnh Phúc).", province: "Hà Nội" },
  { code: "BCH-HCM",   name: "Ban điều hành TP HCM",            description: "Phụ trách các dự án khu vực phía Nam (TP HCM, Bình Dương, Đồng Nai, Long An).", province: "TP. HCM" },
  { code: "BCH-MT",    name: "Ban điều hành Miền Trung",        description: "Phụ trách các dự án khu vực miền Trung (Đà Nẵng, Quảng Nam, Huế).", province: "Đà Nẵng" },
  { code: "TD-BTCT",   name: "Tổng đội Bê tông cốt thép",       description: "Tổng đội chuyên trách phần kết cấu — phục vụ liên dự án.", province: "" },
  { code: "TD-MEP",    name: "Tổng đội MEP",                    description: "Tổng đội thi công cơ điện-nước, điều hoà, PCCC.", province: "" },
  { code: "BAN-HT",    name: "Ban Hạ tầng",                     description: "Chuyên các dự án hạ tầng (đường ống, cấp thoát nước, giao thông).", province: "" },
];

async function main() {
  console.log("==> Seeding business units");
  const cofico = await prisma.organization.findUnique({ where: { slug: COFICO_SLUG } });
  if (!cofico) throw new Error("Cofico org not found");

  // Upsert units
  const createdIds: string[] = [];
  for (const u of UNITS) {
    const rec = await prisma.businessUnit.upsert({
      where: { orgId_code: { orgId: cofico.id, code: u.code } },
      create: {
        orgId: cofico.id, code: u.code, name: u.name,
        description: u.description, province: u.province || null, active: true,
      },
      update: { name: u.name, description: u.description, province: u.province || null },
    });
    createdIds.push(rec.id);
    console.log(`   ${u.code}: ${u.name}`);
  }

  // Assign Cofico-owned projects + projects where Cofico is NHA_THAU_CHINH stakeholder
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerOrgId: cofico.id },
        { stakeholders: { some: { orgId: cofico.id, role: "NHA_THAU_CHINH" } } },
      ],
    },
    select: { id: true, key: true, name: true, province: true, businessUnitId: true },
  });
  console.log(`==> Distributing ${projects.length} projects across ${createdIds.length} units`);

  let assigned = 0;
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    if (p.businessUnitId) { continue; } // already assigned
    // Province-based smart assignment, fallback to round-robin
    let unitId: string;
    const prov = (p.province ?? "").toLowerCase();
    if (prov.includes("hà nội") || prov.includes("hưng yên") || prov.includes("bắc ninh") || prov.includes("vĩnh phúc") || prov.includes("hà tĩnh")) {
      unitId = createdIds[0]; // BCH-HN
    } else if (prov.includes("tp.") || prov.includes("tp ") || prov.includes("hồ chí minh") || prov.includes("bình dương") || prov.includes("đồng nai") || prov.includes("long an") || prov.includes("cần thơ")) {
      unitId = createdIds[1]; // BCH-HCM
    } else if (prov.includes("đà nẵng") || prov.includes("huế") || prov.includes("quảng nam") || prov.includes("quảng ngãi")) {
      unitId = createdIds[2]; // BCH-MT
    } else {
      // Fallback distribution: cycle through Tổng đội + Ban Hạ tầng
      unitId = createdIds[3 + (i % 3)];
    }
    await prisma.project.update({ where: { id: p.id }, data: { businessUnitId: unitId } });
    assigned++;
  }

  console.log(`==> Assigned ${assigned}/${projects.length} projects (rest were already assigned)`);

  // Print final distribution
  const distribution = await prisma.businessUnit.findMany({
    where: { orgId: cofico.id },
    select: { code: true, name: true, _count: { select: { projects: true } } },
    orderBy: { code: "asc" },
  });
  console.log("==> Final distribution:");
  for (const d of distribution) {
    console.log(`   ${d.code.padEnd(10)} ${d.name.padEnd(35)} ${d._count.projects} dự án`);
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
