// Seed dữ liệu demo cho Atlas AEC.
// Chạy: pnpm db:seed
//
// Tạo 4 user demo có thể đăng nhập với mật khẩu "demo1234!" — đủ để client
// xem flow ngay không cần signup. Cũng tạo sẵn AiSuggestion cho RFI #001 để
// panel "Gợi ý AI" có dữ liệu hiển thị kể cả khi Ollama chưa boot.

import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "demo1234!";

async function main() {
  // ─── Production-safety guard ────────────────────────────────────────────────
  // This seed wipes ALL tables (User, Org, Project, …) before re-creating demo
  // data. Running it against prod has nuked real signups before. Refuse unless
  // explicitly opted in.
  const dbUrl = process.env.DATABASE_URL ?? "";
  const looksProd =
    /neon\.tech|supabase\.co|amazonaws\.com|render\.com|railway\.app|aecplatform\.vn/i.test(dbUrl);
  if (looksProd && process.env.ALLOW_PROD_SEED !== "yes-wipe-everything") {
    console.error("❌ Refusing to seed: DATABASE_URL points at a production host.");
    console.error("   Host matched:", dbUrl.replace(/:[^@]+@/, ":***@"));
    console.error("   To override (DANGEROUS, wipes all users + orgs + projects):");
    console.error("     ALLOW_PROD_SEED=yes-wipe-everything pnpm db:seed");
    process.exit(2);
  }

  console.log("🌱 Seeding Atlas AEC demo data…");

  // Wipe (dev-only)
  await prisma.aiSuggestion.deleteMany();
  await prisma.transition.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.rFI.deleteMany();
  await prisma.submittal.deleteMany();
  await prisma.nCR.deleteMany();
  await prisma.punchItem.deleteMany();
  await prisma.changeOrder.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.dailyLog.deleteMany();
  await prisma.markup.deleteMany();
  await prisma.sheet.deleteMany();
  await prisma.drawingSet.deleteMany();
  await prisma.model.deleteMany();
  await prisma.signoff.deleteMany();
  await prisma.acceptance.deleteMany();
  await prisma.progressPayment.deleteMany();
  await prisma.specPage.deleteMany();
  // WinWork
  await prisma.bidComplianceCheck.deleteMany();
  await prisma.bidBond.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.tenderOpportunity.deleteMany();
  // CodeGuard
  await prisma.codeRuleFinding.deleteMany();
  await prisma.codeRule.deleteMany();
  await prisma.projectRegulation.deleteMany();
  await prisma.qualityDossierItem.deleteMany();
  await prisma.regulation.deleteMany();
  // Trust + GTM (idempotent)
  await prisma.modelCard.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.plan.deleteMany();
  // Layer 1.x extended (added in seed extension)
  await prisma.aiCostEvent.deleteMany();
  await prisma.driftSnapshot.deleteMany();
  await prisma.incidentReport.deleteMany();
  await prisma.visionEvent.deleteMany();
  await prisma.weatherSnapshot.deleteMany();
  await prisma.siteCamera.deleteMany();
  await prisma.materialPriceIndex.deleteMany();
  await prisma.boQLine.deleteMany();
  await prisma.boQ.deleteMany();
  await prisma.modelElement.deleteMany();
  await prisma.clash.deleteMany();
  await prisma.issueElementLink.deleteMany();
  // Crews + Catalog + Handover (new modules)
  await prisma.crewAssignment.deleteMany();
  await prisma.crew.deleteMany();
  await prisma.supplierCatalogItem.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.handoverTicket.deleteMany();
  // Schedule + Permit + PCCC (Wave 3/4 modules)
  await prisma.scheduleDependency.deleteMany();
  await prisma.scheduleTask.deleteMany();
  await prisma.permitChecklist.deleteMany();
  await prisma.permitApplication.deleteMany();
  await prisma.pcccApplication.deleteMany();
  // Org/User-scoped modules added after this cleanup was last updated. Each has a
  // REQUIRED FK with no onDelete: Cascade (Prisma default = Restrict), so the parent
  // delete throws P2003 when rows exist. Clear them before their parents below.
  // Children (TenderSection, Attendance) cascade via these, so no explicit delete.
  await prisma.tenderPackage.deleteMany(); // → Organization (TenderPackageOrg)
  await prisma.siteWorker.deleteMany(); // → Organization (WorkerOrg); cascades Attendance
  await prisma.consultantContract.deleteMany(); // → Organization (ConsultantContractTvOrg)
  await prisma.consultantTimesheet.deleteMany(); // → Organization (ConsultantTimeOrg)
  await prisma.invite.deleteMany(); // → User (InvitedBy)
  await prisma.projectStakeholder.deleteMany();
  await prisma.project.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // ─── Orgs ────────────────────────────────────────────────────────────────
  const vinhomes = await prisma.organization.create({
    data: { name: "Vinhomes JSC", slug: "vinhomes", type: "CHU_DAU_TU", mst: "0102671977" },
  });
  const cofico = await prisma.organization.create({
    data: { name: "CTCP Xây dựng Cofico", slug: "cofico", type: "NHA_THAU_CHINH", mst: "0301165620" },
  });
  const apaveAsia = await prisma.organization.create({
    data: { name: "Apave Asia-Pacific", slug: "apave", type: "TU_VAN_GIAM_SAT", mst: "0301467234" },
  });
  const aaCorp = await prisma.organization.create({
    data: { name: "AA Corporation — Thiết kế", slug: "aa-design", type: "TU_VAN_THIET_KE", mst: "0301443217" },
  });

  // ─── Users (đăng nhập demo: mật khẩu "demo1234!") ───────────────────────
  const pwHash = await hash(DEMO_PASSWORD, 10);
  const anh = await prisma.user.create({
    data: { email: "anh.nguyen@cofico.vn", name: "Nguyễn Văn Anh", phone: "0901234567", passwordHash: pwHash, emailVerified: new Date() },
  });
  const binh = await prisma.user.create({
    data: { email: "binh.tran@apave.com", name: "Trần Thị Bình", phone: "0907654321", passwordHash: pwHash, emailVerified: new Date() },
  });
  const cuong = await prisma.user.create({
    data: { email: "cuong.le@vinhomes.vn", name: "Lê Quốc Cường", phone: "0912345678", passwordHash: pwHash, emailVerified: new Date() },
  });
  const dung = await prisma.user.create({
    data: { email: "dung.pham@aa-design.com", name: "Phạm Mỹ Dung", phone: "0918765432", passwordHash: pwHash, emailVerified: new Date() },
  });

  await prisma.membership.createMany({
    data: [
      { userId: anh.id, orgId: cofico.id, role: "PROJECT_MGR" },
      { userId: binh.id, orgId: apaveAsia.id, role: "SUPERVISOR" },
      { userId: cuong.id, orgId: vinhomes.id, role: "OWNER" },
      { userId: dung.id, orgId: aaCorp.id, role: "ENGINEER" },
    ],
  });

  // ─── Project ─────────────────────────────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      key: "VHGP-S9",
      name: "Vinhomes Grand Park — Lô S9",
      ownerOrgId: vinhomes.id,
      address: "Đ. Nguyễn Xiển, P. Long Thạnh Mỹ, TP. Thủ Đức",
      province: "TP. HCM",
      district: "Thủ Đức",
      contractValueVnd: BigInt("1850000000000"), // 1.850 tỉ
      startDate: new Date("2025-09-01"),
      endDate: new Date("2027-12-31"),
      status: "IN_PROGRESS",
      department: "CONG_VIEC", // Viwase QLCV: dự án công việc của công ty
      permitNumber: "92/GPXD-SXD",
      permitDate: new Date("2025-07-15"),
      warrantyMonths: 24,
    },
  });

  await prisma.projectStakeholder.createMany({
    data: [
      { projectId: project.id, orgId: vinhomes.id, role: "CHU_DAU_TU" },
      { projectId: project.id, orgId: cofico.id, role: "NHA_THAU_CHINH" },
      { projectId: project.id, orgId: apaveAsia.id, role: "TU_VAN_GIAM_SAT" },
      { projectId: project.id, orgId: aaCorp.id, role: "TU_VAN_THIET_KE" },
    ],
  });

  // ─── Extra demo projects spread across 6 departments (Viwase QLCV) ────────
  // So all 7 tabs on the home page have visible content. ownerOrgId = cofico
  // so the demo user (Anh @cofico) sees them via the access filter.
  const extraProjects = [
    { key: "HLX-CC1", name: "Khu đô thị Hạ Long Xanh", dept: "CONG_VIEC", province: "Quảng Ninh", endDate: "2026-07-15", contractValueVnd: BigInt("980000000000") },
    { key: "VMM-Q9", name: "Vincom Mega Mall Q.9", dept: "CONG_VIEC", province: "TP. HCM", endDate: "2026-06-25", contractValueVnd: BigInt("520000000000") },
    { key: "BID-CC1-2026", name: "Gói thầu thi công CC1", dept: "DAU_THAU", province: "TP. HCM", endDate: "2026-06-10", contractValueVnd: BigInt("450000000000") },
    { key: "BID-IT-2026", name: "Cung cấp thiết bị IT 2026", dept: "DAU_THAU", province: "Hà Nội", endDate: "2026-07-01", contractValueVnd: BigInt("12000000000") },
    { key: "HC-HR-Q2", name: "Tuyển dụng & onboarding Q2", dept: "HANH_CHINH", province: "TP. HCM", endDate: "2026-06-30", contractValueVnd: null },
    { key: "HC-XE-2026", name: "Hệ thống điều phối xe", dept: "HANH_CHINH", province: "TP. HCM", endDate: "2026-08-15", contractValueVnd: null },
    { key: "TCKT-QTT-2025", name: "Quyết toán thuế năm 2025", dept: "TAI_CHINH_KE_TOAN", province: "TP. HCM", endDate: "2026-05-31", contractValueVnd: null },
    { key: "PTTT-MT-2026", name: "Phát triển thị trường miền Trung", dept: "PHAT_TRIEN_THI_TRUONG", province: "Đà Nẵng", endDate: "2026-09-30", contractValueVnd: BigInt("8000000000") },
    { key: "CVK-DHCD-2026", name: "Đại hội cổ đông thường niên 2026", dept: "CONG_VIEC_KHAC", province: "TP. HCM", endDate: "2026-06-20", contractValueVnd: null },
  ];
  for (const ep of extraProjects) {
    await prisma.project.create({
      data: {
        key: ep.key,
        name: ep.name,
        ownerOrgId: cofico.id,
        province: ep.province,
        contractValueVnd: ep.contractValueVnd ?? undefined,
        startDate: new Date("2026-01-15"),
        endDate: new Date(ep.endDate),
        status: "IN_PROGRESS",
        department: ep.dept as any,
        warrantyMonths: 12,
      },
    });
  }

  // ─── Drawing set & sheets ────────────────────────────────────────────────
  const ktSet = await prisma.drawingSet.create({
    data: {
      projectId: project.id,
      name: "Bộ Kiến trúc — IFC R3",
      discipline: "KIEN_TRUC",
      revision: "IFC",
      issuedDate: new Date("2026-03-01"),
      isCurrent: true,
    },
  });
  const sheetA201 = await prisma.sheet.create({
    data: {
      drawingSetId: ktSet.id,
      sheetNumber: "A-201",
      title: "Mặt bằng tầng điển hình (Tầng 5-25)",
      scale: "1:100",
      fileUrl: "drawings/vhgp-s9/A-201-R3.pdf",
      thumbnailUrl: "drawings/vhgp-s9/A-201-R3-thumb.webp",
      revision: "R3",
    },
  });
  await prisma.sheet.create({
    data: {
      drawingSetId: ktSet.id,
      sheetNumber: "A-301",
      title: "Mặt cắt A-A",
      scale: "1:50",
      fileUrl: "drawings/vhgp-s9/A-301-R3.pdf",
      revision: "R3",
    },
  });

  // ─── BIM model (federated) ───────────────────────────────────────────────
  await prisma.model.create({
    data: {
      projectId: project.id,
      name: "VHGP-S9_Federated_v12.nwd",
      fileUrl: "models/vhgp-s9/VHGP-S9_Federated_v12.nwd",
      fileSizeBytes: BigInt("847293821"),
      format: "NWD",
      apsUrn: "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6YXRsYXMtYWVjLW1vZGVscy9WSEdQLVM5X0ZlZGVyYXRlZF92MTIubndk",
      apsTranslationStatus: "SUCCESS",
      apsTranslationProgress: 100,
      revision: "v12",
      uploadedByUserId: anh.id,
    },
  });

  // ─── Issues: RFI + Submittal + NCR + Punch + Change Order ────────────────

  // RFI
  const rfiIssue = await prisma.issue.create({
    data: {
      key: "VHGP-S9-RFI-001",
      projectId: project.id,
      type: "RFI",
      title: "Làm rõ cao độ sàn tầng 12 — Trục A/F",
      description: "Bản vẽ A-201 R3 ghi cao độ +36.450 nhưng bảng cao độ tổng hợp ghi +36.500.",
      state: "OPEN",
      priority: "HIGH",
      reporterId: anh.id,
      assigneeId: dung.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      locationZone: "Tầng 12 — Trục A/F",
      sheetId: sheetA201.id,
      rfi: {
        create: {
          question: "Cao độ chuẩn cho tầng 12 trục A/F là +36.450 hay +36.500?",
          category: "Kiến trúc",
          requestedById: cofico.id,
          respondedById: aaCorp.id,
          needBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          scheduleImpactDays: 2,
        },
      },
    },
  });

  // Submittal
  await prisma.issue.create({
    data: {
      key: "VHGP-S9-SUB-001",
      projectId: project.id,
      type: "SUBMITTAL",
      title: "Mẫu vật liệu — Bê tông M300 (Holcim)",
      description: "Submit kết quả thí nghiệm nén 7-28 ngày + chứng chỉ xuất xưởng.",
      state: "UNDER_REVIEW",
      priority: "MEDIUM",
      reporterId: anh.id,
      assigneeId: binh.id,
      submittal: {
        create: {
          specSection: "03 30 00 — Cast-in-Place Concrete",
          materialName: "Bê tông thương phẩm M300",
          manufacturer: "Holcim Việt Nam",
          submitterOrgId: cofico.id,
          reviewerOrgId: apaveAsia.id,
          revision: 0,
        },
      },
    },
  });

  // NCR
  await prisma.issue.create({
    data: {
      key: "VHGP-S9-NCR-001",
      projectId: project.id,
      type: "NCR",
      title: "Cốt thép tầng 12 — sai đường kính ở trục C",
      description: "Phát hiện thép D16 thay vì D18 theo TKBVTC tại 6 vị trí.",
      state: "ROOT_CAUSE",
      priority: "CRITICAL",
      reporterId: binh.id,
      assigneeId: anh.id,
      locationZone: "Tầng 12 — Trục C",
      ncr: {
        create: {
          severity: "MAJOR",
          raisedByOrgId: apaveAsia.id,
          responsibleOrgId: cofico.id,
          rootCause: "Lỗi tổ thép — đọc nhầm bản vẽ R2 (đã supersede bởi R3).",
          qcvnRef: "TCVN 5574:2018 §8.3",
        },
      },
    },
  });

  // Punch list
  await prisma.issue.create({
    data: {
      key: "VHGP-S9-PUNCH-001",
      projectId: project.id,
      type: "PUNCH",
      title: "Căn 12A-05 — sơn tường loang lổ phòng khách",
      state: "IN_PROGRESS",
      priority: "LOW",
      reporterId: cuong.id,
      assigneeId: anh.id,
      punchItem: {
        create: {
          trade: "Sơn",
          zone: "Căn 12A-05 — Phòng khách",
        },
      },
    },
  });

  // Change Order
  await prisma.issue.create({
    data: {
      key: "VHGP-S9-CO-001",
      projectId: project.id,
      type: "CHANGE_ORDER",
      title: "Đổi vật liệu lát hành lang — Granite → Đá Bazan",
      state: "CDT_REVIEW",
      priority: "MEDIUM",
      reporterId: cuong.id,
      assigneeId: anh.id,
      changeOrder: {
        create: {
          reason: "CĐT yêu cầu nâng chuẩn nội thất",
          scopeChange: "Toàn bộ hành lang căn hộ block S9.01 → S9.04",
          costDeltaVnd: BigInt("1240000000"),
          scheduleDeltaDays: 5,
        },
      },
    },
  });

  // ─── Daily Log ───────────────────────────────────────────────────────────
  await prisma.dailyLog.create({
    data: {
      projectId: project.id,
      date: new Date(),
      authorId: anh.id,
      weather: "Nắng 32°C, không mưa",
      shift: "DAY",
      workforce: [
        { trade: "Thợ sắt", count: 24 },
        { trade: "Thợ bê tông", count: 16 },
        { trade: "Thợ điện", count: 8 },
        { trade: "Thợ phụ", count: 12 },
      ],
      workDone: "Đổ bê tông sàn tầng 12 phân khu A. Lắp cốt thép tường cột tầng 13.",
      workTomorrow: "Đổ bê tông tường cột tầng 13 phân khu A.",
      safetyNotes: "Không có sự cố. Toolbox-talk 7h sáng — chủ đề: an toàn vận thăng.",
    },
  });

  // ─── Acceptance (Nghiệm thu công việc) ───────────────────────────────────
  const bbnt = await prisma.acceptance.create({
    data: {
      projectId: project.id,
      type: "CONG_VIEC",
      code: "BBNT-CV-T12-001",
      title: "Nghiệm thu cốt thép sàn tầng 12 — Phân khu A",
      state: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      qcvnRefs: ["TCVN 5574:2018", "TCVN 1651-2:2018"],
    },
  });
  await prisma.signoff.createMany({
    data: [
      { acceptanceId: bbnt.id, userId: cuong.id, role: "CHU_DAU_TU" },
      { acceptanceId: bbnt.id, userId: binh.id, role: "TU_VAN_GIAM_SAT" },
      { acceptanceId: bbnt.id, userId: anh.id, role: "NHA_THAU_CHINH" },
    ],
  });

  // ─── Progress Payment ────────────────────────────────────────────────────
  await prisma.progressPayment.create({
    data: {
      projectId: project.id,
      period: "2026-04",
      workDoneVnd: BigInt("48720000000"),
      vatRate: 8,
      vatVnd: BigInt("3897600000"),
      retentionPct: 5,
      retentionVnd: BigInt("2436000000"),
      cumulativeVnd: BigInt("324500000000"),
      state: "CDT_REVIEW",
      submittedAt: new Date(),
    },
  });

  // ─── Spec pages (sẽ được embed lazy bởi /api/specs/* khi user edit) ──────
  // Để demo, ta seed body — embedding sẽ trống cho đến khi user vào trang spec
  // và resave, hoặc gọi một admin re-embed job. Vẫn xem được nội dung.
  await prisma.specPage.createMany({
    data: [
      {
        projectId: project.id,
        slug: "bien-phap-thi-cong-cot-thep",
        title: "Biện pháp thi công cốt thép tầng cao",
        authorId: dung.id,
        body:
          "## Phạm vi\n" +
          "Áp dụng cho lắp dựng cốt thép sàn, dầm, cột từ tầng 5 trở lên.\n\n" +
          "## Quy trình\n" +
          "1. Kiểm tra mác thép theo chứng chỉ xuất xưởng (TCVN 1651-2:2018).\n" +
          "2. Gia công cốt thép tại bãi tập kết, đánh số theo bản vẽ shop drawing.\n" +
          "3. Vận chuyển bằng cẩu tháp — không quá 200kg/lần.\n" +
          "4. Lắp dựng theo thứ tự cột → dầm → sàn.\n" +
          "5. Nghiệm thu cốt thép trước khi đổ bê tông theo TCVN 5574:2018.\n\n" +
          "## Tham chiếu\n" +
          "- TCVN 1651-2:2018 §5.3 — Thép cốt bê tông\n" +
          "- TCVN 5574:2018 §8.3 — Kiểm tra cốt thép\n" +
          "- NĐ 06/2021/NĐ-CP Điều 21 — Nghiệm thu công việc",
      },
      {
        projectId: project.id,
        slug: "biện-phap-thi-cong-be-tong-thuong-pham",
        title: "Biện pháp thi công bê tông thương phẩm M300",
        authorId: dung.id,
        body:
          "## Phạm vi\n" +
          "Đổ bê tông sàn, dầm, cột bê tông thương phẩm M300, slump 12±2cm.\n\n" +
          "## Tiêu chuẩn vật liệu\n" +
          "- Cường độ 28 ngày ≥ 300 daN/cm² (TCVN 3118:1993).\n" +
          "- Slump test mỗi xe (TCVN 3106:1993).\n" +
          "- Mẫu nén 3 tổ × 3 viên / 100m³ (TCVN 4453:1995 §6).\n\n" +
          "## Quy trình\n" +
          "1. Kiểm tra cốp pha, cốt thép — có BBNT cốt thép.\n" +
          "2. Xe bơm bê tông tới hiện trường < 45 phút.\n" +
          "3. Đổ liên tục, đầm dùi tránh phân tầng.\n" +
          "4. Bảo dưỡng ẩm 7 ngày, không tải trong 24h.\n\n" +
          "## Cao độ\n" +
          "Cao độ sàn các tầng tham chiếu bảng cao độ tổng hợp v3 đã được CĐT phê duyệt 15/03/2026. Riêng tầng 12 trục A/F là +36.500 (sửa từ +36.450 của bản vẽ A-201 R3).\n\n" +
          "## Tham chiếu\n" +
          "- TCVN 4453:1995 — Thi công bê tông\n" +
          "- QCVN 04-01:2023/BXD §6.3 — Cao độ kiến trúc",
      },
      {
        projectId: project.id,
        slug: "qcvn-pccc-hanh-lang-thoat-hiem",
        title: "QCVN PCCC — Hành lang và lối thoát hiểm",
        authorId: dung.id,
        body:
          "## Tóm tắt\n" +
          "Yêu cầu thiết kế hành lang, cầu thang thoát hiểm theo QCVN 06:2022/BXD.\n\n" +
          "## Chiều rộng tối thiểu\n" +
          "- Hành lang căn hộ: ≥ 1.5m (QCVN 06:2022/BXD §3.2.1).\n" +
          "- Cầu thang thoát hiểm: ≥ 1.2m, độ dốc ≤ 1:1.5.\n" +
          "- Cửa thoát hiểm: rộng ≥ 0.9m, mở chiều thoát nạn.\n\n" +
          "## Vật liệu\n" +
          "- Tường ngăn cầu thang: bậc chịu lửa REI 120.\n" +
          "- Cửa: EI 60, có cơ cấu tự đóng.\n\n" +
          "## Đèn báo và biển chỉ dẫn\n" +
          "Mọi đèn chỉ dẫn thoát nạn duy trì ≥ 90 phút khi mất điện.\n\n" +
          "## Tham chiếu\n" +
          "- QCVN 06:2022/BXD §3.2 — Lối thoát nạn\n" +
          "- TCVN 3890:2009 — Hệ thống báo cháy",
      },
    ],
  });

  // ─── CodeGuard — TCVN/QCVN baseline + dossier per NĐ 15/2021 ──────────────
  // Inline the curated seed list (canonical source: packages/lib/src/codeguard/registry.ts).
  const cgRegs: Array<{
    code: string;
    kind: "TCVN" | "QCVN" | "LUAT" | "NGHI_DINH" | "THONG_TU" | "QUYET_DINH" | "CONG_VAN";
    title: string;
    issuedBy?: string;
    effectiveAt?: string;
    tags?: string[];
    rules?: Array<{ code: string; clauseRef: string; title: string; description?: string; severity: "INFO" | "WARNING" | "BLOCKING"; category?: string; check?: any }>;
  }> = [
    {
      code: "QCVN 06:2022/BXD",
      kind: "QCVN",
      title: "Quy chuẩn quốc gia về an toàn cháy cho nhà và công trình",
      issuedBy: "Bộ Xây dựng",
      effectiveAt: "2023-01-16",
      tags: ["PCCC", "an toàn cháy"],
      rules: [
        { code: "QCVN-06-3.2.1", clauseRef: "§3.2.1", title: "Chiều rộng hành lang căn hộ", description: "Hành lang căn hộ chung cư ≥ 1.5 m.", severity: "BLOCKING", category: "PCCC", check: { dimension: "corridor_width_m", op: ">=", value: 1.5 } },
        { code: "QCVN-06-3.2.4", clauseRef: "§3.2.4", title: "Cầu thang thoát hiểm", description: "Cầu thang thoát hiểm: rộng ≥ 1.2 m, độ dốc ≤ 1:1.5.", severity: "BLOCKING", category: "PCCC", check: { dimension: "exit_stair_width_m", op: ">=", value: 1.2 } },
        { code: "QCVN-06-3.4.1", clauseRef: "§3.4.1", title: "Bậc chịu lửa tường ngăn cầu thang", description: "REI 120.", severity: "BLOCKING", category: "PCCC" },
      ],
    },
    { code: "QCVN 04:2021/BXD", kind: "QCVN", title: "Quy chuẩn quốc gia về nhà chung cư", issuedBy: "Bộ Xây dựng", effectiveAt: "2021-12-30", tags: ["chung cư"] },
    { code: "QCVN 10:2014/BXD", kind: "QCVN", title: "Xây dựng công trình đảm bảo tiếp cận sử dụng", issuedBy: "Bộ Xây dựng", tags: ["tiếp cận"] },
    { code: "TCVN 5574:2018", kind: "TCVN", title: "Thiết kế kết cấu bê tông và bê tông cốt thép", issuedBy: "Bộ KH&CN", effectiveAt: "2018-12-26", tags: ["kết cấu"], rules: [
      { code: "TCVN-5574-10.3.1", clauseRef: "§10.3.1", title: "Lớp bê tông bảo vệ cốt thép cột", description: "≥ 25mm (môi trường thông thường).", severity: "WARNING", category: "kết cấu", check: { dimension: "rebar_cover_mm", op: ">=", value: 25 } },
    ]},
    { code: "TCVN 2737:2023", kind: "TCVN", title: "Tải trọng và tác động — Tiêu chuẩn thiết kế", issuedBy: "Bộ KH&CN", tags: ["tải trọng"] },
    { code: "TCVN 7888:2014", kind: "TCVN", title: "Cốt thép cho bê tông — Thép thanh", issuedBy: "Bộ KH&CN", tags: ["vật liệu"] },
    { code: "TCVN 9362:2012", kind: "TCVN", title: "Thiết kế nền nhà và công trình", issuedBy: "Bộ KH&CN", tags: ["nền móng"] },
    { code: "TCVN 4453:1995", kind: "TCVN", title: "Bê tông cốt thép toàn khối — Thi công và nghiệm thu", issuedBy: "Bộ Xây dựng", tags: ["thi công"] },
    { code: "NĐ 06/2021/NĐ-CP", kind: "NGHI_DINH", title: "Quản lý chất lượng, thi công và bảo trì công trình", issuedBy: "Chính phủ", effectiveAt: "2021-01-26", tags: ["chất lượng"] },
    { code: "NĐ 15/2021/NĐ-CP", kind: "NGHI_DINH", title: "Quản lý dự án đầu tư xây dựng", issuedBy: "Chính phủ", effectiveAt: "2021-03-03", tags: ["quản lý dự án"] },
  ];

  for (const reg of cgRegs) {
    const r = await prisma.regulation.create({
      data: {
        code: reg.code,
        kind: reg.kind,
        title: reg.title,
        issuedBy: reg.issuedBy,
        effectiveAt: reg.effectiveAt ? new Date(reg.effectiveAt) : null,
        tags: reg.tags ?? [],
        status: "IN_FORCE",
      },
    });
    if (reg.rules?.length) {
      await prisma.codeRule.createMany({
        data: reg.rules.map((rule) => ({
          regulationId: r.id,
          code: rule.code,
          clauseRef: rule.clauseRef,
          title: rule.title,
          description: rule.description,
          severity: rule.severity,
          category: rule.category,
          check: rule.check as any,
        })),
      });
    }
  }
  const codesToApply = ["QCVN 06:2022/BXD", "QCVN 04:2021/BXD", "TCVN 5574:2018", "NĐ 06/2021/NĐ-CP", "NĐ 15/2021/NĐ-CP"];
  const applicable = await prisma.regulation.findMany({ where: { code: { in: codesToApply } } });
  await prisma.projectRegulation.createMany({
    data: applicable.map((a) => ({ projectId: project.id, regulationId: a.id, required: true })),
  });

  const dossierTpl = [
    { category: "KHAO_SAT" as const, itemCode: "I.A.1", itemTitle: "Báo cáo khảo sát địa chất", required: true },
    { category: "KHAO_SAT" as const, itemCode: "I.A.2", itemTitle: "Báo cáo khảo sát địa hình", required: true },
    { category: "KHAO_SAT" as const, itemCode: "I.A.3", itemTitle: "Báo cáo khảo sát thuỷ văn", required: false },
    { category: "THIET_KE" as const, itemCode: "I.B.1", itemTitle: "Thuyết minh thiết kế cơ sở", required: true },
    { category: "THIET_KE" as const, itemCode: "I.B.2", itemTitle: "Bản vẽ thiết kế kỹ thuật / thi công", required: true },
    { category: "THIET_KE" as const, itemCode: "I.B.3", itemTitle: "Báo cáo thẩm tra thiết kế", required: true },
    { category: "THIET_KE" as const, itemCode: "I.B.4", itemTitle: "Văn bản phê duyệt thiết kế", required: true },
    { category: "THI_CONG" as const, itemCode: "I.C.1", itemTitle: "Giấy phép xây dựng", required: true },
    { category: "THI_CONG" as const, itemCode: "I.C.2", itemTitle: "Biện pháp tổ chức thi công đã phê duyệt", required: true },
    { category: "THI_CONG" as const, itemCode: "I.C.3", itemTitle: "Nhật ký thi công", required: true },
    { category: "THI_CONG" as const, itemCode: "I.C.4", itemTitle: "Kết quả thí nghiệm vật liệu", required: true },
    { category: "THI_CONG" as const, itemCode: "I.C.5", itemTitle: "Hợp đồng và phụ lục thi công", required: true },
    { category: "NGHIEM_THU" as const, itemCode: "I.D.1", itemTitle: "BBNT công việc (Điều 21)", required: true },
    { category: "NGHIEM_THU" as const, itemCode: "I.D.2", itemTitle: "BBNT giai đoạn / bộ phận (Điều 22)", required: true },
    { category: "NGHIEM_THU" as const, itemCode: "I.D.3", itemTitle: "BBNT hoàn thành (Điều 23)", required: true },
    { category: "NGHIEM_THU" as const, itemCode: "I.D.4", itemTitle: "Văn bản chấp thuận PCCC", required: true },
    { category: "HOAN_CONG" as const, itemCode: "I.E.1", itemTitle: "Bản vẽ hoàn công", required: true },
    { category: "HOAN_CONG" as const, itemCode: "I.E.2", itemTitle: "Báo cáo chất lượng công trình", required: true },
    { category: "HOAN_CONG" as const, itemCode: "I.E.3", itemTitle: "Hồ sơ bảo hành", required: true },
  ];
  await prisma.qualityDossierItem.createMany({
    data: dossierTpl.map((t, i) => ({
      projectId: project.id,
      category: t.category,
      itemCode: t.itemCode,
      itemTitle: t.itemTitle,
      required: t.required,
      status: (i < 3 ? "ACCEPTED" : i < 6 ? "SUBMITTED" : "MISSING") as any,
      uploadedAt: i < 6 ? new Date() : null,
    })),
  });

  // ─── WinWork — Bidding Intelligence demo ────────────────────────────────
  // 3 tender opportunities (1 muasamcong, 1 dauthau.asia, 1 manual), 2 bids
  // — one DRAFT, one READY with active bid bond — and an initial compliance
  // run on the READY bid so the UI lights up immediately after `db:seed`.
  const tender1 = await prisma.tenderOpportunity.create({
    data: {
      source: "MUASAMCONG",
      sourceUrl: "https://muasamcong.mpi.gov.vn/",
      sourceRef: "TBMT-2026-0428",
      title: "Gói thầu XL-04: Thi công phần ngầm khối căn hộ B3 — KĐT Vinhomes Ocean Park 2",
      invitor: "CTCP Vinhomes",
      invitorMst: "0102671977",
      budgetVnd: BigInt("420000000000"),
      fundingSource: "Vốn tư nhân",
      category: "Xây lắp",
      province: "Hưng Yên",
      district: "Văn Giang",
      publishedAt: new Date("2026-05-02"),
      closingAt: new Date("2026-06-02T09:00:00"),
      openingAt: new Date("2026-06-02T10:00:00"),
      bidMethod: "Đấu thầu rộng rãi",
      bidForm: "1GĐ-2TH",
      contractType: "Đơn giá điều chỉnh",
      rawHash: "seed-tender-muasamcong-0428",
    },
  });
  await prisma.tenderOpportunity.create({
    data: {
      source: "DAUTHAU_ASIA",
      sourceUrl: "https://dauthau.asia/",
      sourceRef: "DTA-2026-1119",
      title: "Cung cấp & lắp đặt hệ thống PCCC — Trung tâm thương mại Bình Tân",
      invitor: "Sở Xây dựng TP.HCM",
      invitorMst: "0301443711",
      budgetVnd: BigInt("48500000000"),
      fundingSource: "Vốn ngân sách",
      category: "Hỗn hợp",
      province: "TP. HCM",
      district: "Bình Tân",
      publishedAt: new Date("2026-05-10"),
      closingAt: new Date("2026-05-30T15:00:00"),
      bidMethod: "Đấu thầu rộng rãi",
      contractType: "Trọn gói",
      rawHash: "seed-tender-dauthau-1119",
    },
  });
  await prisma.tenderOpportunity.create({
    data: {
      source: "MANUAL",
      title: "Sửa chữa, cải tạo trụ sở UBND quận Phú Nhuận",
      invitor: "UBND quận Phú Nhuận",
      invitorMst: "0301165811",
      budgetVnd: BigInt("8200000000"),
      fundingSource: "Vốn ngân sách",
      category: "Xây lắp",
      province: "TP. HCM",
      district: "Phú Nhuận",
      publishedAt: new Date("2026-05-14"),
      closingAt: new Date("2026-06-12T10:00:00"),
      bidMethod: "Chào hàng cạnh tranh",
      contractType: "Trọn gói",
      rawHash: "seed-tender-manual-phunhuan",
    },
  });

  const bid1 = await prisma.bid.create({
    data: {
      key: "BID-COFICO-001",
      orgId: cofico.id,
      opportunityId: tender1.id,
      title: tender1.title,
      state: "READY",
      ownerUserId: anh.id,
      estimatedValueVnd: BigInt("390000000000"),
      proposedValueVnd: BigInt("412000000000"),
      marginPct: 5.6,
      contingencyPct: 3.0,
      technicalScore: 88,
    },
  });
  // Active bid bond for bid1 — 2% × 420 tỉ = 8.4 tỉ
  await prisma.bidBond.create({
    data: {
      bidId: bid1.id,
      type: "BAO_LANH_DU_THAU",
      issuerBank: "Vietcombank — CN Sài Gòn",
      bondNumber: "BL/2026/VCB/0428",
      amountVnd: BigInt("8400000000"),
      issuedAt: new Date("2026-05-08"),
      expiresAt: new Date("2026-08-01"), // > openingAt + 30d (60d typical)
      feeVnd: BigInt("21000000"),
      status: "ACTIVE",
    },
  });
  // Seed two compliance check rows so the UI shows "Đạt" right away
  await prisma.bidComplianceCheck.createMany({
    data: [
      {
        bidId: bid1.id,
        ruleId: "LDT22-14-1",
        ruleVersion: "LDT-22-2023",
        ruleTitle: "Bảo đảm dự thầu (bid bond)",
        ruleRef: "Luật ĐT 22/2023 Điều 14",
        severity: "BLOCKING",
        status: "PASS",
        evidence: { bondAmountVnd: "8400000000", budgetVnd: "420000000000" } as any,
      },
      {
        bidId: bid1.id,
        ruleId: "LDT22-14-4",
        ruleVersion: "LDT-22-2023",
        ruleTitle: "Mức bảo đảm dự thầu (1%–3% giá gói thầu)",
        ruleRef: "Luật ĐT 22/2023 Điều 14 khoản 4",
        severity: "WARNING",
        status: "PASS",
        evidence: { bondVnd: "8400000000", minVnd: "4200000000", maxVnd: "12600000000" } as any,
      },
      {
        bidId: bid1.id,
        ruleId: "LDT22-5-1",
        ruleVersion: "LDT-22-2023",
        ruleTitle: "Tư cách hợp lệ nhà thầu (MST)",
        ruleRef: "Luật ĐT 22/2023 Điều 5",
        severity: "BLOCKING",
        status: "PASS",
        evidence: { mst: "0301165620" } as any,
      },
    ],
  });

  await prisma.bid.create({
    data: {
      key: "BID-COFICO-002",
      orgId: cofico.id,
      title: "Hệ thống điện & ME — Tòa văn phòng Phú Mỹ Hưng",
      state: "DRAFT",
      ownerUserId: anh.id,
      estimatedValueVnd: BigInt("28000000000"),
    },
  });

  // ─── AI suggestion demo cho RFI #001 ─────────────────────────────────────
  // Để khung "Gợi ý AI" trên trang RFI có dữ liệu hiển thị ngay cả khi Ollama
  // chưa boot — client thấy được tính năng end-to-end ngay trong demo.
  await prisma.aiSuggestion.create({
    data: {
      kind: "rfi.classify",
      entityType: "Issue",
      entityId: rfiIssue.id,
      projectId: project.id,
      model: "qwen2.5:7b-instruct (seed)",
      ok: true,
      latencyMs: 1842,
      output: {
        category: "Kiến trúc",
        priority: "HIGH",
        reason: "Sai lệch cao độ giữa bản vẽ A-201 R3 và bảng tổng hợp ảnh hưởng cốt thép tầng 12 đã chuẩn bị thi công; cần làm rõ trong 48h để tránh dừng tổ thép.",
        costRiskVnd: 85_000_000,
        scheduleRiskDays: 2,
      } as any,
    },
  });
  await prisma.aiSuggestion.create({
    data: {
      kind: "rfi.draft_answer",
      entityType: "Issue",
      entityId: rfiIssue.id,
      projectId: project.id,
      model: "qwen2.5:7b-instruct (seed)",
      ok: true,
      latencyMs: 4317,
      output: {
        draftAnswer:
          "Cao độ chuẩn tầng 12 trục A/F là +36.500 theo bảng cao độ tổng hợp đã được CĐT phê duyệt ngày 15/03/2026. " +
          "Bản vẽ A-201 R3 ghi +36.450 là sai sót cần sửa, AA Corp sẽ phát hành A-201 R4 trong 24h. " +
          "Đề nghị nhà thầu tạm dừng lắp cốt thép tầng 12 phân khu A đến khi nhận R4.",
        references: [
          "QCVN 04-01:2023/BXD §6.3.2",
          "TCVN 4453:1995 §4.2",
          "Bảng cao độ tổng hợp v3 (15/03/2026)",
        ],
        confidence: "high",
        caveats: "Cần TVTK (AA Corp) phát hành A-201 R4 chính thức trước khi NT tiếp tục thi công.",
      } as any,
    },
  });

  // ─── Trust layer — public model cards (Layer 4 seed) ─────────────────────
  await prisma.modelCard.createMany({
    data: [
      {
        feature: "rfi.classify",
        modelName: "qwen2.5:7b-instruct",
        modelVersion: "2025-10",
        intendedUse: "Phân loại RFI theo chuyên ngành (KT/KC/MEP/ATLĐ) và mức ưu tiên dựa trên nội dung tiếng Việt.",
        trainingDataSummary: "Mô hình OSS Qwen 2.5 7B (Alibaba) chạy tự host bằng Ollama. Atlas chỉ dùng zero-shot, không fine-tune.",
        limitations: "Có thể nhầm RFI có ngữ cảnh chuyên sâu MEP cao tầng. Engineer luôn xác nhận.",
        datasetCitations: ["alibaba/qwen2.5-7b (open weights)"],
      },
      {
        feature: "ncr.assess_photo",
        modelName: "qwen2.5-vl:7b",
        modelVersion: "2025-10",
        intendedUse: "VLM đánh giá ảnh sai khác chất lượng theo NĐ 06/2021 Điều 12 (MINOR/MAJOR/CRITICAL).",
        trainingDataSummary: "Qwen2.5-VL OSS weights, tự host. Suggestion-only, TVGS phải xác nhận.",
        limitations: "Ảnh thiếu ánh sáng / chụp xa khó đánh giá chính xác.",
        datasetCitations: ["alibaba/qwen2.5-vl-7b"],
      },
      {
        feature: "siteeye.ppe",
        modelName: "qwen2.5-vl:7b (PPE prompt)",
        modelVersion: "2025-10",
        intendedUse: "Phát hiện vi phạm PPE (mũ, áo phản quang, dây an toàn) từ frame camera.",
        trainingDataSummary: "VLM zero-shot. Production sẽ chuyển sang YOLOv8 PPE weights.",
        limitations: "Người trong bóng / khuất một phần có thể không nhận diện.",
        datasetCitations: ["alibaba/qwen2.5-vl-7b"],
      },
      {
        feature: "daily_log.transcribe",
        modelName: "faster-whisper-medium",
        modelVersion: "2025-09",
        intendedUse: "Chuyển voice memo công trường (tiếng Việt) → text để dựng nhật ký.",
        trainingDataSummary: "OpenAI Whisper medium (OSS weights) via faster-whisper, tự host.",
        limitations: "Tiếng địa phương mạnh / nhiễu công trường có thể giảm độ chính xác.",
        datasetCitations: ["OpenAI/whisper-medium"],
      },
      {
        feature: "spec.embed",
        modelName: "bge-m3",
        modelVersion: "2024-07",
        intendedUse: "Embedding tiếng Việt + tiếng Anh cho RAG trên SpecPage.",
        trainingDataSummary: "BAAI bge-m3 OSS — multilingual, 1024 dim.",
        limitations: "Không tối ưu cho tiếng địa phương cực mạnh.",
        datasetCitations: ["BAAI/bge-m3"],
      },
    ],
  });

  // ─── Plans (Layer 8 GTM) ─────────────────────────────────────────────────
  await prisma.plan.createMany({
    data: [
      {
        code: "free",
        name: "Free",
        pricingJson: { priceMonthlyVnd: 0, aiActionVnd: 500 } as any,
        features: {
          bullets: [
            "5 user · 1 dự án",
            "Site + Models + Specs",
            "Đăng nhập + audit log",
            "Pay-per-AI-action 500đ/lần",
          ],
        } as any,
      },
      {
        code: "pro",
        name: "Pro",
        pricingJson: { priceMonthlyVnd: 290000, aiActionVnd: 300, featured: true } as any,
        features: {
          bullets: [
            "User không giới hạn · dự án không giới hạn",
            "WinWork + CodeGuard + DrawBridge",
            "SiteEye CV + Weather alert",
            "AI actions giảm còn 300đ/lần",
            "Zalo OA + e-invoice TT 78/2021",
          ],
        } as any,
      },
      {
        code: "business",
        name: "Business",
        pricingJson: { priceMonthlyVnd: 690000, aiActionVnd: 200 } as any,
        features: {
          bullets: [
            "Mọi tính năng Pro",
            "CostPulse EVM + ProjectPulse portfolio",
            "Agent (PM/Cost/Safety) goal-oriented",
            "API + webhook + MISA/Base connector",
            "Drift detection + bias audit",
          ],
        } as any,
      },
      {
        code: "enterprise",
        name: "Enterprise",
        pricingJson: { priceMonthlyVnd: 0, aiActionVnd: 0 } as any,
        features: {
          bullets: [
            "On-prem / VPC tại VN (sovereign cloud)",
            "ISO 27001 + NCSC compliance",
            "SSO SAML + custom RBAC",
            "Tuỳ chỉnh model + private skill marketplace",
            "Báo giá riêng",
          ],
        } as any,
      },
    ],
  });

  // ─── Extended demo data (for smoke flow + slide demo) ───────────────────
  // 8 BIM elements + 9-line BoQ + 4 incidents + 7 PPE events + drift snapshots.
  const cofiBidId1 = (await prisma.bid.findFirst({ where: { key: "BID-COFICO-001" } }))?.id;

  // BIM elements (anchored to the federated model)
  const fedModel = await prisma.model.findFirst({ where: { projectId: project.id } });
  if (fedModel) {
    await prisma.modelElement.createMany({
      data: [
        { modelId: fedModel.id, elementId: "GLB-001", name: "Cột C-12 tầng 5", category: "Cột", discipline: "KET_CAU", level: "Tầng 5", zone: "Khu A", ifcType: "IfcColumn", bbox: [10.0, 10.0, 18.0, 10.6, 10.6, 21.0] },
        { modelId: fedModel.id, elementId: "GLB-002", name: "Cột C-13 tầng 5", category: "Cột", discipline: "KET_CAU", level: "Tầng 5", zone: "Khu A", ifcType: "IfcColumn", bbox: [18.0, 10.0, 18.0, 18.6, 10.6, 21.0] },
        { modelId: fedModel.id, elementId: "GLB-003", name: "Dầm B-3 tầng 5", category: "Dầm", discipline: "KET_CAU", level: "Tầng 5", zone: "Khu A", ifcType: "IfcBeam", bbox: [10.0, 10.0, 20.4, 18.6, 10.4, 21.0] },
        { modelId: fedModel.id, elementId: "MEP-001", name: "Ống HVAC Φ400", category: "MEP-Pipe", discipline: "CO_DIEN_M", level: "Tầng 5", zone: "Khu A", ifcType: "IfcPipeSegment", bbox: [12.0, 9.8, 20.5, 16.0, 10.2, 20.9] },
        { modelId: fedModel.id, elementId: "MEP-002", name: "Ống PCCC DN150", category: "MEP-Pipe", discipline: "PCCC", level: "Tầng 5", zone: "Khu A", ifcType: "IfcPipeSegment", bbox: [11.5, 10.0, 20.7, 15.5, 10.4, 21.1] },
        { modelId: fedModel.id, elementId: "MEP-003", name: "Ống thoát PVC DN110", category: "MEP-Pipe", discipline: "CO_DIEN_P", level: "Tầng 5", zone: "Khu B", ifcType: "IfcPipeSegment", bbox: [30.0, 10.0, 20.5, 33.0, 10.5, 20.8] },
        { modelId: fedModel.id, elementId: "ARC-001", name: "Tường W-1 12A", category: "Tường", discipline: "KIEN_TRUC", level: "Tầng 5", zone: "Khu B", ifcType: "IfcWall", bbox: [25.0, 10.0, 18.0, 25.2, 18.0, 21.0] },
        { modelId: fedModel.id, elementId: "ARC-002", name: "Sàn tầng 5", category: "Sàn", discipline: "KIEN_TRUC", level: "Tầng 5", zone: "Toàn tầng", ifcType: "IfcSlab", bbox: [0.0, 0.0, 20.8, 40.0, 20.0, 21.0] },
      ],
    });
  }

  // BoQ + lines + a material price index row for HCM
  const boq = await prisma.boQ.create({
    data: {
      projectId: project.id,
      name: "BoQ hợp đồng thi công chính — Vinhomes Grand Park S9",
      contractValueVnd: BigInt("1850000000000"),
      version: "v1",
      isCurrent: true,
    },
  });
  await prisma.boQLine.createMany({
    data: [
      { boqId: boq.id, code: "1.1", description: "Bê tông móng M300", unit: "m³", qty: 5400, unitPriceVnd: BigInt(1850000), totalVnd: BigInt("9990000000"), qtyCompleted: 5180, category: "Phần ngầm" },
      { boqId: boq.id, code: "1.2", description: "Cốt thép CB300-V", unit: "tấn", qty: 820, unitPriceVnd: BigInt(21500000), totalVnd: BigInt("17630000000"), qtyCompleted: 760, category: "Phần ngầm" },
      { boqId: boq.id, code: "2.1", description: "Bê tông phần thân M400", unit: "m³", qty: 12800, unitPriceVnd: BigInt(2050000), totalVnd: BigInt("26240000000"), qtyCompleted: 6900, category: "Phần thân" },
      { boqId: boq.id, code: "2.2", description: "Cốt thép phần thân", unit: "tấn", qty: 1950, unitPriceVnd: BigInt(22000000), totalVnd: BigInt("42900000000"), qtyCompleted: 1150, category: "Phần thân" },
      { boqId: boq.id, code: "3.1", description: "Tường gạch AAC", unit: "m³", qty: 3200, unitPriceVnd: BigInt(1200000), totalVnd: BigInt("3840000000"), qtyCompleted: 1100, category: "Phần thân" },
      { boqId: boq.id, code: "4.1", description: "Đường ống PCCC", unit: "m", qty: 8400, unitPriceVnd: BigInt(285000), totalVnd: BigInt("2394000000"), qtyCompleted: 3100, category: "MEP" },
      { boqId: boq.id, code: "4.2", description: "Ống HVAC chính", unit: "m", qty: 6200, unitPriceVnd: BigInt(420000), totalVnd: BigInt("2604000000"), qtyCompleted: 1900, category: "MEP" },
      { boqId: boq.id, code: "5.1", description: "Sơn nội thất", unit: "m²", qty: 85000, unitPriceVnd: BigInt(58000), totalVnd: BigInt("4930000000"), qtyCompleted: 6500, category: "Hoàn thiện" },
      { boqId: boq.id, code: "5.2", description: "Gạch lát nền", unit: "m²", qty: 42000, unitPriceVnd: BigInt(285000), totalVnd: BigInt("11970000000"), qtyCompleted: 4200, category: "Hoàn thiện" },
    ],
  });
  await prisma.materialPriceIndex.createMany({
    data: [
      { province: "TP. HCM", material: "Thép thanh CB300-V", unit: "kg", priceVnd: BigInt(21500), period: "2026-04", source: "Sở XD TP.HCM CV-415/SXD" },
      { province: "TP. HCM", material: "Xi măng PCB40", unit: "tấn", priceVnd: BigInt(1850000), period: "2026-04", source: "Sở XD TP.HCM CV-415/SXD" },
      { province: "TP. HCM", material: "Cát san lấp", unit: "m³", priceVnd: BigInt(210000), period: "2026-04", source: "Sở XD TP.HCM CV-415/SXD" },
      { province: "TP. HCM", material: "Đá 1x2", unit: "m³", priceVnd: BigInt(430000), period: "2026-04", source: "Sở XD TP.HCM CV-415/SXD" },
    ],
  });

  // Promote the seeded progress payment to APPROVED so EVM has actual cost
  await prisma.progressPayment.updateMany({
    where: { projectId: project.id, state: { in: ["DRAFT", "SUBMITTED", "CDT_REVIEW"] } },
    data: { state: "APPROVED", approvedAt: new Date() },
  });

  // SiteEye: 3 cameras + 7 vision events + 4 incidents
  await prisma.siteCamera.createMany({
    data: [
      { id: "cam_1", projectId: project.id, name: "Cổng chính — Cổng A", location: "Cổng A — hướng Nam", lat: 10.7414, lng: 106.8390, active: true },
      { id: "cam_2", projectId: project.id, name: "Tầng 5 — Khu B", location: "Tầng 5, hướng Bắc", lat: 10.7415, lng: 106.8392, active: true },
      { id: "cam_3", projectId: project.id, name: "Cẩu tháp T2", location: "Cẩu tháp tháp T2", lat: 10.7416, lng: 106.8395, active: true },
    ],
  });
  await prisma.visionEvent.createMany({
    data: [
      { projectId: project.id, cameraId: "cam_1", kind: "PPE_VIOLATION", confidence: 0.92, bbox: [120, 80, 260, 420], label: "hard_hat_missing", payload: { note: "Công nhân vào cổng không đội mũ", workersDetected: 4 } as any, acknowledged: false },
      { projectId: project.id, cameraId: "cam_2", kind: "PPE_VIOLATION", confidence: 0.88, bbox: [210, 140, 360, 480], label: "safety_vest_missing", payload: { note: "Thợ sơn thiếu áo phản quang", workersDetected: 6 } as any, acknowledged: false },
      { projectId: project.id, cameraId: "cam_3", kind: "PPE_VIOLATION", confidence: 0.79, bbox: [88, 200, 280, 560], label: "harness_missing", payload: { note: "Thợ thép trên cẩu tháp không dây an toàn", workersDetected: 2 } as any, acknowledged: false },
      { projectId: project.id, cameraId: "cam_2", kind: "PPE_VIOLATION", confidence: 0.84, bbox: [300, 180, 470, 520], label: "hard_hat_missing", payload: { note: "Khu B — tổ lát gạch", workersDetected: 3 } as any, acknowledged: true },
      { projectId: project.id, cameraId: "cam_2", kind: "WORKER_COUNT", confidence: 0.99, bbox: [], label: "person", payload: { workersDetected: 27 } as any, acknowledged: true },
    ],
  });
  await prisma.incidentReport.createMany({
    data: [
      { projectId: project.id, reporterId: anh.id, occurredAt: new Date(Date.now() - 6 * 3600_000), category: "ROI_NGA", severity: "NEAR_MISS", description: "Thợ thép tầng 12 trượt chân trên giàn giáo, may mắn có dây an toàn giữ lại.", location: "Tầng 12 — khu A", injured: 0, rootCause: "Mặt sàn giàn giáo ẩm ướt do mưa đêm.", immediateAction: "Yêu cầu lau khô mặt sàn trước khi vào ca." },
      { projectId: project.id, reporterId: anh.id, occurredAt: new Date(Date.now() - 2.5 * 86400_000), category: "AN_TOAN_LAO_DONG", severity: "MINOR", description: "Công nhân tổ sơn bị rơi thùng sơn từ tầng 3.", location: "Tầng 3 — khu B", injured: 0, immediateAction: "Lắp chắn dưới khu thi công sơn." },
      { projectId: project.id, reporterId: anh.id, occurredAt: new Date(Date.now() - 5 * 86400_000), category: "DIEN_GIAT", severity: "MAJOR", description: "Thợ điện bị giật khi đấu dây TBA tạm, đã sơ cứu và đưa đi bệnh viện.", location: "Khu TBA tạm — cổng A", injured: 1, rootCause: "Dây điện trần không nối nối nối trường." },
      { projectId: project.id, reporterId: anh.id, occurredAt: new Date(Date.now() - 11 * 86400_000), category: "CHAY_NO", severity: "NEAR_MISS", description: "Phát hiện khói từ kho sơn trét.", location: "Kho vật tư — khu D", injured: 0, closedAt: new Date(Date.now() - 10 * 86400_000) },
    ],
  });

  // Drift snapshots (Trust layer)
  await prisma.driftSnapshot.createMany({
    data: [
      { feature: "rfi.classify", modelVersion: "2025-10", windowStart: new Date(Date.now() - 14 * 86400_000), windowEnd: new Date(Date.now() - 7 * 86400_000), inputKLDiv: 0.12, outputKLDiv: 0.18, acceptanceRate: 0.78, stabilityScore: 0.041, alertLevel: "OK", payload: { samples: 312 } as any },
      { feature: "rfi.classify", modelVersion: "2025-10", windowStart: new Date(Date.now() - 7 * 86400_000), windowEnd: new Date(), inputKLDiv: 0.18, outputKLDiv: 0.34, acceptanceRate: 0.71, stabilityScore: 0.072, alertLevel: "WATCH", payload: { samples: 287 } as any },
      { feature: "ncr.assess_photo", modelVersion: "2025-10", windowStart: new Date(Date.now() - 7 * 86400_000), windowEnd: new Date(), inputKLDiv: 0.09, outputKLDiv: 0.11, acceptanceRate: 0.83, stabilityScore: 0.028, alertLevel: "OK", payload: { samples: 84 } as any },
      { feature: "siteeye.ppe", modelVersion: "2025-10", windowStart: new Date(Date.now() - 7 * 86400_000), windowEnd: new Date(), inputKLDiv: 0.41, outputKLDiv: 0.55, acceptanceRate: 0.62, stabilityScore: 0.156, alertLevel: "DEGRADED", payload: { note: "Camera góc mới" } as any },
    ],
  });

  // More WinWork: 5 extra tenders + 4 extra bids to round out the demo
  const moreTenders = await Promise.all([
    prisma.tenderOpportunity.create({ data: { source: "MUASAMCONG", sourceUrl: "https://muasamcong.mpi.gov.vn/", sourceRef: "TBMT-2026-0501", title: "Gói thầu XL-12: Thi công phần thân tháp A1 — KĐT Gamuda Yên Sở", invitor: "CTCP Gamuda Land VN", invitorMst: "0102845333", budgetVnd: BigInt("985000000000"), fundingSource: "Vốn tư nhân", category: "Xây lắp", province: "Hà Nội", district: "Hoàng Mai", publishedAt: new Date("2026-05-12"), closingAt: new Date("2026-06-12T09:00:00"), bidMethod: "Đấu thầu rộng rãi", rawHash: "seed-tender-04" } }),
    prisma.tenderOpportunity.create({ data: { source: "MUASAMCONG", sourceUrl: "https://muasamcong.mpi.gov.vn/", sourceRef: "TBMT-2026-0508", title: "Cung cấp & lắp đặt M&E — FPT Tower Cầu Giấy", invitor: "CTCP FPT", invitorMst: "0103195903", budgetVnd: BigInt("218000000000"), category: "Xây lắp", province: "Hà Nội", district: "Cầu Giấy", publishedAt: new Date("2026-05-13"), closingAt: new Date("2026-06-08T14:00:00"), bidMethod: "Đấu thầu rộng rãi", rawHash: "seed-tender-05" } }),
    prisma.tenderOpportunity.create({ data: { source: "DAUTHAU_ASIA", title: "Cải tạo DT-741 — Bình Phước", invitor: "Sở GTVT Bình Phước", invitorMst: "3800340999", budgetVnd: BigInt("76500000000"), category: "Xây lắp", province: "Bình Phước", publishedAt: new Date("2026-05-14"), closingAt: new Date("2026-05-28T10:00:00"), rawHash: "seed-tender-06" } }),
    prisma.tenderOpportunity.create({ data: { source: "BAO_DAU_THAU", title: "Hệ thống xử lý nước thải KCN VSIP Quảng Ngãi", invitor: "Cty CP ĐT VSIP Quảng Ngãi", invitorMst: "4300845212", budgetVnd: BigInt("142000000000"), category: "Hỗn hợp", province: "Quảng Ngãi", publishedAt: new Date("2026-04-22"), closingAt: new Date("2026-05-25T16:00:00"), rawHash: "seed-tender-07" } }),
    prisma.tenderOpportunity.create({ data: { source: "MUASAMCONG", title: "Phần ngầm A2 — KĐT Vinhomes Smart City", invitor: "CTCP Vinhomes", invitorMst: "0102671977", budgetVnd: BigInt("510000000000"), category: "Xây lắp", province: "Hà Nội", district: "Nam Từ Liêm", publishedAt: new Date("2026-05-17"), closingAt: new Date("2026-06-20T09:00:00"), rawHash: "seed-tender-08" } }),
  ]);
  await prisma.bid.createMany({
    data: [
      { key: "BID-COFICO-003", orgId: cofico.id, opportunityId: moreTenders[0].id, title: "Gói XL-12 — Vinhomes Gamuda", state: "OPENED", ownerUserId: anh.id, estimatedValueVnd: BigInt("920000000000"), proposedValueVnd: BigInt("968000000000"), marginPct: 5.2, contingencyPct: 2.8, technicalScore: 91 },
      { key: "BID-COFICO-004", orgId: cofico.id, opportunityId: moreTenders[1].id, title: "M&E FPT Tower Cầu Giấy", state: "AWARDED", ownerUserId: anh.id, estimatedValueVnd: BigInt("198000000000"), proposedValueVnd: BigInt("211500000000"), marginPct: 6.8, contingencyPct: 3.0, technicalScore: 88, outcome: "AWARDED", submittedAt: new Date(Date.now() - 21 * 86400_000), decisionAt: new Date(Date.now() - 5 * 86400_000) },
      { key: "BID-COFICO-005", orgId: cofico.id, opportunityId: moreTenders[2].id, title: "Cải tạo DT-741 Bình Phước", state: "LOST", ownerUserId: anh.id, estimatedValueVnd: BigInt("73000000000"), proposedValueVnd: BigInt("78200000000"), marginPct: 7.1, technicalScore: 76, outcome: "LOST", submittedAt: new Date(Date.now() - 28 * 86400_000), decisionAt: new Date(Date.now() - 10 * 86400_000) },
      { key: "BID-COFICO-006", orgId: cofico.id, opportunityId: moreTenders[4].id, title: "Phần ngầm A2 Vinhomes Smart City", state: "ESTIMATING", ownerUserId: anh.id, estimatedValueVnd: BigInt("490000000000") },
    ],
  });

  // AI cost telemetry for the Trust 30-day rollup
  await prisma.aiCostEvent.createMany({
    data: Array.from({ length: 24 }).map((_, i) => ({
      projectId: project.id,
      feature: ["rfi.classify", "ncr.assess_photo", "siteeye.ppe", "daily_log.transcribe"][i % 4]!,
      model: ["qwen2.5:7b-instruct", "qwen2.5-vl:7b", "faster-whisper-medium", "bge-m3"][i % 4]!,
      tokensIn: 400 + ((i * 17) % 600),
      tokensOut: 120 + ((i * 13) % 250),
      latencyMs: 800 + ((i * 41) % 4000),
      costVnd: BigInt(300 + ((i * 11) % 900)),
      occurredAt: new Date(Date.now() - i * 3600_000),
    })),
  });

  // ─── Crews · 5 tổ đội + 15 assignments trải đều 2 tuần ──────────────────
  const crewsCreated = await Promise.all([
    prisma.crew.create({ data: { projectId: project.id, name: "Tổ thép #1",  trade: "Thép",     foremanName: "Nguyễn Văn Hùng",  headcount: 18 } }),
    prisma.crew.create({ data: { projectId: project.id, name: "Tổ thép #2",  trade: "Thép",     foremanName: "Trần Minh Đức",    headcount: 16 } }),
    prisma.crew.create({ data: { projectId: project.id, name: "Tổ bê tông",  trade: "Bê tông",  foremanName: "Lê Quang Hải",     headcount: 22 } }),
    prisma.crew.create({ data: { projectId: project.id, name: "Tổ MEP A",    trade: "MEP",      foremanName: "Phạm Tuấn Anh",    headcount: 12 } }),
    prisma.crew.create({ data: { projectId: project.id, name: "Tổ hoàn thiện",trade: "Hoàn thiện",foremanName: "Đỗ Thị Mai",      headcount: 14 } }),
  ]);
  const [crewThep1, crewThep2, crewBetong, crewMep, crewHoanThien] = crewsCreated;

  const day = (offsetDays: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d;
  };

  await prisma.crewAssignment.createMany({
    data: [
      // Hôm qua + 2 days ago (đã xong)
      { projectId: project.id, crewId: crewThep1!.id,    workDate: day(-2), shift: "DAY", title: "Buộc thép cột tầng 12 trục A-F",       zone: "Tầng 12 — Khu A", hoursPlanned: 8, hoursActual: 7.5, state: "REVIEWED" },
      { projectId: project.id, crewId: crewBetong!.id,   workDate: day(-1), shift: "DAY", title: "Đổ bê tông sàn tầng 12 phân khu A",    zone: "Tầng 12 — Khu A", hoursPlanned: 10, hoursActual: 9.5, state: "REVIEWED" },
      { projectId: project.id, crewId: crewMep!.id,      workDate: day(-1), shift: "DAY", title: "Lắp ống nước thoát tầng 8 căn 01-05",  zone: "Tầng 8 — Khu B",  hoursPlanned: 8, hoursActual: 8, state: "DONE" },

      // Hôm nay
      { projectId: project.id, crewId: crewThep2!.id,    workDate: day(0), shift: "DAY", title: "Buộc thép dầm tầng 13 trục C-E",        zone: "Tầng 13 — Khu A", hoursPlanned: 8, state: "IN_PROGRESS" },
      { projectId: project.id, crewId: crewMep!.id,      workDate: day(0), shift: "DAY", title: "Lắp HVAC chính tầng 6",                  zone: "Tầng 6 — Trung tâm", hoursPlanned: 10, state: "IN_PROGRESS" },
      { projectId: project.id, crewId: crewHoanThien!.id,workDate: day(0), shift: "DAY", title: "Lát gạch sảnh tầng 1 khu D",             zone: "Tầng 1 — Khu D",  hoursPlanned: 8, state: "BLOCKED", blockedReason: "Đợi mẫu gạch Holcim đến vào chiều" },

      // Ngày mai
      { projectId: project.id, crewId: crewThep1!.id,    workDate: day(1), shift: "DAY", title: "Buộc thép tường vây tầng hầm B2",       zone: "Tầng hầm B2",     hoursPlanned: 8, state: "PLANNED" },
      { projectId: project.id, crewId: crewBetong!.id,   workDate: day(1), shift: "DAY", title: "Đổ bê tông dầm tầng 13",                 zone: "Tầng 13 — Khu A", hoursPlanned: 10, state: "PLANNED" },
      { projectId: project.id, crewId: crewMep!.id,      workDate: day(1), shift: "NIGHT", title: "Kéo cáp điện trục đứng tầng 4-8",      zone: "Trục thang máy 1",hoursPlanned: 8, state: "PLANNED" },

      // 2-3 ngày tới
      { projectId: project.id, crewId: crewThep2!.id,    workDate: day(2), shift: "DAY", title: "Lắp giàn giáo bao quanh tầng 14",       zone: "Tầng 14",         hoursPlanned: 8, state: "PLANNED" },
      { projectId: project.id, crewId: crewHoanThien!.id,workDate: day(3), shift: "DAY", title: "Sơn lớp lót khu B tầng 5-7",             zone: "Tầng 5-7 — Khu B",hoursPlanned: 10, state: "PLANNED" },

      // Tuần sau
      { projectId: project.id, crewId: crewBetong!.id,   workDate: day(7), shift: "DAY", title: "Đổ bê tông sàn tầng 13 phân khu B",    zone: "Tầng 13 — Khu B", hoursPlanned: 10, state: "PLANNED" },
      { projectId: project.id, crewId: crewThep1!.id,    workDate: day(8), shift: "DAY", title: "Buộc thép cột tầng 14 trục A-F",       zone: "Tầng 14 — Khu A", hoursPlanned: 8, state: "PLANNED" },
      { projectId: project.id, crewId: crewMep!.id,      workDate: day(9), shift: "DAY", title: "Test áp lực hệ thống PCCC tầng 5",     zone: "Tầng 5 — Toàn tầng",hoursPlanned: 6, state: "PLANNED" },
      { projectId: project.id, crewId: crewHoanThien!.id,workDate: day(10),shift: "DAY", title: "Lát gạch nền căn mẫu 12A-05",          zone: "Căn 12A-05",      hoursPlanned: 8, state: "PLANNED" },
    ],
  });

  // ─── Catalog · 8 supplier + 28 cấu kiện + price relations ──────────────────
  const sups = await Promise.all([
    prisma.supplier.create({ data: { name: "CTCP Thép Hòa Phát",          mst: "0900189186", phone: "024-3855-9999", email: "sales@hoaphat.com.vn",   rating: 4.6 } }),
    prisma.supplier.create({ data: { name: "Tổng cty Xi măng VN (VICEM)", mst: "0100106435", phone: "024-3733-1551", email: "info@vicem.vn",          rating: 4.3 } }),
    prisma.supplier.create({ data: { name: "Holcim Việt Nam",             mst: "3500174756", phone: "025-1391-9999", email: "vn.sales@holcim.com",    rating: 4.5 } }),
    prisma.supplier.create({ data: { name: "INSEE Vietnam",               mst: "3700101027", phone: "025-1372-9999", email: "vn@inseegroup.com",      rating: 4.4 } }),
    prisma.supplier.create({ data: { name: "Tôn Hoa Sen",                 mst: "3702057295", phone: "025-1376-1111", email: "info@hoasengroup.vn",    rating: 4.2 } }),
    prisma.supplier.create({ data: { name: "Sơn Jotun Việt Nam",          mst: "0300629260", phone: "028-3823-6611", email: "jotun.vn@jotun.com",     rating: 4.5 } }),
    prisma.supplier.create({ data: { name: "Schneider Electric Việt Nam", mst: "0300543227", phone: "028-3826-2666", email: "vn.sales@se.com",        rating: 4.4 } }),
    prisma.supplier.create({ data: { name: "CTCP Bê tông Lê Phan",        mst: "0301443217", phone: "028-3811-9000", email: "info@lephan.vn",         rating: 4.0 } }),
  ]);
  const [sHoaPhat, sVicem, sHolcim, sInsee, sHoaSen, sJotun, sSchneider, sLePhan] = sups;

  const items = await Promise.all([
    // Bê tông
    prisma.catalogItem.create({ data: { code: "BT-M250", name: "Bê tông thương phẩm M250",            category: "BE_TONG",    unit: "m³",  spec: "TCVN 5574:2018 · slump 12±2cm",  baselineUnitPriceVnd: BigInt(1_650_000) } }),
    prisma.catalogItem.create({ data: { code: "BT-M300", name: "Bê tông thương phẩm M300",            category: "BE_TONG",    unit: "m³",  spec: "TCVN 5574:2018 · slump 14±2cm",  baselineUnitPriceVnd: BigInt(1_850_000) } }),
    prisma.catalogItem.create({ data: { code: "BT-M400", name: "Bê tông thương phẩm M400",            category: "BE_TONG",    unit: "m³",  spec: "TCVN 5574:2018 · slump 12±2cm",  baselineUnitPriceVnd: BigInt(2_050_000) } }),
    // Cốt thép
    prisma.catalogItem.create({ data: { code: "TH-CB300-D14", name: "Thép thanh CB300-V Φ14",          category: "COT_THEP",   unit: "kg",  spec: "TCVN 7888:2014",                  baselineUnitPriceVnd: BigInt(21_500) } }),
    prisma.catalogItem.create({ data: { code: "TH-CB300-D16", name: "Thép thanh CB300-V Φ16",          category: "COT_THEP",   unit: "kg",  spec: "TCVN 7888:2014",                  baselineUnitPriceVnd: BigInt(21_400) } }),
    prisma.catalogItem.create({ data: { code: "TH-CB300-D20", name: "Thép thanh CB300-V Φ20",          category: "COT_THEP",   unit: "kg",  spec: "TCVN 7888:2014",                  baselineUnitPriceVnd: BigInt(21_300) } }),
    prisma.catalogItem.create({ data: { code: "TH-CB400-D25", name: "Thép thanh CB400-V Φ25",          category: "COT_THEP",   unit: "kg",  spec: "TCVN 7888:2014",                  baselineUnitPriceVnd: BigInt(22_200) } }),
    // Gạch · đá
    prisma.catalogItem.create({ data: { code: "GA-AAC-100",   name: "Gạch AAC 100x200x600",            category: "GACH_DA",    unit: "viên", spec: "TCVN 7959:2017",                 baselineUnitPriceVnd: BigInt(28_000) } }),
    prisma.catalogItem.create({ data: { code: "GA-AAC-150",   name: "Gạch AAC 150x200x600",            category: "GACH_DA",    unit: "viên", spec: "TCVN 7959:2017",                 baselineUnitPriceVnd: BigInt(42_000) } }),
    prisma.catalogItem.create({ data: { code: "DA-1X2",        name: "Đá 1x2 dăm",                      category: "GACH_DA",    unit: "m³",   spec: "TCVN 7570:2006",                 baselineUnitPriceVnd: BigInt(430_000) } }),
    // Xi măng · vôi
    prisma.catalogItem.create({ data: { code: "XM-PCB40",      name: "Xi măng PCB40",                   category: "XI_MANG_VOI", unit: "tấn",  spec: "TCVN 6260:2009",                 baselineUnitPriceVnd: BigInt(1_850_000) } }),
    prisma.catalogItem.create({ data: { code: "XM-PCB50",      name: "Xi măng PCB50 (mác cao)",         category: "XI_MANG_VOI", unit: "tấn",  spec: "TCVN 6260:2009",                 baselineUnitPriceVnd: BigInt(2_050_000) } }),
    // Sơn · phụ gia
    prisma.catalogItem.create({ data: { code: "SON-JOT-IT",    name: "Sơn nội thất Jotun Jotashield",   category: "SON_PHU",    unit: "lít",  spec: "Acrylic gốc nước, độ phủ 12m²/L",baselineUnitPriceVnd: BigInt(285_000) } }),
    prisma.catalogItem.create({ data: { code: "SON-JOT-EX",    name: "Sơn ngoại thất Jotun Stayblue",   category: "SON_PHU",    unit: "lít",  spec: "Chống UV, bảo hành 10 năm",      baselineUnitPriceVnd: BigInt(390_000) } }),
    // M&E HVAC
    prisma.catalogItem.create({ data: { code: "ME-HVAC-400",   name: "Ống HVAC Φ400 sơn tĩnh điện",     category: "ME_HVAC",    unit: "m",    spec: "Tôn mạ kẽm dày 0.8mm",           baselineUnitPriceVnd: BigInt(420_000) } }),
    prisma.catalogItem.create({ data: { code: "ME-HVAC-FAN",   name: "Quạt cấp gió Greenheck SQ-160",   category: "ME_HVAC",    unit: "cái",  spec: "5000 CFM · 380V",                baselineUnitPriceVnd: BigInt(28_500_000) } }),
    // M&E Điện
    prisma.catalogItem.create({ data: { code: "ME-DIEN-MCB63", name: "MCB Schneider iC60N 3P 63A",      category: "ME_DIEN",    unit: "cái",  spec: "10kA · cong C",                  baselineUnitPriceVnd: BigInt(1_850_000) } }),
    prisma.catalogItem.create({ data: { code: "ME-DIEN-CAB",   name: "Cáp điện CADIVI CV 4.0mm² Cu",    category: "ME_DIEN",    unit: "m",    spec: "TCVN 5934:1995",                 baselineUnitPriceVnd: BigInt(18_500) } }),
    // M&E Nước
    prisma.catalogItem.create({ data: { code: "ME-NUOC-PVC110",name: "Ống PVC Tiền Phong DN110 PN10",   category: "ME_NUOC",    unit: "m",    spec: "TCVN 6151:2002",                 baselineUnitPriceVnd: BigInt(95_000) } }),
    prisma.catalogItem.create({ data: { code: "ME-NUOC-PPR25", name: "Ống PPR DN25 Sinopec PN16",        category: "ME_NUOC",    unit: "m",    spec: "Cấp nước nóng",                  baselineUnitPriceVnd: BigInt(38_000) } }),
    // PCCC
    prisma.catalogItem.create({ data: { code: "PC-SPK-RES",    name: "Đầu phun sprinkler hồng",          category: "PCCC",       unit: "cái",  spec: "QCVN 06:2022 · K=80",            baselineUnitPriceVnd: BigInt(285_000) } }),
    prisma.catalogItem.create({ data: { code: "PC-BINH-MFZL4", name: "Bình chữa cháy MFZL4 (4kg ABC)",   category: "PCCC",       unit: "bình", spec: "TCVN 7026:2013",                 baselineUnitPriceVnd: BigInt(520_000) } }),
    // Cửa · kính
    prisma.catalogItem.create({ data: { code: "CV-CUA-AL",     name: "Cửa nhôm Xingfa 1.4mm",            category: "CUA_KINH",   unit: "m²",   spec: "Hệ 55, kính 5+5 Low-E",          baselineUnitPriceVnd: BigInt(2_850_000) } }),
    prisma.catalogItem.create({ data: { code: "CV-CUA-GO",     name: "Cửa gỗ công nghiệp HDF veneer",    category: "CUA_KINH",   unit: "bộ",   spec: "830x2050mm, bao gồm khung",      baselineUnitPriceVnd: BigInt(4_200_000) } }),
    // Thiết bị thi công
    prisma.catalogItem.create({ data: { code: "TBTC-CTHAP",    name: "Cẩu tháp Liebherr 132 EC-H 8 FR.tronic", category: "THIET_BI_THI_CONG", unit: "tháng", spec: "Tải đỉnh 8 tấn, vươn 60m", baselineUnitPriceVnd: BigInt(285_000_000) } }),
    prisma.catalogItem.create({ data: { code: "TBTC-VANTHANG", name: "Vận thăng SC 200/200",             category: "THIET_BI_THI_CONG", unit: "tháng", spec: "Tải 2000kg, cao 200m",        baselineUnitPriceVnd: BigInt(85_000_000) } }),
    // Khác
    prisma.catalogItem.create({ data: { code: "KHAC-MAY-HAN",  name: "Máy hàn que Hồng Ký 250A",         category: "KHAC",       unit: "cái",  spec: "AC/DC, 220V",                    baselineUnitPriceVnd: BigInt(8_500_000) } }),
    prisma.catalogItem.create({ data: { code: "KHAC-MU-PPE",   name: "Mũ bảo hộ HPE-A1 (vàng)",           category: "KHAC",       unit: "cái",  spec: "TCVN 6407:2014",                 baselineUnitPriceVnd: BigInt(85_000) } }),
  ]);

  // Supplier × item price relations (only the realistic ones)
  await prisma.supplierCatalogItem.createMany({
    data: [
      { supplierId: sHoaPhat!.id, catalogItemId: items[3]!.id, unitPriceVnd: BigInt(21_400), leadTimeDays: 5 },   // CB300 D14
      { supplierId: sHoaPhat!.id, catalogItemId: items[4]!.id, unitPriceVnd: BigInt(21_300), leadTimeDays: 5 },
      { supplierId: sHoaPhat!.id, catalogItemId: items[5]!.id, unitPriceVnd: BigInt(21_200), leadTimeDays: 5 },
      { supplierId: sHoaPhat!.id, catalogItemId: items[6]!.id, unitPriceVnd: BigInt(22_100), leadTimeDays: 7 },   // CB400 D25
      { supplierId: sVicem!.id,   catalogItemId: items[10]!.id, unitPriceVnd: BigInt(1_870_000), leadTimeDays: 3 }, // PCB40
      { supplierId: sVicem!.id,   catalogItemId: items[11]!.id, unitPriceVnd: BigInt(2_070_000), leadTimeDays: 3 },
      { supplierId: sHolcim!.id,  catalogItemId: items[10]!.id, unitPriceVnd: BigInt(1_850_000), leadTimeDays: 2 }, // Holcim rẻ hơn
      { supplierId: sInsee!.id,   catalogItemId: items[10]!.id, unitPriceVnd: BigInt(1_840_000), leadTimeDays: 2 },
      { supplierId: sJotun!.id,   catalogItemId: items[12]!.id, unitPriceVnd: BigInt(285_000),  leadTimeDays: 7 },
      { supplierId: sJotun!.id,   catalogItemId: items[13]!.id, unitPriceVnd: BigInt(390_000),  leadTimeDays: 7 },
      { supplierId: sSchneider!.id, catalogItemId: items[16]!.id, unitPriceVnd: BigInt(1_850_000), leadTimeDays: 14 }, // MCB
      { supplierId: sLePhan!.id,  catalogItemId: items[0]!.id, unitPriceVnd: BigInt(1_620_000), leadTimeDays: 1 },  // BT M250
      { supplierId: sLePhan!.id,  catalogItemId: items[1]!.id, unitPriceVnd: BigInt(1_830_000), leadTimeDays: 1 },  // BT M300
      { supplierId: sLePhan!.id,  catalogItemId: items[2]!.id, unitPriceVnd: BigInt(2_030_000), leadTimeDays: 1 },
    ],
  });

  // ─── Handover · 7 tickets (mix severity / state / warranty type) ──────────
  const baseEnd = new Date(); baseEnd.setMonth(baseEnd.getMonth() + 18); // bảo hành đến 18 tháng tới
  await prisma.handoverTicket.createMany({
    data: [
      // CRITICAL — quá SLA 1h
      { projectId: project.id, ticketNumber: "HG-VHGP-S9-001", unitCode: "S9-12A-05", category: "DIEN_GIAT",       severity: "CRITICAL", title: "Rò điện ổ cắm phòng khách",                     description: "Cư dân phản ánh chạm nhẹ khi cắm sạc — mạnh hơn khi tay ướt. Đã ngắt aptomat tổng.", reporterName: "Anh Nguyễn Văn Hùng", reporterPhone: "0901234567", reporterEmail: "hung.nv@gmail.com", warrantyType: "PHAN_CHINH", warrantyEndsAt: baseEnd, slaDueAt: new Date(Date.now() - 3600_000), state: "TRIAGED", reportedAt: new Date(Date.now() - 5 * 3600_000) },
      // HIGH — sắp quá hạn
      { projectId: project.id, ticketNumber: "HG-VHGP-S9-002", unitCode: "S9-08B-12", category: "THAM_DOT",         severity: "HIGH",     title: "Thấm trần phòng tắm sau mưa lớn",                description: "Mưa đêm 18/5 → trần phòng tắm ẩm cả ngày, có vệt nâu. Nghi nứt ống thoát sàn tầng trên.", reporterName: "Chị Trần Thị Bình",  reporterPhone: "0912345678", warrantyType: "PHAN_CHINH", warrantyEndsAt: baseEnd, slaDueAt: new Date(Date.now() + 8 * 3600_000), state: "IN_PROGRESS", reportedAt: new Date(Date.now() - 16 * 3600_000) },
      // MEDIUM
      { projectId: project.id, ticketNumber: "HG-VHGP-S9-003", unitCode: "S9-05A-08", category: "CAP_THOAT_NUOC",   severity: "MEDIUM",   title: "Vòi rửa bát chảy nhỏ giọt",                     description: "Vòi inox bị rỉ rò khoảng 1 giọt/5 giây. Đã siết tay nhưng vẫn rò.",                  reporterName: "Anh Lê Quốc Cường",  reporterPhone: "0923456789", warrantyType: "PHAN_PHU",   warrantyEndsAt: baseEnd, slaDueAt: new Date(Date.now() + 48 * 3600_000), state: "NEW", reportedAt: new Date(Date.now() - 6 * 3600_000) },
      // LOW
      { projectId: project.id, ticketNumber: "HG-VHGP-S9-004", unitCode: "S9-15C-03", category: "SON_HOAN_THIEN",   severity: "LOW",      title: "Bong tróc sơn cạnh khung cửa phòng ngủ chính",  description: "Một mảng sơn ~5x10cm bong sát cạnh khung cửa. Khả năng do co ngót.",                  reporterName: "Chị Phạm Mỹ Linh",   reporterPhone: "0934567890", warrantyType: "PHAN_PHU",   warrantyEndsAt: baseEnd, slaDueAt: new Date(Date.now() + 5 * 86400_000), state: "NEW", reportedAt: new Date(Date.now() - 24 * 3600_000) },
      // RECTIFIED — chờ cư dân xác nhận
      { projectId: project.id, ticketNumber: "HG-VHGP-S9-005", unitCode: "S9-10A-11", category: "HVAC",             severity: "HIGH",     title: "Điều hòa không lạnh — tầng 10 căn 11",          description: "Daikin treo tường không lạnh sau 3 tháng. Kiểm tra: nạp ga, vệ sinh lọc.",            reporterName: "Anh Đỗ Hoàng Nam",  reporterPhone: "0945678901", warrantyType: "PHAN_PHU",   warrantyEndsAt: baseEnd, slaDueAt: new Date(Date.now() - 24 * 3600_000), state: "RECTIFIED", rectifiedAt: new Date(Date.now() - 2 * 3600_000), reportedAt: new Date(Date.now() - 30 * 3600_000) },
      // VERIFIED — closed loop
      { projectId: project.id, ticketNumber: "HG-VHGP-S9-006", unitCode: "S9-03B-07", category: "CUA_KHOA",         severity: "LOW",      title: "Khóa cửa chính kẹt khi đóng",                    description: "Chốt khóa thân cửa kẹt — đã chỉnh bản lề + tra dầu.",                                  reporterName: "Chị Vũ Thị Hoa",     reporterPhone: "0956789012", warrantyType: "PHAN_PHU",   warrantyEndsAt: baseEnd, slaDueAt: new Date(Date.now() - 4 * 86400_000), state: "VERIFIED", rectifiedAt: new Date(Date.now() - 5 * 86400_000), verifiedAt: new Date(Date.now() - 4 * 86400_000), customerSatisfactionScore: 5, reportedAt: new Date(Date.now() - 7 * 86400_000) },
      // REJECTED — ngoài bảo hành (hết hạn rồi)
      { projectId: project.id, ticketNumber: "HG-VHGP-S9-007", unitCode: "S9-07A-02", category: "SON_HOAN_THIEN",   severity: "LOW",      title: "Đề nghị sơn lại toàn bộ căn",                    description: "Cư dân yêu cầu sơn lại toàn bộ căn. KHÔNG nằm trong phạm vi bảo hành (sơn nội thất 12T, đã hết hạn).", reporterName: "Anh Bùi Minh Khôi",  reporterPhone: "0967890123", warrantyType: "PHAN_PHU",   warrantyEndsAt: new Date(Date.now() - 30 * 86400_000), state: "REJECTED", reportedAt: new Date(Date.now() - 2 * 86400_000) },
    ],
  });

  // ─── Schedule · 12 tasks across 4 disciplines, 3 on critical path ───────
  const dPlus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  await prisma.scheduleTask.createMany({
    data: [
      { projectId: project.id, code: "T1.1", name: "Hoàn thành ép cọc móng",        discipline: "Phần ngầm", zone: "Tầng hầm B2", plannedStart: dPlus(-30), plannedEnd: dPlus(-15), actualStart: dPlus(-30), actualEnd: dPlus(-14), pctComplete: 100, state: "DONE",        isCritical: true },
      { projectId: project.id, code: "T1.2", name: "Đổ bê tông móng + đài",         discipline: "Phần ngầm", zone: "Tầng hầm B2", plannedStart: dPlus(-14), plannedEnd: dPlus(0),   actualStart: dPlus(-14), pctComplete: 92,  state: "IN_PROGRESS", isCritical: true },
      { projectId: project.id, code: "T2.1", name: "Thi công khung BT cốt thép T1-T5", discipline: "Kết cấu", zone: "Khu A", plannedStart: dPlus(-5),  plannedEnd: dPlus(20),  actualStart: dPlus(-3),  pctComplete: 35,  state: "IN_PROGRESS", isCritical: true },
      { projectId: project.id, code: "T2.2", name: "Thi công khung BT T6-T12",         discipline: "Kết cấu", zone: "Khu A", plannedStart: dPlus(15), plannedEnd: dPlus(60),  pctComplete: 0,   state: "PLANNED",      isCritical: true },
      { projectId: project.id, code: "T2.3", name: "Thi công khung BT T13-mái",        discipline: "Kết cấu", zone: "Khu A", plannedStart: dPlus(55), plannedEnd: dPlus(95),  pctComplete: 0,   state: "PLANNED",      isCritical: true },
      { projectId: project.id, code: "T3.1", name: "Lắp đặt HVAC chính",                discipline: "MEP",     zone: "Toàn nhà", plannedStart: dPlus(40), plannedEnd: dPlus(110), pctComplete: 0,   state: "PLANNED" },
      { projectId: project.id, code: "T3.2", name: "Đi đường điện thân trục đứng",     discipline: "MEP",     zone: "Trục thang máy", plannedStart: dPlus(35), plannedEnd: dPlus(100), pctComplete: 0,   state: "PLANNED" },
      { projectId: project.id, code: "T3.3", name: "Lắp đặt hệ thống PCCC sprinkler",  discipline: "MEP",     zone: "Toàn nhà", plannedStart: dPlus(45), plannedEnd: dPlus(115), pctComplete: 0,   state: "PLANNED" },
      { projectId: project.id, code: "T4.1", name: "Xây tường ngăn căn hộ T1-T5",      discipline: "Hoàn thiện", zone: "Khu A T1-T5", plannedStart: dPlus(25),  plannedEnd: dPlus(50),  pctComplete: 0, state: "PLANNED" },
      { projectId: project.id, code: "T4.2", name: "Trát + sơn lót T1-T5",              discipline: "Hoàn thiện", zone: "Khu A T1-T5", plannedStart: dPlus(50),  plannedEnd: dPlus(75),  pctComplete: 0, state: "PLANNED" },
      { projectId: project.id, code: "T4.3", name: "Lát gạch + hoàn thiện sơn căn hộ",  discipline: "Hoàn thiện", zone: "Khu A T1-T12", plannedStart: dPlus(80),  plannedEnd: dPlus(140), pctComplete: 0, state: "PLANNED" },
      { projectId: project.id, code: "T5.1", name: "Nghiệm thu + bàn giao",             discipline: "Bàn giao",   zone: "Toàn nhà", plannedStart: dPlus(150), plannedEnd: dPlus(165), pctComplete: 0, state: "PLANNED",      isCritical: true },
    ],
  });

  // ─── Permit applications · 2 hồ sơ ───────────────────────────────────────
  const permit1 = await prisma.permitApplication.create({
    data: {
      projectId: project.id,
      permitType: "GPXD_MOI",
      applicationCode: "GPXD-2025-S9-0042",
      applicant: "Vinhomes JSC",
      submittedAt: dPlus(-90),
      receivedAt: dPlus(-88),
      decisionAt: dPlus(-60),
      decision: "APPROVED",
      decisionNote: "Phê duyệt GPXD 24 tầng — Sở XD TP.HCM Quyết định số 0042/QĐ-SXD",
      expiresAt: dPlus(720),
      state: "APPROVED",
    },
  });
  await prisma.permitChecklist.createMany({
    data: [
      { applicationId: permit1.id, itemCode: "PL-I.A.1", itemTitle: "Đơn đề nghị cấp GPXD (Mẫu 01)",      attached: true, evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/donxin.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.2", itemTitle: "Bản sao GCN quyền sử dụng đất",      attached: true, evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/gcndat.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.3", itemTitle: "Bản vẽ tổng mặt bằng",                 attached: true, evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/totalplan.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.4", itemTitle: "Bản vẽ kiến trúc — mặt đứng/cắt",      attached: true, evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/kientruc.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.5", itemTitle: "Bản vẽ kết cấu — móng + khung",         attached: true, evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/ketcau.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.6", itemTitle: "Bản vẽ M&E (điện · nước · HVAC · PCCC)", attached: true, evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/me.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.7", itemTitle: "Thẩm duyệt PCCC (NĐ 136/2020)",         attached: true, evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/pccc.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.8", itemTitle: "Báo cáo ĐTM (nếu thuộc danh mục)",       attached: false },
    ],
  });

  const permit2 = await prisma.permitApplication.create({
    data: {
      projectId: project.id,
      permitType: "GPXD_DIEU_CHINH",
      applicationCode: "GPXD-DC-2026-S9-0011",
      applicant: "Vinhomes JSC",
      submittedAt: dPlus(-10),
      receivedAt: dPlus(-8),
      decision: "PENDING",
      state: "REVIEWING",
    },
  });
  await prisma.permitChecklist.createMany({
    data: [
      { applicationId: permit2.id, itemCode: "PL-DC.1", itemTitle: "Đơn xin điều chỉnh GPXD",          attached: true },
      { applicationId: permit2.id, itemCode: "PL-DC.2", itemTitle: "Hồ sơ thiết kế điều chỉnh (kiến trúc + kết cấu)", attached: true },
      { applicationId: permit2.id, itemCode: "PL-DC.3", itemTitle: "Văn bản chấp thuận của CĐT cho điều chỉnh", attached: false },
      { applicationId: permit2.id, itemCode: "PL-DC.4", itemTitle: "Bản sao GPXD cũ",                    attached: true },
    ],
  });

  // ─── PCCC applications · 2 hồ sơ (1 đã duyệt thiết kế, 1 đang chờ nghiệm thu) ──
  await prisma.pcccApplication.createMany({
    data: [
      {
        projectId: project.id,
        stage: "THAM_DUYET_THIET_KE",
        applicationCode: "PCCC-TD-2025-0089",
        submittedAt: dPlus(-100),
        decisionAt: dPlus(-75),
        decision: "APPROVED",
        decisionNote: "Phê duyệt thiết kế PCCC 24 tầng — PC07 Công an TP.HCM CV-0089",
        state: "APPROVED",
      },
      {
        projectId: project.id,
        stage: "NGHIEM_THU_PCCC",
        applicationCode: "PCCC-NT-2026-0023",
        submittedAt: dPlus(-3),
        decision: "PENDING",
        state: "REVIEWING",
      },
    ],
  });

  console.log("✅ Seed complete.");
  console.log(`   • 4 organizations, 4 users (password: ${DEMO_PASSWORD})`);
  console.log(`   • Project: ${project.name} (${project.key})`);
  console.log(`   • 5 issues, 1 daily log, 1 BBNT, 1 progress payment`);
  console.log(`   • 3 spec pages (cốt thép, bê tông, PCCC) — chưa embed, save lại để re-embed`);
  console.log(`   • 2 AI suggestions (classify + draft answer) on RFI-001`);
  console.log("");
  console.log("→ Đăng nhập demo: anh.nguyen@cofico.vn / " + DEMO_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
