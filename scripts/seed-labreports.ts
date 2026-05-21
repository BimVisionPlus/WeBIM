import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) { console.error("Project not found"); process.exit(1); }

  const btLot = await prisma.materialLot.findFirst({ where: { projectId: project.id, category: "BE_TONG_TUOI" } });
  const thepLot = await prisma.materialLot.findFirst({ where: { projectId: project.id, category: "THEP" } });

  const reports = [
    {
      sampleCode: "LAB-VHGP-S9-BT-2026-051",
      sampleType: "BE_TONG",
      sampledAt: new Date("2026-04-22"), receivedAt: new Date("2026-04-22"), testedAt: new Date("2026-05-20"),
      sampledBy: "KS Trần T. Bình",
      labCode: "LAS-XD 0421", labOrgName: "Trung tâm Kiểm định CL XDDD Phía Nam",
      testMethod: "Nén mẫu BT 150x150x150", tcvnRef: "TCVN 3118:1993",
      parameters: { "R7 (MPa)": 24.1, "R28 (MPa)": 38.2, slump_cm: 19 },
      specRequired: { "R28 (MPa)": ">= 30 (Mác 30)" },
      result: "PASS",
      reportNo: "BC-04221/2026", materialLotId: btLot?.id,
    },
    {
      sampleCode: "LAB-VHGP-S9-BT-2026-052",
      sampleType: "BE_TONG",
      sampledAt: new Date("2026-05-20"), receivedAt: new Date("2026-05-20"),
      sampledBy: "KS Lê Q. Cường",
      labCode: "LAS-XD 0421", labOrgName: "Trung tâm Kiểm định CL XDDD Phía Nam",
      testMethod: "Nén mẫu BT 150x150x150", tcvnRef: "TCVN 3118:1993",
      parameters: { "R7 (MPa)": 23.2, slump_cm: 18 },
      specRequired: { "R28 (MPa)": ">= 30" },
      result: "PENDING",
    },
    {
      sampleCode: "LAB-VHGP-S9-THEP-2026-019",
      sampleType: "THEP",
      sampledAt: new Date("2026-05-12"), testedAt: new Date("2026-05-16"),
      sampledBy: "KS Nguyễn V. An",
      labCode: "LAS-XD 0218", labOrgName: "VINASUTECH",
      testMethod: "Kéo thép D16 CB400-V", tcvnRef: "TCVN 197-1:2014",
      parameters: { "Rs (MPa)": 412.0, "Rb (MPa)": 575.0, "ε5 (%)": 18.5 },
      specRequired: { "Rs (MPa)": ">= 400", "ε5 (%)": ">= 14" },
      result: "PASS", reportNo: "BC-VS-2026-019",
      materialLotId: thepLot?.id,
    },
    {
      sampleCode: "LAB-VHGP-S9-COC-2026-007",
      sampleType: "COC_NEN",
      sampledAt: new Date("2026-02-25"), testedAt: new Date("2026-03-02"),
      sampledBy: "KS Lê Q. Cường",
      labCode: "LAS-XD 0921", labOrgName: "FECON Lab",
      testMethod: "Thử tải tĩnh cọc khoan nhồi D800 - PDA", tcvnRef: "TCVN 9393:2012",
      parameters: { "Pmax (T)": 1320, "Δmax (mm)": 8.4 },
      specRequired: { "Pmax (T)": ">= 1200", "Δmax (mm)": "<= 12" },
      result: "PASS", reportNo: "FE-PDA-2026-07",
    },
    {
      sampleCode: "LAB-VHGP-S9-COC-2026-008",
      sampleType: "COC_NEN",
      sampledAt: new Date("2026-02-28"), testedAt: new Date("2026-03-05"),
      sampledBy: "KS Lê Q. Cường",
      labCode: "LAS-XD 0921", labOrgName: "FECON Lab",
      testMethod: "Thử tải tĩnh cọc P31 D800 - PDA", tcvnRef: "TCVN 9393:2012",
      parameters: { "Pmax (T)": 980, "Δmax (mm)": 18.2 },
      specRequired: { "Pmax (T)": ">= 1200", "Δmax (mm)": "<= 12" },
      result: "FAIL",
      reportNo: "FE-PDA-2026-08", notes: "Cọc P31 độ sâu chỉ đạt 38m, sức chịu tải không đủ. Yêu cầu khoan lại + bổ sung cọc P31A.",
    },
    {
      sampleCode: "LAB-VHGP-S9-CAT-2026-003",
      sampleType: "CAT_DA",
      sampledAt: new Date("2026-04-10"), testedAt: new Date("2026-04-15"),
      sampledBy: "KS Hoàng V. Em",
      labCode: "LAS-XD 0421", labOrgName: "Trung tâm Kiểm định CL XDDD Phía Nam",
      testMethod: "Phân tích cấp phối cát vàng", tcvnRef: "TCVN 7572-2:2006",
      parameters: { Mk: 2.84, "% bụi": 1.2 },
      specRequired: { Mk: "2.0 - 3.3", "% bụi": "<= 1.5" },
      result: "PASS", reportNo: "BC-04221/CAT-3",
    },
  ];

  for (const r of reports) {
    await prisma.labReport.upsert({
      where: { projectId_sampleCode: { projectId: project.id, sampleCode: r.sampleCode } },
      create: { projectId: project.id, ...r as never },
      update: { result: r.result as never },
    });
    console.log(`  ✓ ${r.sampleCode} — ${r.result}`);
  }
  console.log("✅ LabReports seeded");
}

main().finally(() => prisma.$disconnect());
