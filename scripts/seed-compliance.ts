/**
 * scripts/seed-compliance.ts — seed TCVN/QCVN regulations + 5 AuditPreps
 * across existing projects.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const STANDARDS: Array<{
  code: string;
  kind: any;
  title: string;
  issuedBy: string;
  tags: string[];
  rules: Array<{ code: string; clauseRef: string; title: string; description?: string; severity: any; category: string }>;
}> = [
  {
    code: "TCVN 5574:2018", kind: "TCVN", title: "Thiết kế kết cấu bê tông và bê tông cốt thép",
    issuedBy: "Bộ KH&CN", tags: ["kết cấu", "bê tông"],
    rules: [
      { code: "TCVN5574-8.7-1", clauseRef: "§8.7", title: "Khoảng cách cốt đai dầm cột", description: "Khoảng cách s ≤ min(0.5d, 200mm) cho vùng dày đặc.", severity: "BLOCKING", category: "kết cấu" },
      { code: "TCVN5574-10.3-1", clauseRef: "§10.3", title: "Lớp bê tông bảo vệ cốt thép", description: "Lớp bảo vệ cốt thép cột ≥ 25mm trong điều kiện môi trường loại 2.", severity: "BLOCKING", category: "kết cấu" },
      { code: "TCVN5574-10.4-1", clauseRef: "§10.4", title: "Mạch ngừng đổ bê tông", description: "Xử lý mạch ngừng trước khi đổ tiếp.", severity: "WARNING", category: "kết cấu" },
    ],
  },
  {
    code: "TCVN 2737:2023", kind: "TCVN", title: "Tải trọng và tác động — Tiêu chuẩn thiết kế",
    issuedBy: "Bộ KH&CN", tags: ["tải trọng", "thiết kế"],
    rules: [
      { code: "TCVN2737-5.2-1", clauseRef: "§5.2", title: "Hoạt tải sàn nhà ở", description: "Sàn căn hộ ≥ 2.0 kN/m², ban công ≥ 3.0 kN/m².", severity: "BLOCKING", category: "kết cấu" },
      { code: "TCVN2737-6.1-1", clauseRef: "§6.1", title: "Tải gió theo vùng", description: "Áp lực gió cơ bản theo vùng (Phụ lục F).", severity: "BLOCKING", category: "kết cấu" },
    ],
  },
  {
    code: "QCVN 06:2022/BXD", kind: "QCVN", title: "An toàn cháy cho nhà và công trình",
    issuedBy: "Bộ Xây dựng", tags: ["PCCC", "ATCC"],
    rules: [
      { code: "QCVN06-3.4.1", clauseRef: "§3.4.1", title: "Số lượng + khoảng cách lối thoát hiểm", description: "Mỗi tầng phải có ≥ 2 lối thoát hiểm; khoảng cách ≤ 35m từ điểm xa nhất.", severity: "BLOCKING", category: "PCCC" },
      { code: "QCVN06-4.3.1", clauseRef: "§4.3.1", title: "Chiều rộng cửa thoát hiểm", description: "Cửa thoát hiểm rộng ≥ 0.9m; tay đẩy 1 chiều.", severity: "BLOCKING", category: "PCCC" },
      { code: "QCVN06-5.1.1", clauseRef: "§5.1.1", title: "Hệ thống chữa cháy tự động Sprinkler", description: "Bắt buộc cho nhà cao tầng > 25m hoặc S ≥ 500m².", severity: "BLOCKING", category: "PCCC" },
      { code: "QCVN06-5.4.1", clauseRef: "§5.4.1", title: "Hệ thống báo cháy địa chỉ", description: "Bắt buộc cho công trình thuộc bậc chịu lửa I/II.", severity: "WARNING", category: "PCCC" },
    ],
  },
  {
    code: "QCVN 04:2021/BXD", kind: "QCVN", title: "Nhà chung cư",
    issuedBy: "Bộ Xây dựng", tags: ["chung cư", "thiết kế"],
    rules: [
      { code: "QCVN04-2.1.1", clauseRef: "§2.1.1", title: "Diện tích tối thiểu căn hộ", description: "Căn hộ ≥ 25 m² (loại studio) hoặc ≥ 45 m² (1 phòng ngủ).", severity: "BLOCKING", category: "kiến trúc" },
      { code: "QCVN04-3.2.1", clauseRef: "§3.2.1", title: "Chiều cao trần căn hộ", description: "Chiều cao thông thuỷ ≥ 2.6m.", severity: "WARNING", category: "kiến trúc" },
      { code: "QCVN04-5.1.1", clauseRef: "§5.1.1", title: "Số thang máy theo số căn", description: "≥ 1 thang/100 căn hoặc tối thiểu 2 thang/tòa.", severity: "BLOCKING", category: "kiến trúc" },
    ],
  },
  {
    code: "QCVN 18:2014/BXD", kind: "QCVN", title: "An toàn trong xây dựng",
    issuedBy: "Bộ Xây dựng", tags: ["ATLĐ", "thi công"],
    rules: [
      { code: "QCVN18-3.1.1", clauseRef: "§3.1.1", title: "Lan can an toàn giàn giáo", description: "Lan can H ≥ 1.0m, có thanh chắn chân H ≥ 150mm.", severity: "BLOCKING", category: "ATLĐ" },
      { code: "QCVN18-4.2.1", clauseRef: "§4.2.1", title: "Đào hố sâu — biện pháp chống sụt", description: "Hố sâu > 1.5m phải có biện pháp chống sụt thành.", severity: "BLOCKING", category: "ATLĐ" },
    ],
  },
  {
    code: "QCVN 09:2017/BXD", kind: "QCVN", title: "Các công trình xây dựng sử dụng năng lượng hiệu quả",
    issuedBy: "Bộ Xây dựng", tags: ["EE", "thiết kế"],
    rules: [
      { code: "QCVN09-3.2.1", clauseRef: "§3.2.1", title: "Hệ số truyền nhiệt U-value tường ngoài", description: "U ≤ 2.5 W/m²K cho vùng khí hậu I-II.", severity: "WARNING", category: "EE" },
    ],
  },
  {
    code: "TCVN 9377-3:2012", kind: "TCVN", title: "Công tác hoàn thiện trong xây dựng — Thi công và nghiệm thu — Phần 3: Công tác ốp lát",
    issuedBy: "Bộ KH&CN", tags: ["hoàn thiện"],
    rules: [
      { code: "TCVN9377-3-5.1", clauseRef: "§5.1", title: "Sai số lát gạch sàn", description: "Độ vênh ≤ 2mm trên thước 2m.", severity: "WARNING", category: "hoàn thiện" },
    ],
  },
  {
    code: "TCVN 4519:1988", kind: "TCVN", title: "Hệ thống cấp thoát nước trong nhà và công trình — Quy phạm thi công nghiệm thu",
    issuedBy: "Bộ XD", tags: ["MEP", "cấp thoát nước"],
    rules: [
      { code: "TCVN4519-3.4", clauseRef: "§3.4", title: "Kiểm tra áp ống cấp nước", description: "Thử áp PPR ở 1.5 lần áp làm việc trong 1 giờ.", severity: "BLOCKING", category: "MEP" },
    ],
  },
];

// PC07 PCCC inspection prep — 12 items
const PC07_PREP_ITEMS = [
  { code: "PCCC-1.1", title: "Hồ sơ thẩm duyệt thiết kế PCCC", required: true, regulationCode: "QCVN 06:2022/BXD" },
  { code: "PCCC-1.2", title: "Bản vẽ lối thoát hiểm thực tế vs thiết kế", required: true, regulationCode: "QCVN 06:2022/BXD" },
  { code: "PCCC-2.1", title: "Biên bản thử áp hệ chữa cháy Sprinkler", required: true },
  { code: "PCCC-2.2", title: "Biên bản chạy thử hệ báo cháy địa chỉ", required: true },
  { code: "PCCC-2.3", title: "Bộ phận chữa cháy bằng tay (bình CO₂, bình bột)", required: true },
  { code: "PCCC-3.1", title: "Thử quạt tăng áp tăng đới", required: true },
  { code: "PCCC-3.2", title: "Thử thang thoát hiểm + thông gió cầu thang", required: true },
  { code: "PCCC-4.1", title: "Sơ đồ phân khu chống cháy + bậc chịu lửa", required: true },
  { code: "PCCC-4.2", title: "Vật liệu chống cháy hoàn thiện (hồ sơ chứng nhận)", required: true },
  { code: "PCCC-5.1", title: "Đào tạo đội PCCC nội bộ + giấy chứng nhận", required: true },
  { code: "PCCC-5.2", title: "Phương án thoát hiểm + diễn tập", required: false },
  { code: "PCCC-6.1", title: "Biên bản nghiệm thu PCCC trước khi đưa vào sử dụng", required: true },
];

// Sở XD inspection prep — 10 items
const SXD_PREP_ITEMS = [
  { code: "SXD-1.1", title: "Giấy phép xây dựng + giấy phép điều chỉnh", required: true },
  { code: "SXD-1.2", title: "Hồ sơ thiết kế cơ sở + BVTC đã phê duyệt", required: true, regulationCode: "TCVN 5574:2018" },
  { code: "SXD-2.1", title: "Báo cáo khảo sát địa chất + báo cáo thí nghiệm", required: true },
  { code: "SXD-3.1", title: "Biên bản nghiệm thu phần ngầm", required: true },
  { code: "SXD-3.2", title: "Biên bản nghiệm thu phần thân", required: true },
  { code: "SXD-3.3", title: "Biên bản nghiệm thu phần hoàn thiện", required: true },
  { code: "SXD-4.1", title: "Hồ sơ chứng nhận năng lực nhà thầu / TVGS", required: true },
  { code: "SXD-5.1", title: "Hồ sơ NCR + biên bản xử lý", required: true },
  { code: "SXD-6.1", title: "Báo cáo công tác ATLĐ-VSMT định kỳ", required: true, regulationCode: "QCVN 18:2014/BXD" },
  { code: "SXD-7.1", title: "Hồ sơ hoàn công đầy đủ theo Phụ lục VIIIb NĐ 06/2021", required: true },
];

const HOAN_CONG_PREP_ITEMS = [
  { code: "HC-1", title: "Hồ sơ pháp lý đầu tư", required: true },
  { code: "HC-2", title: "Hồ sơ khảo sát + thiết kế", required: true },
  { code: "HC-3", title: "Hồ sơ quản lý chất lượng + NCR đã xử lý", required: true },
  { code: "HC-4", title: "Hồ sơ nghiệm thu các giai đoạn", required: true },
  { code: "HC-5", title: "Hồ sơ ATLĐ-VSMT", required: true },
  { code: "HC-6", title: "Hồ sơ PCCC (biên bản nghiệm thu PC07)", required: true },
  { code: "HC-7", title: "Bản vẽ hoàn công kiến trúc / kết cấu / MEP", required: true },
  { code: "HC-8", title: "Hồ sơ khối lượng + thanh toán đã quyết toán", required: true },
];

const stateMix: Array<"PENDING" | "IN_PROGRESS" | "READY" | "FAILED"> = ["READY", "READY", "READY", "READY", "IN_PROGRESS", "IN_PROGRESS", "PENDING", "PENDING", "PENDING", "PENDING", "PENDING", "PENDING"];
const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;

async function main() {
  console.log("==> Compliance seed");

  // 1) Standards
  let standardsCreated = 0, rulesCreated = 0;
  for (const s of STANDARDS) {
    let reg = await prisma.regulation.findUnique({ where: { code: s.code } });
    if (!reg) {
      reg = await prisma.regulation.create({
        data: { code: s.code, kind: s.kind, title: s.title, issuedBy: s.issuedBy, tags: s.tags, status: "IN_FORCE", effectiveAt: new Date("2020-01-01") },
      });
      standardsCreated++;
    }
    for (const r of s.rules) {
      const exists = await prisma.codeRule.findUnique({ where: { regulationId_code: { regulationId: reg.id, code: r.code } } });
      if (exists) continue;
      await prisma.codeRule.create({
        data: { regulationId: reg.id, code: r.code, clauseRef: r.clauseRef, title: r.title, description: r.description, severity: r.severity, category: r.category, isActive: true },
      });
      rulesCreated++;
    }
  }
  console.log(`   ${standardsCreated} standards + ${rulesCreated} rules new`);

  // 2) Audit preps for top projects
  const projects = await prisma.project.findMany({ where: { status: { in: ["IN_PROGRESS", "HANDOVER"] } }, take: 6 });

  const prepConfigs = [
    { kind: "PC07_PCCC" as const, title: "Chuẩn bị nghiệm thu PCCC trước bàn giao", inspector: "PC07 Cảnh sát PCCC Hà Nội", items: PC07_PREP_ITEMS, daysAhead: 14 },
    { kind: "SO_XAY_DUNG" as const, title: "Chuẩn bị thẩm tra Sở XD giai đoạn 2", inspector: "Sở Xây dựng Hà Nội", items: SXD_PREP_ITEMS, daysAhead: 21 },
    { kind: "HOAN_CONG_QLNN" as const, title: "Nộp hồ sơ hoàn công cơ quan QLNN", inspector: "Sở Xây dựng Hà Nội", items: HOAN_CONG_PREP_ITEMS, daysAhead: 45 },
    { kind: "PC07_PCCC" as const, title: "Tái thẩm duyệt thiết kế PCCC sau điều chỉnh", inspector: "PC07 Cảnh sát PCCC", items: PC07_PREP_ITEMS, daysAhead: -7 },
    { kind: "CDT_NGHIEM_THU" as const, title: "Nghiệm thu giai đoạn hoàn thiện cánh A", inspector: "CĐT Vinhomes", items: HOAN_CONG_PREP_ITEMS, daysAhead: 7 },
  ];

  let prepsCreated = 0;
  for (let i = 0; i < Math.min(prepConfigs.length, projects.length); i++) {
    const cfg = prepConfigs[i]!;
    const project = projects[i]!;
    const existing = await prisma.auditPrep.findFirst({ where: { projectId: project.id, kind: cfg.kind, title: cfg.title } });
    if (existing) continue;
    const scheduledAt = new Date(); scheduledAt.setDate(scheduledAt.getDate() + cfg.daysAhead);
    const state: any = cfg.daysAhead < 0 ? "PASSED" : (i < 2 ? "IN_PROGRESS" : "DRAFT");
    const prep = await prisma.auditPrep.create({
      data: {
        projectId: project.id, kind: cfg.kind, title: cfg.title,
        description: `Chuẩn bị đoàn ${cfg.inspector} đến công trường ${project.key}.`,
        scheduledAt, inspectorOrg: cfg.inspector, state,
        startedAt: state === "IN_PROGRESS" || state === "PASSED" ? new Date(Date.now() - 7 * 86400000) : null,
        completedAt: state === "PASSED" ? new Date(Date.now() + cfg.daysAhead * 86400000) : null,
        resultNote: state === "PASSED" ? "Đoàn kiểm tra đạt yêu cầu, đã cấp biên bản số 145/BB-PC07." : null,
      },
    });
    prepsCreated++;
    // Items
    for (let s = 0; s < cfg.items.length; s++) {
      const it = cfg.items[s]!;
      const itemState = state === "PASSED" ? "READY" : (stateMix[s] ?? "PENDING");
      await prisma.auditPrepItem.create({
        data: {
          prepId: prep.id, seq: s + 1, code: it.code, title: it.title,
          required: it.required, state: itemState,
          regulationCode: (it as any).regulationCode ?? null,
          notes: itemState === "FAILED" ? "Cần bổ sung biên bản từ TVGS" : null,
          signedByName: itemState === "READY" ? `KS ${["Nguyễn Văn A", "Trần Thị B", "Lê Đình C", "Phạm Quốc D"][rand(0, 3)]}` : null,
          signedAt: itemState === "READY" ? new Date(Date.now() - rand(1, 14) * 86400000) : null,
          evidenceUrl: itemState === "READY" ? `s3://docs/${project.key}/audit/${it.code}.pdf` : null,
        },
      });
    }
  }
  console.log(`   ${prepsCreated} audit preps with items`);
  console.log("==> Done");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
