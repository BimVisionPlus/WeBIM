// Demo seed for HoanCong — 1 dossier với 13 nhóm theo NĐ 06/2021 Phụ lục VIIIb.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 13 nhóm tài liệu hồ sơ hoàn công theo NĐ 06/2021 Phụ lục VIIIb
const SECTIONS = [
  { seq: 1, code: "VIIIb.1", title: "Quyết định phê duyệt dự án + Giấy phép xây dựng", items: 6 },
  { seq: 2, code: "VIIIb.2", title: "Hồ sơ khảo sát xây dựng (địa chất, địa hình, thủy văn)", items: 9 },
  { seq: 3, code: "VIIIb.3", title: "Hồ sơ thiết kế: TKCS, TKKT, TKBVTC, thẩm tra", items: 14 },
  { seq: 4, code: "VIIIb.4", title: "Biện pháp thi công + biện pháp an toàn được duyệt", items: 8 },
  { seq: 5, code: "VIIIb.5", title: "Hồ sơ chất lượng vật liệu (CO/CQ, kết quả thí nghiệm)", items: 22 },
  { seq: 6, code: "VIIIb.6", title: "Nhật ký thi công + nhật ký giám sát", items: 18 },
  { seq: 7, code: "VIIIb.7", title: "BBNT công việc xây dựng (A1/A2/A3)", items: 47 },
  { seq: 8, code: "VIIIb.8", title: "BBNT giai đoạn + hoàn thành hạng mục", items: 11 },
  { seq: 9, code: "VIIIb.9", title: "Bản vẽ hoàn công (as-built drawings)", items: 25 },
  { seq: 10, code: "VIIIb.10", title: "Hồ sơ kết cấu chịu lực + thí nghiệm kết cấu", items: 14 },
  { seq: 11, code: "VIIIb.11", title: "Hệ thống MEP: cấp thoát, điện, ĐHKK, PCCC", items: 19 },
  { seq: 12, code: "VIIIb.12", title: "Hồ sơ vận hành + bảo trì công trình", items: 7 },
  { seq: 13, code: "VIIIb.13", title: "BBNT hoàn thành công trình + quyết toán hợp đồng", items: 8 },
];

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) {
    console.error("Project VHGP-S9 not found");
    process.exit(1);
  }

  const dossier = await prisma.hoanCongDossier.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      code: "HC-VHGP-S9-2026",
      title: "Hồ sơ hoàn công Vinhomes Grand Park Lô S9",
      state: "TVGS_REVIEW",
    },
    update: {},
  });

  for (const s of SECTIONS) {
    const itemCount = s.items;
    const signedCount = Math.round(itemCount * (0.45 + Math.random() * 0.35));
    const section = await prisma.hoanCongSection.upsert({
      where: { dossierId_seq: { dossierId: dossier.id, seq: s.seq } },
      create: { dossierId: dossier.id, seq: s.seq, code: s.code, title: s.title, itemCount, signedCount },
      update: { itemCount, signedCount },
    });

    // create a few sample HoanCongItem records for this section
    for (let i = 1; i <= Math.min(3, itemCount); i++) {
      await prisma.hoanCongItem.upsert({
        where: { sectionId_seq: { sectionId: section.id, seq: i } },
        create: {
          sectionId: section.id,
          seq: i,
          title: `${s.code} - Tài liệu ${i}`,
          docNumber: `${s.code}-${String(i).padStart(3, "0")}`,
          status: i <= signedCount ? "ACCEPTED" : i <= signedCount + 1 ? "SUBMITTED" : "DRAFT",
        },
        update: {},
      });
    }
    console.log(`  ✓ ${s.code} — ${s.title.slice(0, 50)}… (${signedCount}/${itemCount})`);
  }
  console.log(`✅ HoanCong seeded: ${SECTIONS.length} sections`);
}

main().finally(() => prisma.$disconnect());
