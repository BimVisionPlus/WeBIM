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
