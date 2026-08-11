// Demo seed for SuperviseLog — 5 nhật ký TVGS gần đây.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) { console.error("Project not found"); process.exit(1); }
  const tvgsOrg = await prisma.organization.findFirst({ where: { type: "TU_VAN_GIAM_SAT" } });
  const tvgsUser = await prisma.user.findFirst({ where: { memberships: { some: { orgId: tvgsOrg?.id } } } });

  const entries = [
    {
      logDate: new Date("2026-05-20"),
      shift: "DAY" as const,
      weather: "Nắng nhẹ, 32°C, không mưa",
      attendees: "TVGS: KS Nguyễn V. An — NT: KS Trần T. Bình — CĐT: KS Lê Q. Cường",
      workItems: "Đổ bê tông sàn tầng 12 trục A-F, đoạn 2/3. Thi công cốt thép dầm tầng 13. Lắp ván khuôn cột.",
      qualityNotes: "Bê tông B30 SCC slump 18cm đạt; lấy mẫu thí nghiệm theo TCVN 3105 (3 tổ mẫu).",
      safetyNotes: "Đeo dây an toàn đầy đủ; lan can rìa sàn đã lắp; 1 NLĐ thiếu mũ bảo hộ — đã nhắc nhở.",
      materialsNotes: "Nhận 142m3 bê tông B30 SCC Holcim (xe BS 51C-12345). CO/CQ đầy đủ.",
      testRefs: ["LAB-VHGP-S9-BT-2026-052"],
      voiceTranscript: "Ngày 20 tháng 5... đang đổ sàn tầng 12 trục A đến F, bê tông B30 SCC slump 18cm, lấy 3 tổ mẫu, có một anh quên đeo mũ bảo hộ tôi đã nhắc",
      state: "FINALIZED",
      tvgsSignedAt: new Date("2026-05-20T18:30"),
      tvgsCertSerial: "VNPT-CA-2024-44551",
      ntSignedAt: new Date("2026-05-21T08:00"),
      ntCertSerial: "VTL-CA-2025-77821",
      cdtSignedAt: new Date("2026-05-21T14:00"),
      cdtCertSerial: "VNPT-CA-2024-11002",
      photoUrls: ["supervise/2026-05-20/photo1.jpg", "supervise/2026-05-20/photo2.jpg", "supervise/2026-05-20/photo3.jpg"],
    },
    {
      logDate: new Date("2026-05-19"),
      shift: "DAY" as const,
      weather: "Mưa rào chiều, 29°C",
      workItems: "Thi công cốt thép sàn tầng 12 đoạn 2/3. Lắp ván khuôn tầng 13 cột P1-P4.",
      qualityNotes: "Cốt thép D10 buộc đạt tỷ lệ; gối thép ≥ a40 đầu mút.",
      safetyNotes: "Mưa to lúc 14h-15h30, dừng thi công cao 30 phút theo quy trình. Không có sự cố.",
      state: "CDT_SIGNED",
      tvgsSignedAt: new Date("2026-05-19T18:00"),
      tvgsCertSerial: "VNPT-CA-2024-44551",
      ntSignedAt: new Date("2026-05-20T08:30"),
      ntCertSerial: "VTL-CA-2025-77821",
      photoUrls: ["supervise/2026-05-19/photo1.jpg"],
    },
    {
      logDate: new Date("2026-05-18"),
      shift: "NIGHT" as const,
      weather: "Khô ráo, 27°C",
      workItems: "Đổ bê tông sàn tầng 12 trục G-K (ca đêm tránh nắng đỉnh).",
      qualityNotes: "Bê tông đêm, nhiệt độ ổn định, slump giữ 18-19cm.",
      safetyNotes: "Đèn pha bố trí đủ. 1 vụ trượt nhẹ — không thương tích.",
      materialsNotes: "Nhận 95m3 BT B30 SCC ca đêm.",
      state: "NT_SIGNED",
      tvgsSignedAt: new Date("2026-05-19T06:00"),
      tvgsCertSerial: "VNPT-CA-2024-44551",
      photoUrls: ["supervise/2026-05-18-night/photo1.jpg"],
    },
    {
      logDate: new Date("2026-05-17"),
      shift: "DAY" as const,
      weather: "Nắng, 33°C",
      workItems: "Lắp đặt cốt thép sàn tầng 12 đoạn 1/3. Hoàn thiện tô trát tầng 8.",
      qualityNotes: "Cường độ bê tông tầng 10 R28 = 38.5 MPa (Mác 30 yêu cầu ≥ 30) — đạt.",
      safetyNotes: "Tốt.",
      state: "TVGS_SIGNED",
      tvgsSignedAt: new Date("2026-05-17T18:15"),
      tvgsCertSerial: "VNPT-CA-2024-44551",
      photoUrls: ["supervise/2026-05-17/photo1.jpg", "supervise/2026-05-17/photo2.jpg"],
    },
    {
      logDate: new Date("2026-05-16"),
      shift: "DAY" as const,
      weather: "Mưa cả ngày",
      workItems: "Dừng thi công ngoài trời. Thi công nội thất MEP tầng 1-5.",
      qualityNotes: "Lắp ống PPR D32 theo bản vẽ.",
      safetyNotes: "Tốt.",
      state: "DRAFT",
      photoUrls: [],
    },
  ];

  for (const e of entries) {
    await prisma.superviseEntry.upsert({
      where: { projectId_logDate_shift: { projectId: project.id, logDate: e.logDate, shift: e.shift } },
      create: {
        projectId: project.id,
        supervisorOrgId: tvgsOrg?.id ?? null,
        supervisorUserId: tvgsUser?.id ?? null,
        attendees: (e as { attendees?: string }).attendees ?? null,
        materialsNotes: (e as { materialsNotes?: string }).materialsNotes ?? null,
        testRefs: (e as { testRefs?: string[] }).testRefs ?? [],
        ncrIds: [],
        rfiIds: [],
        acceptanceIds: [],
        voiceTranscript: (e as { voiceTranscript?: string }).voiceTranscript ?? null,
        ...e,
      },
      update: {},
    });
    console.log(`  ✓ ${e.logDate.toISOString().slice(0, 10)} ${e.shift} — ${e.state}`);
  }
  console.log("✅ SuperviseLog seeded");
}

main().finally(() => prisma.$disconnect());
