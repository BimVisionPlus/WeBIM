/**
 * scripts/seed-demo-rich.ts
 *
 * Demo-day saturation seed. Populates every empty/sparse module across all
 * projects + orgs so the platform looks lived-in. Idempotent where possible:
 * skip-duplicate on unique constraints, additive on free models.
 *
 * Run:
 *   pnpm -F @atlas/db prisma:generate
 *   DATABASE_URL='<neon>' tsx scripts/seed-demo-rich.ts
 *
 * Or from repo root with prod URL pulled from VPS env:
 *   DATABASE_URL=$(ssh root@host 'cat /opt/atlas-aec/.env.production | grep ^DATABASE_URL | cut -d= -f2- | tr -d \"\\\"\"') tsx scripts/seed-demo-rich.ts
 *
 * Strategy:
 *  - For every Project: ensure stakeholders {NHA_THAU_CHINH:Cofico,
 *    TU_VAN_GIAM_SAT:Apave, TU_VAN_THIET_KE:AA Corp}. This unblocks workflow
 *    transitions that demand allowedRoles=['NHA_THAU_CHINH'].
 *  - For every Project: schedule tasks (10), crews (3), 14-day crew
 *    assignments (~21), workers (8), daily logs (last 7), RFIs (5),
 *    NCRs (3), generic Issues (5), Submittals (4), ChangeOrders (3),
 *    BoQ + 25 lines, ProgressPayment (4 months) + PaymentApplications,
 *    Models (2) + ModelElements (~16) + Clashes (8), PunchItems (10),
 *    SiteCameras (3) + VisionEvents (12), IncidentReports (4),
 *    HandoverTickets (5), Attendance (last 7 days × all workers).
 *  - For every Org that's a NT_CHINH/NT_PHU/CDT: AdvanceTransactions (8),
 *    InternalDocuments (8), SocialInsuranceRecords (10),
 *    VehicleDispatches (5), MarketTerritories (3), ProjectLeads (8).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────────────────────────
const today = new Date();
const day = (offsetDays: number): Date => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
};
const dayAt = (offsetDays: number, hour: number, min = 0): Date => {
  const d = day(offsetDays);
  d.setHours(hour, min, 0, 0);
  return d;
};
const pick = <T>(arr: T[], i: number): T => arr[i % arr.length];
const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const bigVnd = (n: number): bigint => BigInt(Math.round(n));

// ─── VN-grounded content pools ──────────────────────────────────────────────
const SCHEDULE_TASKS: Array<{ code: string; name: string; discipline: string; zone?: string; days: number; critical?: boolean }> = [
  { code: "T1.1", name: "Đào đất hố móng — Khu A", discipline: "Phần ngầm", zone: "Móng — Khu A", days: 14, critical: true },
  { code: "T1.2", name: "Ép cọc bê tông cốt thép D400", discipline: "Phần ngầm", zone: "Móng", days: 21, critical: true },
  { code: "T1.3", name: "Đổ bê tông móng cọc + đài móng", discipline: "Phần ngầm", zone: "Móng", days: 10, critical: true },
  { code: "T2.1", name: "Cốt thép cột tầng hầm", discipline: "Kết cấu", zone: "Tầng hầm", days: 7, critical: true },
  { code: "T2.2", name: "Cốp pha + đổ bê tông cột tầng 1", discipline: "Kết cấu", zone: "Tầng 1", days: 7 },
  { code: "T2.3", name: "Cốt thép dầm sàn tầng 2", discipline: "Kết cấu", zone: "Tầng 2", days: 5 },
  { code: "T3.1", name: "Lắp đặt ống nước thải PVC D110", discipline: "MEP", zone: "Trục KT toàn nhà", days: 12 },
  { code: "T3.2", name: "Đi dây điện ổ cắm + công tắc — Tầng 5", discipline: "MEP", zone: "Tầng 5", days: 8 },
  { code: "T4.1", name: "Xây tường ngăn 200mm — Tầng 3", discipline: "Hoàn thiện", zone: "Tầng 3", days: 6 },
  { code: "T4.2", name: "Trát tường vữa XM mác 75 — Tầng 2", discipline: "Hoàn thiện", zone: "Tầng 2", days: 5 },
  { code: "T5.1", name: "Sơn nước nội thất 3 lớp — Khu B", discipline: "Hoàn thiện", zone: "Khu B", days: 9 },
];

const CREWS: Array<{ name: string; trade: string; foremanName: string; headcount: number }> = [
  { name: "Tổ thép #1", trade: "Thép", foremanName: "Lê Văn Hùng", headcount: 12 },
  { name: "Tổ bê tông Ca A", trade: "Bê tông", foremanName: "Trần Quốc Khánh", headcount: 18 },
  { name: "Tổ MEP đường ống", trade: "MEP", foremanName: "Phạm Tuấn Anh", headcount: 9 },
  { name: "Tổ xây trát", trade: "Hoàn thiện", foremanName: "Nguyễn Văn Tâm", headcount: 14 },
  { name: "Tổ sơn nước", trade: "Sơn", foremanName: "Vũ Thanh Bình", headcount: 7 },
];

const WORKERS: Array<{ fullName: string; trade: string; level?: string; isStaff?: boolean }> = [
  { fullName: "Trần Văn Thắng", trade: "Thợ sắt", level: "bậc 4/7" },
  { fullName: "Lê Đình Long", trade: "Thợ sắt", level: "bậc 3/7" },
  { fullName: "Nguyễn Tiến Hùng", trade: "Thợ bê tông", level: "bậc 4/7" },
  { fullName: "Phạm Văn Dũng", trade: "Thợ bê tông", level: "bậc 3.5/7" },
  { fullName: "Đỗ Quang Minh", trade: "Thợ điện", level: "bậc 5/7" },
  { fullName: "Hoàng Văn Tuấn", trade: "Thợ ống nước", level: "bậc 4/7" },
  { fullName: "Vũ Đức Anh", trade: "Thợ hàn", level: "bậc 4/7" },
  { fullName: "Bùi Quốc Việt", trade: "Thợ xây", level: "bậc 3.5/7" },
  { fullName: "Lương Minh Khoa", trade: "Thợ trát", level: "bậc 3/7" },
  { fullName: "Đặng Văn Hải", trade: "Thợ sơn", level: "bậc 3.5/7" },
  { fullName: "KS Nguyễn Hoàng Long", trade: "Kỹ sư XD chính", level: "Chỉ huy phó", isStaff: true },
  { fullName: "KS Trần Thị Mai", trade: "Kỹ sư MEP", isStaff: true },
];

const RFI_TEMPLATES: Array<{ q: string; cat: string }> = [
  { q: "Yêu cầu xác nhận chi tiết bố trí cốt thép tại vị trí giao trục C-3 — bản vẽ KC-203 không khớp với BBNT cấu kiện.", cat: "Kết cấu" },
  { q: "Spec section 03 30 00: Mac bê tông M400 hay M350 cho cột tầng hầm? BoQ ghi M350 nhưng bản vẽ ghi M400.", cat: "Kết cấu" },
  { q: "Tra cứu chi tiết cao độ ống thoát sàn vệ sinh tầng 5 — chưa thấy bản vẽ shop drawing.", cat: "MEP" },
  { q: "Vật liệu sơn ngoại thất: yêu cầu xác nhận màu RAL 9003 hay 9010 theo hợp đồng?", cat: "Kiến trúc" },
  { q: "Bản vẽ kiến trúc thiếu chi tiết lan can ban công căn 12A-05 — yêu cầu bổ sung.", cat: "Kiến trúc" },
  { q: "ATLĐ: lưới đỡ giàn giáo tại trục E-12 cần xác nhận đạt QCVN 18:2014/BXD?", cat: "ATLĐ" },
];

const NCR_TEMPLATES: Array<{ title: string; root: string; sev: "MINOR" | "MAJOR" | "CRITICAL"; qcvn: string }> = [
  { title: "Bê tông cột C-08 tầng 3 nứt rạn bề mặt sau tháo cốp pha", root: "Mạch ngừng đổ chưa xử lý đúng quy trình.", sev: "MAJOR", qcvn: "TCVN 5574:2018 §10.4" },
  { title: "Cốt thép dầm D-12 sai khoảng cách đai (s=200 thay vì s=150)", root: "Tổ trưởng đọc nhầm bản vẽ KC-302.", sev: "MAJOR", qcvn: "TCVN 5574:2018 §8.7" },
  { title: "Ống thoát nước rò rỉ tại đoạn nối tầng 4 trục B-5", root: "Keo PVC không đạt tiêu chuẩn, chưa kiểm tra áp.", sev: "MINOR", qcvn: "TCVN 4519:1988 §3.4" },
  { title: "Sàn bê tông tầng 5 không bằng phẳng, độ vênh >10mm/2m", root: "Đầm bê tông chưa đúng quy trình + thợ thiếu kinh nghiệm.", sev: "MINOR", qcvn: "TCVN 9377-3:2012" },
];

const ISSUE_TEMPLATES: Array<{ title: string; desc: string }> = [
  { title: "Cập nhật bản vẽ shop drawing cốp pha cột tầng 6", desc: "Cần TVTK chuyển bản vẽ shop drawing cập nhật để gia công cốp pha lô 2." },
  { title: "Phê duyệt mẫu vật liệu lát gạch sàn", desc: "Mẫu gạch 600x600 — yêu cầu CĐT duyệt trong tuần này để kịp kế hoạch." },
  { title: "Bổ sung quy trình kiểm tra ATLĐ trước thi công cao", desc: "Trước khi triển khai giàn giáo tầng 8 cần tổng kiểm tra QC + ATLĐ." },
  { title: "Sửa lỗi nứt mối nối tường khu B tầng 3", desc: "Báo cáo từ TVGS — cần xử lý trước 2026-06-15." },
  { title: "Xác nhận khối lượng bê tông M300 đổ ngày 2026-05-28", desc: "TVGS yêu cầu kiểm tra phiếu giao + biên bản nghiệm thu." },
];

const SUBMITTAL_TEMPLATES: Array<{ spec: string; material: string; mfr: string }> = [
  { spec: "03 30 00 — Cast-in-Place Concrete", material: "Bê tông thương phẩm M300", mfr: "Holcim Việt Nam" },
  { spec: "05 12 00 — Structural Steel", material: "Thép cuộn CB400-V D16", mfr: "Hòa Phát" },
  { spec: "22 11 00 — Domestic Water Piping", material: "Ống cấp nước PPR DN25 PN20", mfr: "Tiền Phong" },
  { spec: "26 05 19 — Conductors", material: "Dây điện CV 2x2.5mm² CADIVI", mfr: "Cadivi" },
  { spec: "09 90 00 — Painting and Coating", material: "Sơn ngoại thất Weathercoat Smooth", mfr: "Dulux Akzo Nobel" },
];

const CHANGE_ORDER_TEMPLATES: Array<{ title: string; reason: string; scope: string; deltaVnd: number; deltaDays: number }> = [
  { title: "Lệnh thay đổi #001 — Bổ sung tầng hầm 2", reason: "CĐT yêu cầu mở rộng tầng hầm để bổ sung 30 chỗ đỗ xe.", scope: "Đào thêm 1,500 m³ đất; bê tông móng + sàn hầm 2 850 m³.", deltaVnd: 2_300_000_000, deltaDays: 21 },
  { title: "Lệnh thay đổi #002 — Đổi mác bê tông M300 → M400", reason: "Kết quả khoan địa chất bổ sung yêu cầu nâng mác bê tông.", scope: "Tăng mác bê tông cột + dầm tầng 1-3 từ M300 lên M400.", deltaVnd: 580_000_000, deltaDays: 0 },
  { title: "Lệnh thay đổi #003 — Bỏ hệ trần thạch cao tầng kỹ thuật", reason: "Tối ưu chi phí theo đề xuất CĐT.", scope: "Bỏ trần thạch cao 1,200 m² tầng kỹ thuật, lộ kết cấu.", deltaVnd: -340_000_000, deltaDays: -5 },
];

const BOQ_LINES: Array<{ code: string; description: string; unit: string; qty: number; unitPriceVnd: number; category: string }> = [
  { code: "1.1.1", description: "Đào đất hố móng bằng máy đào ≤0.8 m³", unit: "m³", qty: 4200, unitPriceVnd: 165_000, category: "Phần ngầm" },
  { code: "1.1.2", description: "Vận chuyển đất đào ra bãi cự ly 5km", unit: "m³", qty: 4200, unitPriceVnd: 95_000, category: "Phần ngầm" },
  { code: "1.2.1", description: "Cọc BTCT D400 — vận chuyển + đóng", unit: "m", qty: 3800, unitPriceVnd: 510_000, category: "Phần ngầm" },
  { code: "1.3.1", description: "Bê tông móng đài cọc M300", unit: "m³", qty: 620, unitPriceVnd: 1_780_000, category: "Phần ngầm" },
  { code: "2.1.1", description: "Cốt thép cột CB400V (đường kính ≤18mm)", unit: "kg", qty: 145000, unitPriceVnd: 21_500, category: "Phần thân" },
  { code: "2.1.2", description: "Cốt thép cột CB400V (đường kính >18mm)", unit: "kg", qty: 98000, unitPriceVnd: 20_800, category: "Phần thân" },
  { code: "2.2.1", description: "Cốp pha cột (sử dụng 5 lần)", unit: "m²", qty: 3200, unitPriceVnd: 280_000, category: "Phần thân" },
  { code: "2.3.1", description: "Bê tông cột thương phẩm M300", unit: "m³", qty: 820, unitPriceVnd: 1_650_000, category: "Phần thân" },
  { code: "2.4.1", description: "Cốt thép dầm sàn CB400V", unit: "kg", qty: 215000, unitPriceVnd: 21_300, category: "Phần thân" },
  { code: "2.4.2", description: "Cốp pha dầm sàn (sử dụng 5 lần)", unit: "m²", qty: 8500, unitPriceVnd: 260_000, category: "Phần thân" },
  { code: "2.4.3", description: "Bê tông dầm sàn thương phẩm M300", unit: "m³", qty: 1280, unitPriceVnd: 1_650_000, category: "Phần thân" },
  { code: "3.1.1", description: "Xây tường gạch xi măng 200mm", unit: "m³", qty: 1100, unitPriceVnd: 1_950_000, category: "Hoàn thiện" },
  { code: "3.1.2", description: "Xây tường gạch xi măng 100mm", unit: "m³", qty: 480, unitPriceVnd: 1_950_000, category: "Hoàn thiện" },
  { code: "3.2.1", description: "Trát tường trong vữa XM mác 75", unit: "m²", qty: 12800, unitPriceVnd: 95_000, category: "Hoàn thiện" },
  { code: "3.2.2", description: "Trát tường ngoài vữa XM mác 75", unit: "m²", qty: 4200, unitPriceVnd: 125_000, category: "Hoàn thiện" },
  { code: "3.3.1", description: "Sơn nước nội thất 3 lớp Dulux", unit: "m²", qty: 14500, unitPriceVnd: 58_000, category: "Hoàn thiện" },
  { code: "3.3.2", description: "Sơn nước ngoại thất Weathercoat 3 lớp", unit: "m²", qty: 4200, unitPriceVnd: 92_000, category: "Hoàn thiện" },
  { code: "3.4.1", description: "Lát gạch sàn Granite 600x600", unit: "m²", qty: 5800, unitPriceVnd: 360_000, category: "Hoàn thiện" },
  { code: "4.1.1", description: "Ống cấp nước PPR DN25 PN20 + phụ kiện", unit: "m", qty: 1800, unitPriceVnd: 95_000, category: "MEP" },
  { code: "4.1.2", description: "Ống thoát nước PVC D110 + phụ kiện", unit: "m", qty: 1200, unitPriceVnd: 145_000, category: "MEP" },
  { code: "4.2.1", description: "Dây điện CV 2x2.5mm² Cadivi", unit: "m", qty: 8500, unitPriceVnd: 25_000, category: "MEP" },
  { code: "4.2.2", description: "Dây điện CV 2x4.0mm² Cadivi", unit: "m", qty: 3200, unitPriceVnd: 38_000, category: "MEP" },
  { code: "4.3.1", description: "Tủ điện tổng MCCB 250A — ABB", unit: "cái", qty: 4, unitPriceVnd: 18_500_000, category: "MEP" },
  { code: "4.4.1", description: "Cục lạnh điều hòa multi-split — Daikin 18000BTU", unit: "cái", qty: 24, unitPriceVnd: 22_500_000, category: "MEP" },
  { code: "5.1.1", description: "Cửa nhôm Xingfa kính cường lực", unit: "m²", qty: 380, unitPriceVnd: 2_850_000, category: "Hoàn thiện" },
];

// ─── Main seed ──────────────────────────────────────────────────────────────
async function main() {
  console.log("==> Demo-rich seed starting");

  const orgs = await prisma.organization.findMany();
  const projects = await prisma.project.findMany();
  const users = await prisma.user.findMany();

  // Identify key orgs
  const cofico = orgs.find((o) => o.slug === "cofico");                  // NHA_THAU_CHINH
  const apave = orgs.find((o) => o.slug === "apave");                    // TU_VAN_GIAM_SAT
  const aaDesign = orgs.find((o) => o.slug === "aa-design");             // TU_VAN_THIET_KE
  const vinhomes = orgs.find((o) => o.slug === "vinhomes");              // CHU_DAU_TU
  if (!cofico || !apave || !aaDesign) throw new Error("Missing required orgs (cofico/apave/aa-design)");

  // Pick a default reporter/author/uploader user
  const cofiUser = users.find((u) => u.email === "anh.nguyen@cofico.vn") ?? users[0];

  console.log(`==> Found ${projects.length} projects, ${orgs.length} orgs, ${users.length} users`);

  // Phase 1: stakeholders for every project
  console.log("==> Phase 1: stakeholders");
  for (const p of projects) {
    const desired: Array<{ orgId: string; role: any }> = [
      { orgId: cofico.id, role: "NHA_THAU_CHINH" },
      { orgId: apave.id, role: "TU_VAN_GIAM_SAT" },
      { orgId: aaDesign.id, role: "TU_VAN_THIET_KE" },
    ];
    if (vinhomes && p.ownerOrgId !== vinhomes.id) {
      desired.push({ orgId: vinhomes.id, role: "CHU_DAU_TU" });
    }
    for (const s of desired) {
      await prisma.projectStakeholder.upsert({
        where: { projectId_orgId_role: { projectId: p.id, orgId: s.orgId, role: s.role } },
        create: { projectId: p.id, orgId: s.orgId, role: s.role },
        update: {},
      });
    }
  }

  // Phase 2: per-project content
  console.log("==> Phase 2: per-project content");
  for (const p of projects) {
    console.log(`   - ${p.key} ${p.name}`);
    try {
      await seedProject(p, cofico.id, cofiUser.id);
    } catch (e: any) {
      console.error(`     !! failed: ${e?.message ?? e}`);
    }
  }

  // Phase 3: per-org content (NT_CHINH / NT_PHU / CDT)
  console.log("==> Phase 3: per-org content");
  const orgsToSeed = orgs.filter((o) => ["NHA_THAU_CHINH", "NHA_THAU_PHU", "CHU_DAU_TU"].includes(o.type));
  for (const o of orgsToSeed) {
    console.log(`   - ${o.name} (${o.type})`);
    try {
      await seedOrg(o, projects.filter((p) => p.ownerOrgId === o.id), cofiUser.id);
    } catch (e: any) {
      console.error(`     !! failed: ${e?.message ?? e}`);
    }
  }

  console.log("==> Done");
}

async function seedProject(p: { id: string; key: string; name: string; ownerOrgId: string }, cofiOrgId: string, reporterId: string) {
  const pid = p.id;

  // 2a — ScheduleTask: 10 tasks spread across past 30d → next 60d
  for (let i = 0; i < SCHEDULE_TASKS.length; i++) {
    const t = SCHEDULE_TASKS[i];
    const startOffset = -30 + i * 9; // staggered
    const plannedStart = day(startOffset);
    const plannedEnd = day(startOffset + t.days);
    const stateMap: Array<"DONE" | "IN_PROGRESS" | "PLANNED"> = ["DONE", "DONE", "IN_PROGRESS", "IN_PROGRESS", "PLANNED", "PLANNED", "PLANNED", "PLANNED", "PLANNED", "PLANNED", "PLANNED"];
    const state = stateMap[i];
    const pct = state === "DONE" ? 100 : state === "IN_PROGRESS" ? rand(35, 75) : 0;
    await prisma.scheduleTask.upsert({
      where: { projectId_code: { projectId: pid, code: t.code } },
      create: {
        projectId: pid,
        code: t.code,
        name: t.name,
        discipline: t.discipline,
        zone: t.zone,
        plannedStart,
        plannedEnd,
        actualStart: state !== "PLANNED" ? plannedStart : null,
        actualEnd: state === "DONE" ? plannedEnd : null,
        pctComplete: pct,
        state,
        isCritical: !!t.critical,
        ownerOrgId: cofiOrgId,
      },
      update: {},
    });
  }

  // 2b — Crew + CrewAssignment (next 14 days)
  const crewIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const c = CREWS[i];
    let existing = await prisma.crew.findFirst({ where: { projectId: pid, name: c.name } });
    if (!existing) {
      existing = await prisma.crew.create({
        data: { projectId: pid, name: c.name, trade: c.trade, foremanName: c.foremanName, headcount: c.headcount, active: true },
      });
    }
    crewIds.push(existing.id);
  }
  // Build 21 assignments across next 14 days
  const taskTitles = [
    "Buộc thép cột trục A-F tầng 12",
    "Đổ bê tông sàn tầng 8 — cánh Tây",
    "Lắp ống PPR cấp nước căn 12A05-12A10",
    "Xây tường 200mm khu B tầng 3",
    "Sơn nước nội thất căn 5A-12 đến 5A-18",
    "Cốp pha dầm tầng 7 trục 1-5",
    "Lắp dây điện ổ cắm tầng 4 khu A",
    "Hoàn thiện trát tường ngoài trục C-12",
  ];
  const zones = ["Tầng 3 — Khu A", "Tầng 5 — Khu B", "Tầng 7 — Trục 1-5", "Tầng 8 — Cánh Tây", "Tầng 12 — Khu A"];
  const stateMix: Array<"PLANNED" | "IN_PROGRESS" | "DONE" | "BLOCKED"> = ["IN_PROGRESS", "PLANNED", "PLANNED", "DONE", "PLANNED", "BLOCKED", "IN_PROGRESS", "PLANNED", "DONE", "PLANNED", "PLANNED", "PLANNED", "IN_PROGRESS", "PLANNED", "DONE", "PLANNED", "PLANNED", "PLANNED", "IN_PROGRESS", "PLANNED", "PLANNED"];
  // Check if assignments already exist for this project — if any, skip
  const existingAssignCount = await prisma.crewAssignment.count({ where: { projectId: pid } });
  if (existingAssignCount < 5) {
    for (let i = 0; i < 21; i++) {
      const offset = Math.floor(i / 2); // ~2 per day
      const workDate = day(offset);
      const state = stateMix[i];
      await prisma.crewAssignment.create({
        data: {
          projectId: pid,
          crewId: pick(crewIds, i),
          workDate,
          shift: "DAY",
          title: pick(taskTitles, i),
          description: i % 3 === 0 ? "Phối hợp với TVGS kiểm tra trước khi đổ bê tông." : null,
          zone: pick(zones, i),
          state,
          blockedReason: state === "BLOCKED" ? "Đợi shop drawing cập nhật từ TVTK" : null,
          hoursPlanned: 8,
          hoursActual: state === "DONE" ? 8 : state === "IN_PROGRESS" ? 4 : null,
        },
      });
    }
  }

  // 2c — SiteWorker
  const workerIds: string[] = [];
  for (let i = 0; i < WORKERS.length; i++) {
    const w = WORKERS[i];
    const code = `${p.key.slice(0, 4)}-W-${(i + 1).toString().padStart(3, "0")}`;
    let existing = await prisma.siteWorker.findFirst({ where: { orgId: cofiOrgId, workerCode: code } });
    if (!existing) {
      existing = await prisma.siteWorker.create({
        data: {
          orgId: cofiOrgId,
          projectId: pid,
          workerCode: code,
          fullName: w.fullName,
          trade: w.trade,
          level: w.level ?? null,
          isStaff: !!w.isStaff,
          phone: `09${rand(10000000, 99999999)}`,
          hometown: pick(["Nam Định", "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Bắc Giang"], i),
          hseGroup: w.isStaff ? "N2" : "N4",
          hseCertNumber: `ATLĐ-${rand(10000, 99999)}/2025`,
          hseCertExpiry: day(180 + rand(0, 365)),
          startedAt: day(-rand(30, 200)),
          state: "ACTIVE",
        },
      });
    } else if (!existing.projectId) {
      existing = await prisma.siteWorker.update({ where: { id: existing.id }, data: { projectId: pid } });
    }
    workerIds.push(existing.id);
  }

  // 2d — DailyLog (last 7 days)
  for (let d = -7; d <= -1; d++) {
    const date = day(d);
    const existing = await prisma.dailyLog.findUnique({ where: { projectId_date_shift: { projectId: pid, date, shift: "DAY" } } });
    if (existing) continue;
    await prisma.dailyLog.create({
      data: {
        projectId: pid,
        date,
        authorId: reporterId,
        weather: pick(["Nắng nóng 32°C", "Mưa rào nhẹ", "Nắng nhẹ 28°C", "Có mây 30°C"], d + 7),
        shift: "DAY",
        workforce: [
          { trade: "thợ sắt", count: rand(8, 14) },
          { trade: "thợ bê tông", count: rand(10, 18) },
          { trade: "thợ điện", count: rand(4, 8) },
          { trade: "thợ ống nước", count: rand(3, 6) },
          { trade: "thợ xây/trát", count: rand(8, 16) },
        ],
        workDone: pick([
          "Hoàn thành đổ bê tông cột tầng 4 trục A-F. Kiểm tra cốt thép tầng 5 đạt yêu cầu.",
          "Buộc thép sàn tầng 6 — hoàn thành 60% diện tích trục 1-6.",
          "Lắp đặt ống cấp nước PPR tầng 3 — 70% hoàn thành. Phối hợp ME tổ điện tầng 4.",
          "Xây tường ngăn 200mm tầng 2 khu B đạt 80%. Trát tường ngoài tầng 1.",
        ], d + 7),
        workTomorrow: "Tiếp tục đổ bê tông cột tầng 5. Triển khai cốp pha dầm tầng 6.",
        safetyNotes: d === -3 ? "Ghi nhận 1 trường hợp thợ chưa đội mũ — đã nhắc nhở + tập huấn lại." : null,
      },
    });
  }

  // 2e — Issues + sub-types (RFI/NCR/Submittal/PunchItem/ChangeOrder)
  // Generic Issues
  const existingIssueCount = await prisma.issue.count({ where: { projectId: pid } });
  let nextIssueNum = existingIssueCount + 1;
  const mkKey = (typ: string, n: number) => `${p.key}-${typ}-${n.toString().padStart(3, "0")}`;

  // 5 generic
  for (let i = 0; i < ISSUE_TEMPLATES.length; i++) {
    const t = ISSUE_TEMPLATES[i];
    const key = mkKey("ISS", nextIssueNum++);
    if (await prisma.issue.findUnique({ where: { key } })) continue;
    await prisma.issue.create({
      data: {
        key, projectId: pid, type: "TASK", title: t.title, description: t.desc,
        state: i % 2 === 0 ? "OPEN" : "IN_PROGRESS", priority: pick(["LOW", "MEDIUM", "HIGH"], i) as any,
        reporterId, locationZone: pick(zones, i), dueDate: day(rand(3, 14)),
      },
    });
  }

  // RFIs
  for (let i = 0; i < RFI_TEMPLATES.length; i++) {
    const t = RFI_TEMPLATES[i];
    const key = mkKey("RFI", nextIssueNum++);
    if (await prisma.issue.findUnique({ where: { key } })) continue;
    const issue = await prisma.issue.create({
      data: {
        key, projectId: pid, type: "RFI", title: t.q.slice(0, 80),
        description: t.q, state: i < 2 ? "ANSWERED" : "OPEN",
        priority: i === 0 ? "HIGH" : "MEDIUM", reporterId, dueDate: day(rand(2, 10)),
      },
    });
    await prisma.rFI.create({
      data: {
        issueId: issue.id, question: t.q, category: t.cat,
        requestedById: cofiOrgId, respondedById: i < 2 ? cofiOrgId : null,
        answer: i < 2 ? "Theo bản vẽ KC-203 rev.B — sử dụng chi tiết B trên hồ sơ. TVTK đã xác nhận." : null,
        answeredAt: i < 2 ? day(-2) : null,
        needBy: day(rand(2, 10)),
        projectId: pid,
      },
    });
  }

  // NCRs
  for (let i = 0; i < NCR_TEMPLATES.length; i++) {
    const t = NCR_TEMPLATES[i];
    const key = mkKey("NCR", nextIssueNum++);
    if (await prisma.issue.findUnique({ where: { key } })) continue;
    const issue = await prisma.issue.create({
      data: {
        key, projectId: pid, type: "NCR", title: t.title,
        description: `Phát hiện qua kiểm tra QC định kỳ. ${t.root}`,
        state: i === 0 ? "RECTIFIED" : "OPEN", priority: t.sev === "CRITICAL" ? "CRITICAL" : t.sev === "MAJOR" ? "HIGH" : "MEDIUM",
        reporterId, dueDate: day(rand(3, 10)), locationZone: pick(zones, i),
      },
    });
    await prisma.nCR.create({
      data: {
        issueId: issue.id, severity: t.sev, rootCause: t.root,
        correctiveAction: i === 0 ? "Đục bỏ bê tông cột bị nứt, đổ lại theo TCVN 5574:2018 mục 10.4. TVGS giám sát toàn bộ quá trình." : null,
        preventiveAction: "Tăng cường tập huấn quy trình đổ bê tông cho tổ trưởng. Bổ sung kiểm tra mạch ngừng trước khi đổ.",
        raisedByOrgId: cofiOrgId, responsibleOrgId: cofiOrgId,
        qcvnRef: t.qcvn, rectifiedAt: i === 0 ? day(-2) : null,
        projectId: pid,
      },
    });
  }

  // Submittals
  for (let i = 0; i < SUBMITTAL_TEMPLATES.length; i++) {
    const t = SUBMITTAL_TEMPLATES[i];
    const key = mkKey("SBM", nextIssueNum++);
    if (await prisma.issue.findUnique({ where: { key } })) continue;
    const issue = await prisma.issue.create({
      data: {
        key, projectId: pid, type: "SUBMITTAL", title: `Submittal: ${t.material}`,
        description: `Spec ${t.spec} — nhà thầu trình duyệt ${t.material} của ${t.mfr}.`,
        state: i === 0 ? "APPROVED" : i === 1 ? "APPROVED_AS_NOTED" : "OPEN",
        priority: "MEDIUM", reporterId, dueDate: day(rand(5, 14)),
      },
    });
    await prisma.submittal.create({
      data: {
        issueId: issue.id, specSection: t.spec, materialName: t.material, manufacturer: t.mfr,
        submitterOrgId: cofiOrgId,
        decision: i === 0 ? "APPROVED" : i === 1 ? "APPROVED_AS_NOTED" : null,
        decidedAt: i < 2 ? day(-i - 1) : null,
        projectId: pid,
      },
    });
  }

  // ChangeOrders
  for (let i = 0; i < CHANGE_ORDER_TEMPLATES.length; i++) {
    const t = CHANGE_ORDER_TEMPLATES[i];
    const key = mkKey("CO", nextIssueNum++);
    if (await prisma.issue.findUnique({ where: { key } })) continue;
    const issue = await prisma.issue.create({
      data: {
        key, projectId: pid, type: "CHANGE_ORDER", title: t.title, description: t.reason,
        state: i === 0 ? "APPROVED" : "DRAFT", priority: "HIGH", reporterId, dueDate: day(rand(7, 21)),
      },
    });
    await prisma.changeOrder.create({
      data: {
        issueId: issue.id, reason: t.reason, scopeChange: t.scope,
        costDeltaVnd: bigVnd(t.deltaVnd), scheduleDeltaDays: t.deltaDays,
        approvedAt: i === 0 ? day(-5) : null,
        approvedByUserId: i === 0 ? reporterId : null,
        projectId: pid,
      },
    });
  }

  // PunchItems
  const punchZones = ["Căn 5A-12", "Căn 5A-15", "Căn 8B-03", "Tầng 2 — Sảnh", "Tầng 6 — Hành lang", "Căn 10A-08"];
  for (let i = 0; i < 8; i++) {
    const key = mkKey("PNC", nextIssueNum++);
    if (await prisma.issue.findUnique({ where: { key } })) continue;
    const issue = await prisma.issue.create({
      data: {
        key, projectId: pid, type: "PUNCH",
        title: pick(["Sơn vênh không đều", "Nứt mối nối tường thạch cao", "Cửa kéo cứng", "Vết loang sơn trần", "Hở mép gạch ốp", "Ron gạch bám bụi không sạch"], i),
        state: i < 3 ? "ACCEPTED" : "OPEN", priority: "LOW", reporterId, locationZone: pick(punchZones, i),
        dueDate: day(rand(2, 7)),
      },
    });
    await prisma.punchItem.create({
      data: {
        issueId: issue.id, trade: pick(["Sơn", "Thạch cao", "Cửa", "Gạch ốp"], i),
        zone: pick(punchZones, i), acceptedAt: i < 3 ? day(-i - 1) : null, projectId: pid,
      },
    });
  }

  // 2f — BoQ + lines
  const existingBoq = await prisma.boQ.findFirst({ where: { projectId: pid, isCurrent: true } });
  if (!existingBoq) {
    const totalVnd = BOQ_LINES.reduce((s, l) => s + l.qty * l.unitPriceVnd, 0);
    const boq = await prisma.boQ.create({
      data: { projectId: pid, name: "BoQ hợp đồng thi công chính", contractValueVnd: bigVnd(totalVnd), version: "v1", isCurrent: true },
    });
    for (const l of BOQ_LINES) {
      await prisma.boQLine.create({
        data: {
          boqId: boq.id, code: l.code, description: l.description,
          unit: l.unit, qty: l.qty, unitPriceVnd: bigVnd(l.unitPriceVnd),
          totalVnd: bigVnd(l.qty * l.unitPriceVnd),
          qtyCompleted: l.qty * (0.1 + Math.random() * 0.4),
          category: l.category,
        },
      });
    }
  }

  // 2g — ProgressPayment + PaymentApplication
  for (let m = 0; m < 4; m++) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - m);
    const period = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    const workDone = 1_800_000_000 + rand(-400_000_000, 600_000_000);
    const vat = Math.round(workDone * 0.08);
    const retention = Math.round(workDone * 0.05);
    const cumulative = workDone * (4 - m);
    let pp = await prisma.progressPayment.findUnique({ where: { projectId_period: { projectId: pid, period } } });
    if (!pp) {
      pp = await prisma.progressPayment.create({
        data: {
          projectId: pid, period,
          workDoneVnd: bigVnd(workDone), vatRate: 8, vatVnd: bigVnd(vat),
          retentionPct: 5, retentionVnd: bigVnd(retention), cumulativeVnd: bigVnd(cumulative),
          state: m === 0 ? "SUBMITTED" : m === 1 ? "APPROVED" : "PAID",
          submittedAt: day(-m * 30 - 5), approvedAt: m > 0 ? day(-m * 30) : null, paidAt: m > 1 ? day(-m * 30 + 10) : null,
        },
      });
    }
    const netPay = workDone - retention + vat;
    const appCode = `TT-${p.key}-${period}-001`;
    const appExists = await prisma.paymentApplication.findFirst({ where: { projectId: pid, code: appCode } });
    if (!appExists) {
      await prisma.paymentApplication.create({
        data: {
          projectId: pid, code: appCode, period,
          paymentType: "GIAI_DOAN", fundSource: "DOANH_NGHIEP",
          contractorOrgId: cofiOrgId,
          contractRef: `HD-${p.key}-2025/01`,
          contractValueVnd: bigVnd(45_000_000_000),
          progressPaymentId: pp.id,
          workDoneVnd: bigVnd(workDone), cumulativeWorkVnd: bigVnd(cumulative),
          retentionVnd: bigVnd(retention), vatRate: 8, vatVnd: bigVnd(vat),
          netPayableVnd: bigVnd(netPay),
          acceptanceIds: [], changeOrderIds: [], attachmentIds: [],
          state: m === 0 ? "DRAFT" : m === 1 ? "CDT_APPROVED" : "PAID",
          ntSignedAt: m > 0 ? day(-m * 30 - 4) : null,
          tvgsSignedAt: m > 0 ? day(-m * 30 - 3) : null,
          cdtApprovedAt: m > 0 ? day(-m * 30) : null,
          paidAt: m > 1 ? day(-m * 30 + 10) : null,
          paidVnd: m > 1 ? bigVnd(netPay) : null,
        },
      });
    }
  }

  // 2h — Models + Elements + Clashes (DrawBridge)
  const modelDefs = [
    { name: "Federated_struct_v3.nwd", disc: "KET_CAU", fmt: "NWD" as const },
    { name: "MEP_combined_v2.ifc", disc: "CO_DIEN_M", fmt: "IFC" as const },
  ];
  const existingModelCount = await prisma.model.count({ where: { projectId: pid } });
  if (existingModelCount < 2) {
    for (const m of modelDefs) {
      const model = await prisma.model.create({
        data: {
          projectId: pid, name: m.name, discipline: m.disc as any,
          fileUrl: `s3://models/${pid}/${m.name}`,
          fileSizeBytes: bigVnd(rand(50, 250) * 1024 * 1024),
          format: m.fmt, revision: "v3",
          uploadedByUserId: reporterId, apsTranslationStatus: "SUCCESS", apsTranslationProgress: 100,
        },
      });
      // 8 elements per model
      const cats = m.disc === "KET_CAU" ? ["Cột", "Dầm", "Sàn", "Tường"] : ["MEP-Pipe", "MEP-Duct", "MEP-Cable", "MEP-Equipment"];
      const eIds: string[] = [];
      for (let i = 0; i < 8; i++) {
        const e = await prisma.modelElement.create({
          data: {
            modelId: model.id, elementId: `${m.name}-E-${i + 1}`,
            name: `${cats[i % cats.length]} ${i + 1}`,
            category: cats[i % cats.length],
            discipline: m.disc as any,
            level: `Tầng ${rand(1, 12)}`,
            zone: pick(["Khu A", "Khu B"], i),
            ifcType: `Ifc${cats[i % cats.length].replace(/[^A-Za-z]/g, "")}`,
            bbox: [0, 0, 0, 1, 1, 1],
          },
        });
        eIds.push(e.id);
      }
      // 4 clashes per model (pairs of elements)
      for (let i = 0; i < 4; i++) {
        const a = eIds[i * 2 % eIds.length];
        const b = eIds[(i * 2 + 1) % eIds.length];
        if (a === b) continue;
        await prisma.clash.create({
          data: {
            projectId: pid, elementAId: a, elementBId: b,
            category: i === 0 ? "HARD" : i === 1 ? "CLEARANCE" : "HARD",
            description: pick([
              "Cột giao với ống cấp nước chính D110.",
              "Dầm va với máng cáp điện 600x100.",
              "Tường ngăn xuyên qua ống HVAC.",
              "Sàn cắt qua ống thoát đứng D200.",
            ], i),
            severity: rand(50, 90), status: i === 0 ? "TRIAGED" : "OPEN",
          },
        });
      }
    }
  }

  // 2i — SiteCamera + VisionEvent (PPE violations)
  const cameraDefs = [
    { name: "Cổng chính", location: "Cổng A — hướng Đông" },
    { name: "Khu A — Tầng 5", location: "Tầng 5, trục B-3" },
    { name: "Khu cẩu tháp #1", location: "Trục C-7 cao 25m" },
  ];
  const existingCamCount = await prisma.siteCamera.count({ where: { projectId: pid } });
  if (existingCamCount < 3) {
    for (const c of cameraDefs) {
      const cam = await prisma.siteCamera.create({
        data: { projectId: pid, name: c.name, location: c.location, streamUrl: `rtsp://cam.aecplatform.vn/${pid}/${c.name}`, active: true },
      });
      // 4 vision events per camera (PPE violations + worker counts)
      for (let i = 0; i < 4; i++) {
        await prisma.visionEvent.create({
          data: {
            projectId: pid, cameraId: cam.id,
            kind: i === 0 || i === 1 ? "PPE_VIOLATION" : i === 2 ? "WORKER_COUNT" : "INTRUSION",
            ts: dayAt(-rand(0, 6), rand(7, 17), rand(0, 59)),
            confidence: 0.7 + Math.random() * 0.25,
            bbox: [rand(50, 400), rand(50, 400), rand(50, 200), rand(50, 200)],
            label: i === 0 ? "hard_hat_missing" : i === 1 ? "safety_vest_missing" : i === 2 ? "person_count" : "person",
            payload: i === 2 ? { count: rand(15, 45) } : null,
            acknowledged: i > 1,
          },
        });
      }
    }
  }

  // 2j — IncidentReport
  const existingIncCount = await prisma.incidentReport.count({ where: { projectId: pid } });
  if (existingIncCount < 2) {
    const incs = [
      { cat: "AN_TOAN_LAO_DONG" as const, sev: "MINOR" as const, desc: "Công nhân Nguyễn V.T. bị trượt ngã khi di chuyển trên giàn giáo tầng 3 — chấn thương nhẹ tay phải. Đã sơ cứu tại y tế công trường + đi viện kiểm tra." },
      { cat: "ROI_NGA" as const, sev: "NEAR_MISS" as const, desc: "Vật liệu (thanh thép D16) rơi từ tầng 5 xuống khu vực đang thi công — không có người trong vùng. Đã chấn chỉnh quy trình bốc xếp + căng lưới an toàn." },
      { cat: "DIEN_GIAT" as const, sev: "MINOR" as const, desc: "Thợ điện chạm vào dây nóng hở do bị chuột cắn — bị giật nhẹ, không thương tích. Đã thay đoạn dây hỏng + kiểm tra toàn tuyến." },
    ];
    for (const inc of incs) {
      await prisma.incidentReport.create({
        data: {
          projectId: pid, reporterId,
          occurredAt: dayAt(-rand(1, 14), rand(9, 16)),
          category: inc.cat, severity: inc.sev, description: inc.desc,
          location: pick(["Tầng 3 — Khu A", "Cổng B", "Tầng 5 — Cánh Đông"], 0),
          injured: inc.sev === "NEAR_MISS" ? 0 : 1,
          rootCause: "Phân tích nguyên nhân: thiếu PPE + thiếu kiểm tra trước ca.",
          immediateAction: "Sơ cứu + đưa nạn nhân đi y tế. Tạm dừng công việc khu vực.",
          preventiveAction: "Tăng cường tập huấn ATLĐ tổ liên quan. Bổ sung lưới an toàn + biển báo.",
        },
      });
    }
  }

  // 2k — HandoverTickets
  const existingHandover = await prisma.handoverTicket.count({ where: { projectId: pid } });
  if (existingHandover < 3) {
    const tickets = [
      { cat: "THAM_DOT" as const, sev: "HIGH" as const, title: "Thấm dột trần phòng ngủ căn 12A-05", desc: "Cư dân báo trần phòng ngủ chính thấm nước sau cơn mưa lớn ngày 28/05.", reporter: "Anh Trần Quốc Anh", phone: "0912345678", unit: "12A-05" },
      { cat: "CAP_THOAT_NUOC" as const, sev: "MEDIUM" as const, title: "Rò rỉ ống cấp nước bồn rửa căn 8B-03", desc: "Khớp nối ống cấp nước bồn rửa bị rò rỉ, đã tự xử lý tạm.", reporter: "Chị Nguyễn Thị Hà", phone: "0987654321", unit: "8B-03" },
      { cat: "DIEN_GIAT" as const, sev: "CRITICAL" as const, title: "Ổ cắm phòng khách giật điện căn 5A-12", desc: "Ổ cắm gần TV bị giật điện nhẹ khi cắm thiết bị, cư dân lo lắng.", reporter: "Chị Lê Mai Hương", phone: "0934567890", unit: "5A-12" },
      { cat: "CUA_KHOA" as const, sev: "LOW" as const, title: "Khóa cửa chính bị kẹt căn 3A-08", desc: "Khóa cửa khó xoay, cần điều chỉnh lại bản lề.", reporter: "Anh Phạm Văn Đức", phone: "0901234567", unit: "3A-08" },
      { cat: "SON_HOAN_THIEN" as const, sev: "LOW" as const, title: "Bong sơn tường phòng ngủ căn 15A-02", desc: "Sơn tường gần cửa sổ bong tróc do hơi ẩm.", reporter: "Chị Đỗ Thu Trang", phone: "0976543210", unit: "15A-02" },
    ];
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      await prisma.handoverTicket.create({
        data: {
          projectId: pid,
          ticketNumber: `HG-${p.key.slice(0, 6)}-${(i + 1).toString().padStart(3, "0")}`,
          unitCode: t.unit,
          category: t.cat, severity: t.sev,
          title: t.title, description: t.desc,
          reporterName: t.reporter, reporterPhone: t.phone,
          reportedAt: dayAt(-rand(1, 14), rand(8, 17)),
          warrantyType: t.cat === "THAM_DOT" || t.cat === "CAP_THOAT_NUOC" ? "PHAN_CHINH" : "PHAN_PHU",
          warrantyEndsAt: day(rand(180, 540)),
          state: i === 0 ? "IN_PROGRESS" : i === 1 ? "RECTIFIED" : i === 2 ? "TRIAGED" : i === 3 ? "VERIFIED" : "NEW",
          assigneeOrgId: cofiOrgId,
          slaDueAt: dayAt(t.sev === "CRITICAL" ? -1 : t.sev === "HIGH" ? 1 : t.sev === "MEDIUM" ? 3 : 7, 17),
          customerSatisfactionScore: i === 3 ? 5 : null,
        },
      });
    }
  }

  // 2l — Attendance (last 7 days × first 6 workers)
  const existingAttendance = await prisma.attendance.count({ where: { projectId: pid } });
  if (existingAttendance < 5) {
    for (let d = -7; d <= -1; d++) {
      for (let w = 0; w < Math.min(workerIds.length, 6); w++) {
        await prisma.attendance.create({
          data: {
            workerId: workerIds[w],
            projectId: pid,
            checkInAt: dayAt(d, 7, rand(0, 30)),
            checkOutAt: dayAt(d, 17, rand(0, 30)),
            gateCode: pick(["Cổng A", "Cổng B"], w + d),
            method: pick(["QR", "FACE", "QR"], w + d) as any,
            faceMatchScore: 0.85 + Math.random() * 0.13,
            ppeStatus: { helmet: true, vest: true, boots: true },
          },
        });
      }
    }
  }
}

const TERRITORIES: Array<{ name: string; province: string; scope: string }> = [
  { name: "Miền Bắc — HN & lân cận", province: "Hà Nội", scope: "Hà Nội, Hưng Yên, Hải Dương, Hà Nam, Vĩnh Phúc, Bắc Ninh." },
  { name: "Miền Trung — Đà Nẵng", province: "Đà Nẵng", scope: "Đà Nẵng, Quảng Nam, Thừa Thiên Huế." },
  { name: "Miền Nam — TP.HCM & ĐBSCL", province: "TP. HCM", scope: "TP. HCM, Bình Dương, Đồng Nai, Long An, Tiền Giang." },
];

const LEAD_TEMPLATES: Array<{ name: string; clientName: string; province: string; estValueVnd: number; source: string; status: "POTENTIAL" | "TRACKING" | "WON" | "LOST" }> = [
  { name: "Gói thầu CC2 — Khu đô thị Eco Park giai đoạn 3", clientName: "Vihajico", province: "Hưng Yên", estValueVnd: 320_000_000_000, source: "Báo Đấu thầu", status: "TRACKING" },
  { name: "Cải tạo trường mầm non quận Cầu Giấy", clientName: "UBND Quận Cầu Giấy", province: "Hà Nội", estValueVnd: 28_000_000_000, source: "Cổng DVCQG", status: "POTENTIAL" },
  { name: "Cầu vượt nút giao Quốc Lộ 1A Đà Nẵng", clientName: "Sở GTVT Đà Nẵng", province: "Đà Nẵng", estValueVnd: 145_000_000_000, source: "Sở GTVT", status: "TRACKING" },
  { name: "Bệnh viện đa khoa Cần Thơ — gói thầu PCCC", clientName: "Sở Y tế Cần Thơ", province: "Cần Thơ", estValueVnd: 92_000_000_000, source: "Báo Đấu thầu", status: "POTENTIAL" },
  { name: "Tổ hợp văn phòng Vinhomes Smart City", clientName: "Vinhomes", province: "Hà Nội", estValueVnd: 580_000_000_000, source: "Direct contact", status: "WON" },
  { name: "Nhà máy sản xuất pin xe điện VinFast Hà Tĩnh", clientName: "VinFast", province: "Hà Tĩnh", estValueVnd: 850_000_000_000, source: "Hội nghị khách hàng", status: "TRACKING" },
  { name: "Cảng Container Cát Lái — bến C giai đoạn 2", clientName: "Saigon Newport", province: "TP. HCM", estValueVnd: 410_000_000_000, source: "Báo Đấu thầu", status: "POTENTIAL" },
  { name: "Sửa chữa đường ống cấp nước Sông Đà", clientName: "Sông Đà Water", province: "Hà Nội", estValueVnd: 65_000_000_000, source: "Cổng DVCQG", status: "LOST" },
];

const ADV_TEMPLATES: Array<{ type: "TAM_UNG" | "THANH_TOAN" | "HOAN_UNG"; payee: string; amount: number; purpose: string; dayOff: number; status: "PENDING" | "APPROVED" | "SETTLED" }> = [
  { type: "TAM_UNG", payee: "Tổ thi công Lê Văn Hùng", amount: 250_000_000, purpose: "Tạm ứng nhân công + vật tư phụ tuần 22/2026", dayOff: -10, status: "APPROVED" },
  { type: "TAM_UNG", payee: "Công ty Hòa Phát", amount: 1_200_000_000, purpose: "Tạm ứng 30% giá trị HĐ thép cuộn CB400-V Q2/2026", dayOff: -45, status: "SETTLED" },
  { type: "THANH_TOAN", payee: "Tổ MEP Phạm Tuấn Anh", amount: 180_000_000, purpose: "Thanh toán khối lượng MEP tầng 3-4 đã nghiệm thu", dayOff: -7, status: "APPROVED" },
  { type: "THANH_TOAN", payee: "Bảo hiểm xã hội TP HN", amount: 95_000_000, purpose: "Đóng BHXH/BHYT/BHTN tháng 05/2026 cho 48 NLĐ", dayOff: -3, status: "APPROVED" },
  { type: "HOAN_UNG", payee: "Tổ thi công Lê Văn Hùng", amount: 32_000_000, purpose: "Hoàn ứng phần chưa sử dụng — chứng từ #TU-2026-018", dayOff: -2, status: "PENDING" },
  { type: "TAM_UNG", payee: "Holcim Việt Nam", amount: 850_000_000, purpose: "Tạm ứng theo hợp đồng cung cấp bê tông thương phẩm M300", dayOff: -28, status: "APPROVED" },
  { type: "THANH_TOAN", payee: "Cadivi Sài Gòn", amount: 320_000_000, purpose: "Thanh toán dây điện CV đợt 2 — kèm phiếu giao 156/PG", dayOff: -14, status: "APPROVED" },
  { type: "TAM_UNG", payee: "Công ty bảo trì giàn giáo Đại Phong", amount: 145_000_000, purpose: "Tạm ứng thuê giàn giáo + khung chống Q3/2026", dayOff: -1, status: "PENDING" },
];

const DOC_TEMPLATES: Array<{ docNo: string; cat: "QUYET_DINH" | "THONG_BAO" | "QUY_CHE" | "QUY_TRINH" | "BIEN_BAN"; title: string; body: string }> = [
  { docNo: "QĐ-23/2026-CFC", cat: "QUYET_DINH", title: "Quyết định bổ nhiệm Chỉ huy phó công trường dự án VHGP-S9", body: "Bổ nhiệm KS Nguyễn Hoàng Long làm Chỉ huy phó kể từ 01/06/2026..." },
  { docNo: "TB-12/2026-CFC", cat: "THONG_BAO", title: "Thông báo lịch nghỉ lễ 02/9 và bố trí trực ca", body: "Toàn công ty nghỉ lễ Quốc khánh 30/8 - 02/9. Các đội công trường ứng trực theo lịch..." },
  { docNo: "QC-05/2026-CFC", cat: "QUY_CHE", title: "Quy chế quản lý chi phí vận hành công trường", body: "Áp dụng cho toàn bộ công trường thi công trực thuộc Cofico kể từ Q3/2026..." },
  { docNo: "QT-08/2026-CFC", cat: "QUY_TRINH", title: "Quy trình nghiệm thu khối lượng và lập phiếu giá thanh toán", body: "Thực hiện theo NĐ 06/2021 Điều 23 + TT 09/2019/TT-BXD..." },
  { docNo: "BB-31/2026-CFC", cat: "BIEN_BAN", title: "Biên bản họp giao ban tuần 22/2026 — Ban điều hành công trường", body: "Thời gian: 08h00 thứ Hai 02/6/2026. Thành phần: Chỉ huy trưởng, Chỉ huy phó, TVGS..." },
  { docNo: "QĐ-24/2026-CFC", cat: "QUYET_DINH", title: "Quyết định ban hành danh mục PPE bắt buộc theo từng vị trí công việc", body: "Phụ lục danh mục mũ/giày/dây an toàn theo nhóm công việc theo Thông tư 04/2017..." },
  { docNo: "TB-13/2026-CFC", cat: "THONG_BAO", title: "Thông báo tổng kiểm tra an toàn lao động + PCCC quý 2", body: "Lịch tổng kiểm tra ATLĐ + PCCC toàn công ty: 15/06 – 30/06/2026. Đề nghị các đơn vị..." },
  { docNo: "QT-09/2026-CFC", cat: "QUY_TRINH", title: "Quy trình ứng phó sự cố cháy nổ tại công trường", body: "Áp dụng theo QCVN 06:2022/BXD + Luật PCCC. Mỗi công trường phải lập phương án..." },
];

const BHXH_TEMPLATES: Array<{ name: string; idNo: string; status: "DANG_DONG" | "TAM_DUNG" | "CHO_DANG_KY" | "DA_NGHI"; base: number }> = [
  { name: "Nguyễn Văn Anh", idNo: "001083012345", status: "DANG_DONG", base: 25_000_000 },
  { name: "Trần Thị Mai", idNo: "001186023456", status: "DANG_DONG", base: 18_500_000 },
  { name: "Lê Đình Long", idNo: "001190034567", status: "DANG_DONG", base: 11_000_000 },
  { name: "Phạm Quốc Hùng", idNo: "001285045678", status: "DANG_DONG", base: 12_500_000 },
  { name: "Hoàng Văn Tuấn", idNo: "001388056789", status: "DANG_DONG", base: 10_800_000 },
  { name: "Đỗ Quang Minh", idNo: "001492067890", status: "TAM_DUNG", base: 14_000_000 },
  { name: "Vũ Đức Anh", idNo: "001587078901", status: "DANG_DONG", base: 11_500_000 },
  { name: "Bùi Quốc Việt", idNo: "001693089012", status: "DA_NGHI", base: 10_500_000 },
  { name: "Lương Minh Khoa", idNo: "001798090123", status: "DANG_DONG", base: 10_200_000 },
  { name: "Đặng Văn Hải", idNo: "001805101234", status: "CHO_DANG_KY", base: 9_800_000 },
];

const VEH_TEMPLATES: Array<{ plate: string; driver: string; purpose: string; dayOff: number; status: "SCHEDULED" | "IN_USE" | "RETURNED" }> = [
  { plate: "30A-156.89", driver: "Lê Quốc Bình", purpose: "Chở Ban giám đốc đi khảo sát công trường VHGP-S9", dayOff: 0, status: "IN_USE" },
  { plate: "29C-678.12", driver: "Nguyễn Văn Sỹ", purpose: "Vận chuyển hồ sơ thầu sang Sở Xây dựng Hà Nội", dayOff: -1, status: "RETURNED" },
  { plate: "30A-234.56", driver: "Trần Đức Mạnh", purpose: "Đưa đoàn TVGS Apave đi kiểm tra hiện trường tầng 8", dayOff: -2, status: "RETURNED" },
  { plate: "29F-987.65", driver: "Phạm Văn Hùng", purpose: "Vận chuyển mẫu vật liệu đến trung tâm thí nghiệm", dayOff: 1, status: "SCHEDULED" },
  { plate: "30B-555.44", driver: "Hoàng Tuấn Anh", purpose: "Chở khách hàng tham quan dự án mẫu", dayOff: 2, status: "SCHEDULED" },
];

async function seedOrg(o: { id: string; name: string; type: any }, ownedProjects: Array<{ id: string }>, reporterId: string) {
  // 3a — MarketTerritory (only for orgs that bid)
  const existingTerr = await prisma.marketTerritory.count({ where: { orgId: o.id } });
  if (existingTerr === 0) {
    for (const t of TERRITORIES) {
      await prisma.marketTerritory.create({ data: { orgId: o.id, name: t.name, province: t.province, scope: t.scope, active: true } });
    }
  }
  const territories = await prisma.marketTerritory.findMany({ where: { orgId: o.id }, take: 3 });

  // 3b — ProjectLead
  const existingLeads = await prisma.projectLead.count({ where: { orgId: o.id } });
  if (existingLeads < 4) {
    for (let i = 0; i < LEAD_TEMPLATES.length; i++) {
      const t = LEAD_TEMPLATES[i];
      await prisma.projectLead.create({
        data: {
          orgId: o.id, territoryId: territories[i % territories.length]?.id ?? null,
          name: t.name, clientName: t.clientName, province: t.province,
          estValueVnd: bigVnd(t.estValueVnd), source: t.source, status: t.status,
          nextActionAt: t.status === "POTENTIAL" || t.status === "TRACKING" ? day(rand(3, 21)) : null,
          note: `Lead nhập từ ${t.source}. Tổng giá trị ước tính ${(t.estValueVnd / 1e9).toFixed(1)} tỷ.`,
        },
      });
    }
  }

  // 3c — AdvanceTransaction
  const existingAdv = await prisma.advanceTransaction.count({ where: { orgId: o.id } });
  if (existingAdv < 4) {
    for (let i = 0; i < ADV_TEMPLATES.length; i++) {
      const t = ADV_TEMPLATES[i];
      await prisma.advanceTransaction.create({
        data: {
          orgId: o.id,
          projectId: ownedProjects[i % Math.max(ownedProjects.length, 1)]?.id ?? null,
          type: t.type,
          txnNo: `${t.type}-${o.id.slice(-4).toUpperCase()}-${(i + 1).toString().padStart(3, "0")}`,
          payeeName: t.payee, amountVnd: bigVnd(t.amount), purpose: t.purpose,
          txnDate: day(t.dayOff), status: t.status,
        },
      });
    }
  }

  // 3d — InternalDocument
  const existingDocs = await prisma.internalDocument.count({ where: { orgId: o.id } });
  if (existingDocs < 4) {
    for (let i = 0; i < DOC_TEMPLATES.length; i++) {
      const t = DOC_TEMPLATES[i];
      await prisma.internalDocument.create({
        data: {
          orgId: o.id, docNo: t.docNo, category: t.cat, title: t.title, body: t.body,
          issuedAt: day(-rand(2, 60)), authorId: reporterId,
        },
      });
    }
  }

  // 3e — SocialInsuranceRecord
  const existingBhxh = await prisma.socialInsuranceRecord.count({ where: { orgId: o.id } });
  if (existingBhxh < 4) {
    for (const t of BHXH_TEMPLATES) {
      await prisma.socialInsuranceRecord.create({
        data: {
          orgId: o.id, employeeName: t.name, employeeIdNo: t.idNo,
          bhxhNumber: `BH${t.idNo.slice(-8)}`,
          status: t.status, monthlyBaseVnd: bigVnd(t.base),
          startedAt: day(-rand(60, 720)),
          stoppedAt: t.status === "DA_NGHI" ? day(-rand(7, 90)) : null,
        },
      });
    }
  }

  // 3f — VehicleDispatch
  const existingVeh = await prisma.vehicleDispatch.count({ where: { orgId: o.id } });
  if (existingVeh < 3) {
    for (const t of VEH_TEMPLATES) {
      await prisma.vehicleDispatch.create({
        data: {
          orgId: o.id,
          vehiclePlate: t.plate, driverName: t.driver, purpose: t.purpose,
          startAt: dayAt(t.dayOff, 8), endAt: t.status === "RETURNED" ? dayAt(t.dayOff, 17) : null,
          status: t.status,
        },
      });
    }
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
