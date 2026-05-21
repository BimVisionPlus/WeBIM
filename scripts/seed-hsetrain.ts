// Seed HSE-Train: 6 khoá huấn luyện + ~30 chứng chỉ.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const COURSES = [
  { code: "ATLD-N1-2026", group: "N1", title: "Nhóm 1 — Người quản lý phụ trách ATVSLĐ", durationHours: 16, validityMonths: 24, syllabus: "Hệ thống pháp luật ATVSLĐ; quản lý rủi ro; báo cáo TNLĐ." },
  { code: "ATLD-N2-2026", group: "N2", title: "Nhóm 2 — Cán bộ chuyên trách ATVSLĐ", durationHours: 48, validityMonths: 24, syllabus: "Đánh giá rủi ro; HSE plan; điều tra TNLĐ; PPE." },
  { code: "ATLD-N3-2026", group: "N3", title: "Nhóm 3 — Công việc có yêu cầu nghiêm ngặt", durationHours: 24, validityMonths: 24, syllabus: "Làm việc trên cao, không gian hạn chế, điện, hóa chất, vận thăng." },
  { code: "ATLD-N4-2026", group: "N4", title: "Nhóm 4 — Người lao động phổ thông", durationHours: 16, validityMonths: 12, syllabus: "PPE, sơ cứu, thoát hiểm, biển báo công trường." },
  { code: "ATLD-N5-2026", group: "N5", title: "Nhóm 5 — Người làm công tác y tế", durationHours: 16, validityMonths: 24, syllabus: "Sơ cấp cứu, bệnh nghề nghiệp, khám sức khỏe định kỳ." },
  { code: "ATLD-N6-2026", group: "N6", title: "Nhóm 6 — An toàn-vệ sinh viên", durationHours: 16, validityMonths: 12, syllabus: "Vai trò ATVSV; kiểm tra HSE hằng ngày; báo cáo cận nguy." },
];

const WORKERS = [
  { name: "Nguyễn V. An", id: "079198000001", group: "N1", score: 92, daysAgo: 120 },
  { name: "Trần T. Bình", id: "079198000002", group: "N2", score: 88, daysAgo: 80 },
  { name: "Lê Q. Cường", id: "079198000003", group: "N3", score: 95, daysAgo: 60 },
  { name: "Phạm T. Diệu", id: "079198000004", group: "N3", score: 84, daysAgo: 700, expired: true },
  { name: "Hoàng V. Em", id: "079198000005", group: "N3", score: 90, daysAgo: 30 },
  { name: "Đỗ T. Phương", id: "079198000006", group: "N4", score: 82, daysAgo: 200 },
  { name: "Vũ V. Giáp", id: "079198000007", group: "N4", score: 78, daysAgo: 340, expiring: true },
  { name: "Nguyễn V. Hùng", id: "079198000008", group: "N4", score: 85, daysAgo: 150 },
  { name: "Trần T. Ích", id: "079198000009", group: "N4", score: 88, daysAgo: 90 },
  { name: "Lê T. Khanh", id: "079198000010", group: "N4", score: 80, daysAgo: 60 },
  { name: "Phạm V. Long", id: "079198000011", group: "N4", score: 81, daysAgo: 45 },
  { name: "Bùi V. Minh", id: "079198000012", group: "N5", score: 91, daysAgo: 180 },
  { name: "Cao T. Ngọc", id: "079198000013", group: "N6", score: 86, daysAgo: 90 },
  { name: "Đặng V. Oai", id: "079198000014", group: "N3", score: 92, daysAgo: 40 },
  { name: "Lý T. Phúc", id: "079198000015", group: "N3", score: 89, daysAgo: 20 },
  { name: "Tô V. Quân", id: "079198000016", group: "N4", score: 75, daysAgo: 400, expired: true },
];

async function main() {
  const ntOrg = await prisma.organization.findFirst({ where: { type: "NHA_THAU_CHINH" } });
  const trainerOrg = await prisma.organization.findFirst({ where: { type: "CO_QUAN_NHA_NUOC" } }); // mock trainer

  const courses = new Map<string, string>();
  for (const c of COURSES) {
    const co = await prisma.hseCourse.upsert({
      where: { code: c.code },
      create: { code: c.code, group: c.group as never, title: c.title, durationHours: c.durationHours, validityMonths: c.validityMonths, syllabus: c.syllabus },
      update: { title: c.title },
    });
    courses.set(c.group, co.id);
    console.log(`  ✓ Course ${c.code} (${c.group}) — ${c.durationHours}h`);
  }

  let i = 1;
  for (const w of WORKERS) {
    const courseId = courses.get(w.group)!;
    const issuedAt = new Date();
    issuedAt.setDate(issuedAt.getDate() - w.daysAgo);
    const course = COURSES.find((c) => c.group === w.group)!;
    const expiresAt = new Date(issuedAt);
    expiresAt.setMonth(expiresAt.getMonth() + course.validityMonths);
    const certNumber = `${course.code}-${String(i).padStart(4, "0")}`;
    await prisma.hseCertificate.upsert({
      where: { certNumber },
      create: {
        courseId, orgId: ntOrg?.id ?? null, trainerOrgId: trainerOrg?.id ?? null,
        workerName: w.name, workerIdNo: w.id, certNumber,
        qrCode: `https://app.aecplatform.vn/hse/cert/${certNumber}`,
        issuedAt, expiresAt, testScore: w.score,
        trainerName: "TT Huấn luyện ATLĐ Sở LĐTBXH",
        state: w.expired ? "EXPIRED" : "ACTIVE",
      },
      update: {},
    });
    console.log(`  ✓ ${certNumber} — ${w.name} (${w.group}) ${w.score}%${w.expired ? " EXPIRED" : w.expiring ? " ⚠️" : ""}`);
    i++;
  }
  console.log("✅ HSE-Train seeded");
}

main().finally(() => prisma.$disconnect());
