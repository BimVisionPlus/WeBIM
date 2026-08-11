import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const AGENCIES = [
  { code: "BXD", name: "Bộ Xây dựng", agencyType: "BO_XAY_DUNG", level: "Trung ương", province: "Hà Nội" },
  { code: "SXD-HCM", name: "Sở Xây dựng TP. HCM", agencyType: "SO_XAY_DUNG", level: "Tỉnh/TP", province: "TP. HCM" },
  { code: "SQHKT-HCM", name: "Sở Quy hoạch - Kiến trúc TP. HCM", agencyType: "SO_QHKT", level: "Tỉnh/TP", province: "TP. HCM" },
  { code: "STNMT-HCM", name: "Sở TNMT TP. HCM", agencyType: "SO_TNMT", level: "Tỉnh/TP", province: "TP. HCM" },
  { code: "KBNN-HCM", name: "Kho bạc Nhà nước TP. HCM", agencyType: "KBNN", level: "Tỉnh/TP", province: "TP. HCM" },
  { code: "PC07-HCM", name: "Cảnh sát PCCC PC07 TP. HCM", agencyType: "CONG_AN_PCCC", level: "Tỉnh/TP", province: "TP. HCM" },
  { code: "UBND-Q9", name: "UBND Quận 9 (Thủ Đức)", agencyType: "UBND", level: "Quận/Huyện", province: "TP. HCM" },
];

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });

  const agencyMap = new Map<string, string>();
  for (const a of AGENCIES) {
    const ag = await prisma.govAgency.upsert({
      where: { code: a.code },
      create: a as never,
      update: { name: a.name },
    });
    agencyMap.set(a.code, ag.id);
    console.log(`  ✓ ${a.code} — ${a.name}`);
  }

  if (project) {
    const docs = [
      { code: "SXD-HCM", direction: "INCOMING", docNo: "VB 2245/SXD-CCXD", docDate: new Date("2026-04-18"), subject: "Yêu cầu báo cáo tiến độ Quý 2/2026", category: "Yêu cầu báo cáo", status: "Đã trả lời", dueAt: new Date("2026-05-15"), respondedAt: new Date("2026-05-10") },
      { code: "STNMT-HCM", direction: "INCOMING", docNo: "VB 1102/STNMT-CCMT", docDate: new Date("2026-05-08"), subject: "Yêu cầu báo cáo quan trắc môi trường Q1+Q2", category: "Yêu cầu báo cáo", status: "Đang xử lý", dueAt: new Date("2026-06-10") },
      { code: "PC07-HCM", direction: "OUTGOING", docNo: "CV 142/CFC-PCCC", docDate: new Date("2026-05-12"), subject: "Đề nghị nghiệm thu PCCC giai đoạn 2", category: "Đề nghị nghiệm thu", status: "Đang xử lý" },
      { code: "KBNN-HCM", direction: "OUTGOING", docNo: "PGN 089/2026", docDate: new Date("2026-05-10"), subject: "Hồ sơ đề nghị thanh toán kỳ 04/2026", category: "Thanh toán", status: "Đã hoàn thành", respondedAt: new Date("2026-05-14") },
      { code: "SXD-HCM", direction: "INCOMING", docNo: "VB 2890/SXD-CCXD", docDate: new Date("2026-03-12"), subject: "Thông báo lịch kiểm tra công trình", category: "Văn bản chỉ đạo", status: "Đã hoàn thành", respondedAt: new Date("2026-03-25") },
      { code: "UBND-Q9", direction: "INCOMING", docNo: "VB 0421/UBND-TQT", docDate: new Date("2026-04-22"), subject: "Phản ánh tiếng ồn từ công trình - khu dân cư lân cận", category: "Khiếu nại dân", status: "Đang xử lý", dueAt: new Date("2026-05-22") },
    ];
    for (const d of docs) {
      await prisma.agencyDocument.create({
        data: {
          agencyId: agencyMap.get(d.code)!,
          projectId: project.id,
          direction: d.direction as never,
          docNo: d.docNo, docDate: d.docDate, subject: d.subject, category: d.category,
          status: d.status, dueAt: (d as { dueAt?: Date }).dueAt ?? null,
          respondedAt: (d as { respondedAt?: Date }).respondedAt ?? null,
        },
      });
      console.log(`  ✓ ${d.docNo} ${d.direction}`);
    }

    const appts = [
      { code: "SXD-HCM", scheduledAt: new Date(Date.now() + 5 * 86400000), duration: 90, purpose: "Họp tiến độ Quý 2/2026 — báo cáo + giải trình NCR cọc P31", attendees: "CĐT + NT chính + TVGS + Phòng CCXD Sở XD", status: "SCHEDULED" },
      { code: "PC07-HCM", scheduledAt: new Date(Date.now() + 12 * 86400000), duration: 60, purpose: "Nghiệm thu PCCC giai đoạn 2 (tầng 6-12)", status: "SCHEDULED" },
      { code: "KBNN-HCM", scheduledAt: new Date(Date.now() + 2 * 86400000), duration: 30, purpose: "Bổ sung hồ sơ thanh toán kỳ 05/2026", status: "SCHEDULED" },
      { code: "UBND-Q9", scheduledAt: new Date(Date.now() - 3 * 86400000), duration: 45, purpose: "Họp xử lý phản ánh tiếng ồn", status: "DONE", outcome: "Thống nhất giảm ca đêm; bố trí giảm chấn máy bơm; quan trắc lại 2 lần/tuần." },
    ];
    for (const a of appts) {
      await prisma.agencyAppointment.create({
        data: {
          agencyId: agencyMap.get(a.code)!, projectId: project.id,
          scheduledAt: a.scheduledAt, duration: a.duration,
          purpose: a.purpose, attendees: (a as { attendees?: string }).attendees ?? null,
          status: a.status, outcome: (a as { outcome?: string }).outcome ?? null,
        },
      });
      console.log(`  ✓ Appt ${a.code} ${a.scheduledAt.toISOString().slice(0, 10)}`);
    }
  }
  console.log("✅ StakeholderMap seeded");
}

main().finally(() => prisma.$disconnect());
