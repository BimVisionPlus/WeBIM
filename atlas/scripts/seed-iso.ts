/**
 * Danh mục tài liệu ISO của công ty.
 *
 * Deliberately not a clean register: it carries one overdue review and one
 * superseded-but-still-effective pair, so the audit on /iso has something to
 * find. A demo register with zero findings demonstrates nothing about the
 * feature whose whole point is finding things.
 */
import { PrismaClient, type IsoDocKind, type ProjectDepartment } from "@prisma/client";

const prisma = new PrismaClient();

const TODAY = new Date("2026-08-12T00:00:00Z");
const day = (offset: number) => new Date(TODAY.getTime() + offset * 86_400_000);

interface Seed {
  code: string;
  title: string;
  kind: IsoDocKind;
  department: ProjectDepartment;
  version?: string;
  reviewOffset?: number | null;
  linkProcess?: string;
}

const DOCS: Seed[] = [
  { code: "ST-CL-01", title: "Sổ tay chất lượng", kind: "SO_TAY", department: "CONG_VIEC_KHAC", reviewOffset: 200 },
  { code: "CS-CL-01", title: "Chính sách chất lượng", kind: "CHINH_SACH", department: "CONG_VIEC_KHAC", reviewOffset: 300 },
  { code: "QT-TK-05", title: "Phát hành hồ sơ thiết kế cho CĐT", kind: "QUY_TRINH", department: "CONG_VIEC", reviewOffset: 120, linkProcess: "Phát hành hồ sơ thiết kế cho CĐT" },
  { code: "QT-HC-02", title: "Xử lý văn bản đến", kind: "QUY_TRINH", department: "HANH_CHINH", reviewOffset: -20, linkProcess: "Xử lý văn bản đến" },
  { code: "QT-TC-04", title: "Thanh toán khối lượng theo giai đoạn", kind: "QUY_TRINH", department: "TAI_CHINH_KE_TOAN", reviewOffset: 90, linkProcess: "Thanh toán khối lượng theo giai đoạn" },
  { code: "QT-DT-03", title: "Chuẩn bị hồ sơ dự thầu", kind: "QUY_TRINH", department: "DAU_THAU", reviewOffset: 150, linkProcess: "Chuẩn bị hồ sơ dự thầu" },
  { code: "QT-AT-01", title: "Quản lý an toàn lao động trên công trường", kind: "QUY_TRINH", department: "CONG_VIEC", reviewOffset: 60 },
  { code: "HD-BIM-01", title: "Hướng dẫn đặt tên file theo ISO 19650", kind: "HUONG_DAN", department: "CONG_VIEC", reviewOffset: 180 },
  { code: "BM-TK-05-01", title: "Biểu mẫu phiếu trình duyệt bản vẽ", kind: "BIEU_MAU", department: "CONG_VIEC", reviewOffset: null },
  { code: "BM-AT-01-02", title: "Biểu mẫu kiểm tra an toàn hằng ngày", kind: "BIEU_MAU", department: "CONG_VIEC", reviewOffset: null },
];

async function main() {
  const orgs = await prisma.organization.findMany({ where: { members: { some: {} } } });

  for (const org of orgs) {
    const templates = await prisma.processTemplate.findMany({ where: { orgId: org.id } });
    const templateByName = new Map(templates.map((t) => [t.name, t.id]));

    for (const seed of DOCS) {
      const version = seed.version ?? "02";
      await prisma.isoDocument.upsert({
        where: { orgId_code_version: { orgId: org.id, code: seed.code, version } },
        update: {},
        create: {
          orgId: org.id,
          code: seed.code,
          title: seed.title,
          kind: seed.kind,
          department: seed.department,
          scope: "COMPANY",
          version,
          status: "EFFECTIVE",
          issuedAt: day(-200),
          effectiveAt: day(-180),
          reviewDueAt: seed.reviewOffset === null ? null : day(seed.reviewOffset ?? 180),
          processTemplateId: seed.linkProcess ? templateByName.get(seed.linkProcess) ?? null : null,
        },
      });
    }

    // A v01 left effective under its v02 — the finding an auditor writes up.
    const current = await prisma.isoDocument.findUnique({
      where: { orgId_code_version: { orgId: org.id, code: "QT-TC-04", version: "02" } },
    });
    if (current) {
      const previous = await prisma.isoDocument.upsert({
        where: { orgId_code_version: { orgId: org.id, code: "QT-TC-04", version: "01" } },
        update: {},
        create: {
          orgId: org.id,
          code: "QT-TC-04",
          title: "Thanh toán khối lượng theo giai đoạn",
          kind: "QUY_TRINH",
          department: "TAI_CHINH_KE_TOAN",
          version: "01",
          status: "EFFECTIVE",
          issuedAt: day(-500),
          effectiveAt: day(-480),
          reviewDueAt: day(220),
        },
      });
      if (current.supersedesId !== previous.id) {
        await prisma.isoDocument.update({
          where: { id: current.id },
          data: { supersedesId: previous.id },
        });
      }
    }
    console.log(`  ✓ ${org.name}: ${DOCS.length + 1} tài liệu ISO`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
