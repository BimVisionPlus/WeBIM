/**
 * Quy trình phối hợp theo phòng ban + tiêu chí chuyển giai đoạn.
 *
 *   cd packages/db && npx tsx ../../scripts/seed-processes.ts
 *   (or: bash scripts/seed-all.sh)
 *
 * The steps are written as things someone can actually check, not as verbs:
 * a criterion that reads "hoàn thành công việc" tells a reviewer nothing.
 */

import { PrismaClient, type MemberRole, type ProjectDepartment } from "@prisma/client";

const prisma = new PrismaClient();

interface StepSeed {
  title: string;
  criteria: string;
  role: MemberRole;
  slaDays: number;
  isGate?: boolean;
}

interface TemplateSeed {
  name: string;
  department: ProjectDepartment;
  kind: "WORKFLOW" | "STAGE_GATE";
  isoCode: string;
  description: string;
  steps: StepSeed[];
}

const TEMPLATES: TemplateSeed[] = [
  {
    name: "Phát hành hồ sơ thiết kế cho CĐT",
    department: "CONG_VIEC",
    kind: "WORKFLOW",
    isoCode: "QT-TK-05",
    description:
      "Từ lúc bộ bản vẽ đủ điều kiện phát hành đến khi CĐT nhận được, kèm dấu vết ai duyệt cái gì.",
    steps: [
      {
        title: "Chủ trì bộ môn rà soát nội bộ",
        criteria:
          "Không còn ghi chú 'TBC' trên bản vẽ; danh mục bản vẽ khớp với số tờ thực tế.",
        role: "ENGINEER",
        slaDays: 2,
      },
      {
        title: "Kiểm tra chéo giữa các bộ môn",
        criteria:
          "Chạy clash KT×KC và KT×MEP, không còn va chạm cứng chưa có phương án xử lý.",
        role: "PROJECT_MGR",
        slaDays: 3,
        isGate: true,
      },
      {
        title: "Soát xét theo ISO công ty",
        criteria:
          "Khung tên, mã hiệu bản vẽ theo QT-TK-01; có chữ ký người lập / kiểm / duyệt.",
        role: "SUPERVISOR",
        slaDays: 1,
      },
      {
        title: "Chỉ huy trưởng phê duyệt phát hành",
        criteria: "Có phê duyệt trên hệ thống, ghi rõ phiên bản phát hành.",
        role: "PROJECT_MGR",
        slaDays: 1,
        isGate: true,
      },
      {
        title: "Gửi CĐT và lưu CDE",
        criteria:
          "Bộ hồ sơ ở trạng thái PUBLISHED trên CDE; có biên bản/email bàn giao.",
        role: "ENGINEER",
        slaDays: 1,
      },
    ],
  },
  {
    name: "Xử lý văn bản đến",
    department: "HANH_CHINH",
    kind: "WORKFLOW",
    isoCode: "QT-HC-02",
    description: "Văn bản đến từ CĐT, cơ quan quản lý hoặc nhà thầu phụ.",
    steps: [
      {
        title: "Vào sổ và số hoá",
        criteria: "Có số văn bản đến, ngày nhận, bản scan đính kèm.",
        role: "FIELD",
        slaDays: 1,
      },
      {
        title: "Phân loại và chuyển phòng chủ trì",
        criteria: "Xác định rõ phòng chủ trì và hạn xử lý; có người nhận cụ thể.",
        role: "ADMIN",
        slaDays: 1,
      },
      {
        title: "Phòng chủ trì trả lời",
        criteria: "Có dự thảo văn bản trả lời hoặc lý do không cần trả lời.",
        role: "ENGINEER",
        slaDays: 5,
      },
      {
        title: "Lãnh đạo ký và phát hành",
        criteria: "Có chữ ký, số văn bản đi, và bản lưu.",
        role: "OWNER",
        slaDays: 2,
        isGate: true,
      },
    ],
  },
  {
    name: "Thanh toán khối lượng theo giai đoạn",
    department: "TAI_CHINH_KE_TOAN",
    kind: "WORKFLOW",
    isoCode: "QT-TC-04",
    description: "Hồ sơ thanh toán từ nhà thầu đến khi giải ngân.",
    steps: [
      {
        title: "Nhà thầu nộp hồ sơ khối lượng",
        criteria: "Có bảng khối lượng, bản vẽ hoàn công phần tương ứng, BBNT kèm theo.",
        role: "ENGINEER",
        slaDays: 2,
      },
      {
        title: "Giám sát xác nhận khối lượng",
        criteria: "Khối lượng khớp với bóc tách; sai lệch > 5% phải có giải trình.",
        role: "SUPERVISOR",
        slaDays: 3,
        isGate: true,
      },
      {
        title: "Kế toán đối chiếu hợp đồng",
        criteria: "Đơn giá khớp phụ lục hợp đồng; đã trừ tạm ứng và giữ lại bảo hành.",
        role: "ADMIN",
        slaDays: 3,
      },
      {
        title: "Duyệt giải ngân",
        criteria: "Có phê duyệt của người có thẩm quyền theo hạn mức.",
        role: "OWNER",
        slaDays: 2,
        isGate: true,
      },
    ],
  },
  {
    name: "Chuyển giai đoạn: Móng → Thân",
    department: "CONG_VIEC",
    kind: "STAGE_GATE",
    isoCode: "TC-GD-01",
    description:
      "Bộ tiêu chí phải đạt trước khi triển khai kết cấu thân. Mỗi tiêu chí có người chịu trách nhiệm và hạn.",
    steps: [
      {
        title: "Nghiệm thu phần móng theo NĐ 06/2021",
        criteria: "Có BBNT giai đoạn móng, đủ chữ ký NT – TVGS – CĐT.",
        role: "SUPERVISOR",
        slaDays: 5,
        isGate: true,
      },
      {
        title: "Kết quả thí nghiệm đạt",
        criteria: "Nén mẫu bê tông R28 đạt mác thiết kế; thép có CO/CQ hợp lệ.",
        role: "ENGINEER",
        slaDays: 3,
        isGate: true,
      },
      {
        title: "Hồ sơ hoàn công phần ngầm",
        criteria: "Bản vẽ hoàn công phần ngầm đã ký; nhật ký thi công đầy đủ.",
        role: "ENGINEER",
        slaDays: 7,
      },
      {
        title: "Mặt bằng và an toàn cho giai đoạn thân",
        criteria: "Giàn giáo, lưới an toàn, biện pháp thi công thân đã được duyệt.",
        role: "SUPERVISOR",
        slaDays: 3,
        isGate: true,
      },
      {
        title: "Thanh toán giai đoạn móng đã xử lý",
        criteria: "Hồ sơ thanh toán giai đoạn móng đã được duyệt hoặc có cam kết tiến độ.",
        role: "ADMIN",
        slaDays: 5,
      },
    ],
  },
  {
    name: "Chuẩn bị hồ sơ dự thầu",
    department: "DAU_THAU",
    kind: "WORKFLOW",
    isoCode: "QT-DT-03",
    description: "Từ khi quyết định tham gia đến khi nộp thầu.",
    steps: [
      {
        title: "Quyết định tham gia",
        criteria: "Có đánh giá năng lực, biên lợi nhuận dự kiến và phê duyệt tham gia.",
        role: "OWNER",
        slaDays: 2,
        isGate: true,
      },
      {
        title: "Bóc tách khối lượng mời thầu",
        criteria: "Khối lượng bóc tách sai lệch dưới 3% so với hồ sơ mời thầu.",
        role: "ENGINEER",
        slaDays: 7,
      },
      {
        title: "Chào giá nhà cung cấp",
        criteria: "Tối thiểu 3 báo giá cho các hạng mục chiếm trên 10% giá trị.",
        role: "ADMIN",
        slaDays: 7,
      },
      {
        title: "Duyệt giá bỏ thầu",
        criteria: "Có bảng so sánh phương án giá và phê duyệt của lãnh đạo.",
        role: "OWNER",
        slaDays: 2,
        isGate: true,
      },
      {
        title: "Nộp hồ sơ",
        criteria: "Hồ sơ nộp trước hạn ít nhất 4 giờ; có biên nhận.",
        role: "ENGINEER",
        slaDays: 1,
      },
    ],
  },
];

async function main() {
  // Every org that has members, not just the first one: which demo user logs
  // in decides which org they see, and a procedure library that is empty for
  // the account someone actually uses has seeded nothing.
  const orgs = await prisma.organization.findMany({
    where: { members: { some: {} } },
    orderBy: { createdAt: "asc" },
  });
  if (orgs.length === 0) {
    console.error("Chưa có Organization nào có thành viên — chạy seed gốc trước.");
    process.exit(1);
  }

  for (const org of orgs) {
    await seedOrg(org.id, org.name);
  }
}

async function seedOrg(orgId: string, orgName: string) {
  for (const seed of TEMPLATES) {
    // Idempotent on (orgId, name): re-running replaces the steps rather than
    // stacking a second copy of every one.
    const existing = await prisma.processTemplate.findFirst({
      where: { orgId, name: seed.name },
    });
    const template = existing
      ? await prisma.processTemplate.update({
          where: { id: existing.id },
          data: {
            department: seed.department,
            kind: seed.kind,
            isoCode: seed.isoCode,
            description: seed.description,
          },
        })
      : await prisma.processTemplate.create({
          data: {
            orgId,
            name: seed.name,
            department: seed.department,
            kind: seed.kind,
            isoCode: seed.isoCode,
            description: seed.description,
          },
        });

    await prisma.processStep.deleteMany({ where: { templateId: template.id } });
    await prisma.processStep.createMany({
      data: seed.steps.map((step, index) => ({
        templateId: template.id,
        seq: index + 1,
        title: step.title,
        criteria: step.criteria,
        role: step.role,
        slaDays: step.slaDays,
        isGate: step.isGate ?? false,
      })),
    });
  }

  console.log(`  ✓ ${orgName}: ${TEMPLATES.length} quy trình`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
