import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TEMPLATES = [
  { code: "BPTC-LIB-COC-D800", category: "COC", title: "BPTC cọc khoan nhồi D800", scope: "Cọc khoan nhồi D600-D1200, sâu ≤ 50m, đất sét/cát", tcvnRefs: ["TCVN 9395:2012", "TCVN 9398:2012"] },
  { code: "BPTC-LIB-DAO-DAT", category: "DAO_DAT", title: "BPTC đào đất, kè chống vách", scope: "Đào hố móng sâu 3-12m, kè cừ Larssen", tcvnRefs: ["TCVN 4447:2012", "TCVN 9362:2012"] },
  { code: "BPTC-LIB-BT-KHOI", category: "BE_TONG_KHOI", title: "BPTC bê tông khối lớn", scope: "Khối > 1m³, kiểm soát nhiệt thủy hóa < 65°C", tcvnRefs: ["TCVN 4453:1995", "ACI 207.1R-05"] },
  { code: "BPTC-LIB-KETCAU", category: "KET_CAU", title: "BPTC kết cấu BTCT tầng cao", scope: "Cốt thép + ván khuôn + đổ BT tầng điển hình", tcvnRefs: ["TCVN 4453:1995", "TCVN 5574:2018"] },
  { code: "BPTC-LIB-CAU-GIO", category: "CAU_GIANG_GIO", title: "BPTC cẩu tháp + giàn giáo", scope: "Cẩu QTZ-80 + giàn giáo ringlock, làm việc trên cao", tcvnRefs: ["TCVN 4244:2005", "QCVN 7:2012/BLĐTBXH"] },
  { code: "BPTC-LIB-MEP", category: "MEP", title: "BPTC lắp đặt MEP toà nhà", scope: "Cấp thoát + điện + ĐHKK + PCCC trong nhà cao tầng", tcvnRefs: ["TCVN 4519:1988", "TCVN 7447", "TCVN 5687"] },
  { code: "BPTC-LIB-HOAN-THIEN", category: "HOAN_THIEN", title: "BPTC hoàn thiện trong nhà", scope: "Tô trát + lát gạch + sơn + lắp cửa", tcvnRefs: ["TCVN 9377", "TCVN 6044"] },
  { code: "BPTC-LIB-HAN", category: "HAN_CO_DIEN", title: "BPTC công tác hàn nóng (hot work)", scope: "Hàn điện + cắt nhiệt + xông gas — kiểm soát cháy nổ", tcvnRefs: ["TCVN 5586", "QCVN 06:2022/BXD"] },
];

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });

  for (const t of TEMPLATES) {
    await prisma.methodStatement.upsert({
      where: { id: `tpl-${t.code}` }, // synthetic id for upsert keying
      create: {
        id: `tpl-${t.code}`,
        code: t.code, category: t.category as never, title: t.title, scope: t.scope,
        body: `# ${t.title}\n\n## Phạm vi\n${t.scope}\n\n## Quy trình thi công\n1. Chuẩn bị mặt bằng\n2. Triển khai\n3. Kiểm soát chất lượng\n4. Nghiệm thu\n\n## TCVN tham chiếu\n${t.tcvnRefs.map((r) => `- ${r}`).join("\n")}\n`,
        tcvnRefs: t.tcvnRefs, isTemplate: true, state: "APPROVED",
      },
      update: { title: t.title, tcvnRefs: t.tcvnRefs },
    });
    console.log(`  ✓ Template ${t.code}`);
  }

  if (project) {
    const instances = [
      { code: "BPTC-VHGP-S9-COC-001", category: "COC", title: "BPTC cọc khoan nhồi - VHGP S9", scope: "Khối A trục 1-8, 245 cọc D800", tcvnRefs: ["TCVN 9395:2012"], state: "APPROVED",
        ntSubmittedAt: new Date("2026-01-15"), tvgsApprovedAt: new Date("2026-01-22"), cdtApprovedAt: new Date("2026-01-28") },
      { code: "BPTC-VHGP-S9-BT-T12", category: "KET_CAU", title: "BPTC bê tông sàn tầng 12", scope: "Sàn tầng 12 trục A-F dày 200mm, BT B30 SCC", tcvnRefs: ["TCVN 4453:1995"], state: "EXECUTING",
        ntSubmittedAt: new Date("2026-04-25"), tvgsApprovedAt: new Date("2026-04-28"), cdtApprovedAt: new Date("2026-05-02") },
      { code: "BPTC-VHGP-S9-MEP-T1-5", category: "MEP", title: "BPTC MEP tầng 1-5 toà A", scope: "Cấp thoát + điện + ĐHKK tầng 1-5", tcvnRefs: ["TCVN 4519:1988", "TCVN 7447"], state: "CDT_REVIEW",
        ntSubmittedAt: new Date("2026-05-15"), tvgsApprovedAt: new Date("2026-05-18") },
      { code: "BPTC-VHGP-S9-HT-T8", category: "HOAN_THIEN", title: "BPTC hoàn thiện tầng 8", scope: "Hoàn thiện căn hộ tầng 8 — 24 căn", tcvnRefs: ["TCVN 9377-3:2012"], state: "NT_SUBMITTED",
        ntSubmittedAt: new Date("2026-05-19") },
    ];
    for (const i of instances) {
      await prisma.methodStatement.upsert({
        where: { id: `inst-${i.code}` },
        create: { id: `inst-${i.code}`, projectId: project.id, isTemplate: false, body: `## ${i.title}\n\n${i.scope}`, ...(i as Record<string, unknown>) } as never,
        update: { state: i.state },
      });
      console.log(`  ✓ ${i.code} — ${i.state}`);
    }
  }
  console.log("✅ MethodStatement seeded");
}

main().finally(() => prisma.$disconnect());
