import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) { console.error("Project not found"); process.exit(1); }
  const tvOrg = await prisma.organization.findFirst({ where: { type: "TU_VAN_THIET_KE" } });

  const eia = await prisma.eiaApplication.upsert({
    where: { projectId_code: { projectId: project.id, code: "DTM-VHGP-S9-2024" } },
    create: {
      projectId: project.id,
      type: "DTM",
      code: "DTM-VHGP-S9-2024",
      state: "APPROVED",
      authority: "Sở TNMT TP. HCM",
      consultantOrgId: tvOrg?.id ?? null,
      consultStartAt: new Date("2024-08-12"),
      consultEndAt: new Date("2024-09-26"),
      consultMinutes: "BB-TVCD-2024-VHGP-001/002/003",
      submittedAt: new Date("2024-10-08"),
      decisionRef: "QĐ 5421/QĐ-STNMT",
      decisionDate: new Date("2024-12-15"),
    },
    update: {},
  });

  const gpmt = await prisma.eiaApplication.upsert({
    where: { projectId_code: { projectId: project.id, code: "GPMT-VHGP-S9-2025" } },
    create: {
      projectId: project.id,
      type: "GPMT",
      code: "GPMT-VHGP-S9-2025",
      state: "APPROVED",
      authority: "UBND TP. HCM",
      submittedAt: new Date("2025-01-20"),
      decisionRef: "QĐ 0822/QĐ-UBND",
      decisionDate: new Date("2025-03-18"),
      expiresAt: new Date("2032-12-31"),
    },
    update: {},
  });

  // Quan trắc môi trường định kỳ — bụi, ồn, nước thải Q2/2026
  const measurements: Array<{
    measureType: "BUI" | "ON" | "NUOC_THAI" | "RUNG_DONG";
    sampleCode: string; sampleDate: Date; location: string; parameter: string;
    value: string; unit: string; qcvnRef: string; qcvnLimit?: string; exceeded?: boolean;
  }> = [
    { measureType: "BUI", sampleCode: "QT-BUI-2026-04-001", sampleDate: new Date("2026-04-10"), location: "Cổng A — biên dự án", parameter: "TSP 1h", value: "245.0", unit: "µg/m³", qcvnRef: "QCVN 05:2023/BTNMT", qcvnLimit: "300.0" },
    { measureType: "BUI", sampleCode: "QT-BUI-2026-04-002", sampleDate: new Date("2026-04-10"), location: "Cổng B — gần dân cư", parameter: "PM10 24h", value: "162.0", unit: "µg/m³", qcvnRef: "QCVN 05:2023/BTNMT", qcvnLimit: "150.0", exceeded: true },
    { measureType: "ON", sampleCode: "QT-ON-2026-04-001", sampleDate: new Date("2026-04-10"), location: "Cổng B — gần dân cư", parameter: "Leq 6h-21h", value: "68.0", unit: "dB(A)", qcvnRef: "QCVN 26:2010/BTNMT", qcvnLimit: "70.0" },
    { measureType: "ON", sampleCode: "QT-ON-2026-04-002", sampleDate: new Date("2026-04-10"), location: "Cổng B — gần dân cư", parameter: "Leq 21h-6h", value: "58.0", unit: "dB(A)", qcvnRef: "QCVN 26:2010/BTNMT", qcvnLimit: "55.0", exceeded: true },
    { measureType: "NUOC_THAI", sampleCode: "QT-NT-2026-04-001", sampleDate: new Date("2026-04-12"), location: "Cửa xả nước thải sinh hoạt", parameter: "BOD5", value: "42.0", unit: "mg/L", qcvnRef: "QCVN 14:2008/BTNMT", qcvnLimit: "50.0" },
    { measureType: "NUOC_THAI", sampleCode: "QT-NT-2026-04-002", sampleDate: new Date("2026-04-12"), location: "Cửa xả nước thải sinh hoạt", parameter: "COD", value: "98.0", unit: "mg/L", qcvnRef: "QCVN 14:2008/BTNMT", qcvnLimit: "100.0" },
    { measureType: "BUI", sampleCode: "QT-BUI-2026-05-001", sampleDate: new Date("2026-05-15"), location: "Cổng A — biên dự án", parameter: "TSP 1h", value: "198.0", unit: "µg/m³", qcvnRef: "QCVN 05:2023/BTNMT", qcvnLimit: "300.0" },
    { measureType: "RUNG_DONG", sampleCode: "QT-RD-2026-05-001", sampleDate: new Date("2026-05-15"), location: "Nhà dân cách 50m", parameter: "Rung 7-21h", value: "72.0", unit: "dB", qcvnRef: "QCVN 27:2010/BTNMT", qcvnLimit: "75.0" },
  ];

  for (const m of measurements) {
    await prisma.envMeasurement.create({
      data: {
        eiaId: eia.id,
        projectId: project.id,
        measureType: m.measureType,
        sampleCode: m.sampleCode,
        sampleDate: m.sampleDate,
        location: m.location,
        parameter: m.parameter,
        value: new Prisma.Decimal(m.value),
        unit: m.unit,
        qcvnRef: m.qcvnRef,
        qcvnLimit: m.qcvnLimit ? new Prisma.Decimal(m.qcvnLimit) : null,
        exceeded: m.exceeded ?? false,
      },
    });
    console.log(`  ✓ ${m.sampleCode} — ${m.parameter} ${m.value} ${m.unit}${m.exceeded ? " ⚠️ vượt" : ""}`);
  }
  console.log(`✅ EIAFlow seeded: ${eia.code}, ${gpmt.code}, ${measurements.length} quan trắc`);
}

main().finally(() => prisma.$disconnect());
