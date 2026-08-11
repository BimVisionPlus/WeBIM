/**
 * scripts/seed-vendor.ts — populate Atlas Vendor with realistic VN data.
 *
 * - 12 suppliers (Holcim, Hòa Phát, Cadivi, etc.) — upsert
 * - 8 subcontractors (already exist as Organizations type=NHA_THAU_PHU)
 *   create ContractorProfile if missing
 * - 15 VendorContract (mix FRAMEWORK / ANNUAL / SPOT_PO)
 * - 60 VendorCreditEntry (mix PURCHASE/PAYMENT/RETURN across 3 months)
 *
 * Run: DATABASE_URL='...' tsx scripts/seed-vendor.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const today = new Date();
const day = (offset: number) => { const d = new Date(today); d.setDate(d.getDate() + offset); d.setHours(0, 0, 0, 0); return d; };
const rand = (lo: number, hi: number) => Math.floor(Math.random() * (hi - lo + 1)) + lo;
const pick = <T>(arr: T[], i: number) => arr[i % arr.length];
const bigVnd = (n: number): bigint => BigInt(Math.round(n));

const SUPPLIERS: Array<{ name: string; mst: string; phone: string; email: string; address: string; rating: number; }> = [
  { name: "CTCP Tập đoàn Hòa Phát", mst: "0900189284", phone: "0243-7853336", email: "info@hoaphat.com.vn", address: "Hà Nội", rating: 4.7 },
  { name: "CTCP Xi măng Holcim Việt Nam", mst: "0300392750", phone: "0283-7561111", email: "info@holcim.com", address: "TP. HCM", rating: 4.5 },
  { name: "CTCP Dây cáp điện Cadivi", mst: "0300401968", phone: "0283-9311666", email: "cadivi@cadivi.vn", address: "TP. HCM", rating: 4.6 },
  { name: "CTCP Ống nhựa Tiền Phong", mst: "0200165680", phone: "0225-3852111", email: "tpp@tienphongplastic.com", address: "Hải Phòng", rating: 4.4 },
  { name: "AkzoNobel Việt Nam (Dulux)", mst: "0300672199", phone: "0283-7733330", email: "akzo@akzonobel.com", address: "TP. HCM", rating: 4.5 },
  { name: "ABB Việt Nam", mst: "0100783721", phone: "0243-9728666", email: "abb@vn.abb.com", address: "Hà Nội", rating: 4.6 },
  { name: "CTCP Cơ điện Daikin Việt Nam", mst: "0300834712", phone: "0283-5121111", email: "daikin@daikinvn.com", address: "TP. HCM", rating: 4.7 },
  { name: "CTCP Gỗ An Cường", mst: "0301438783", phone: "0274-3654444", email: "info@ancuonggroup.com", address: "Bình Dương", rating: 4.3 },
  { name: "CTCP Kính Viglacera", mst: "0100107291", phone: "0243-3853336", email: "viglacera@viglacera.vn", address: "Hà Nội", rating: 4.2 },
  { name: "CTCP Cửa nhôm Xingfa Việt Nam", mst: "0102378921", phone: "0243-7654321", email: "xingfa@xingfa.vn", address: "Hà Nội", rating: 4.1 },
  { name: "CTCP VLXD Đồng Tâm Group", mst: "1100789432", phone: "0272-3825555", email: "dongtam@dongtam.com.vn", address: "Long An", rating: 4.0 },
  { name: "CTCP Bê tông LICOGI 16.6", mst: "0102789456", phone: "0243-7565555", email: "info@licogi16.com.vn", address: "Hà Nội", rating: 4.2 },
];

const SUB_PROFILES: Array<{ slug: string; class: "HANG_I" | "HANG_II" | "HANG_III"; scope: string[]; years: number; rating: number; pastProjects: number; }> = [
  { slug: "apave", class: "HANG_I", scope: ["Tư vấn giám sát", "Kiểm định"], years: 28, rating: 4.7, pastProjects: 145 },
  { slug: "aa-design", class: "HANG_I", scope: ["Tư vấn thiết kế kiến trúc", "Tư vấn thiết kế kết cấu"], years: 22, rating: 4.6, pastProjects: 98 },
];

async function main() {
  console.log("==> Vendor seed starting");
  const cofico = await prisma.organization.findUnique({ where: { slug: "cofico" } });
  if (!cofico) throw new Error("Cofico org not found");

  // 1) Suppliers
  console.log("==> Suppliers");
  const supplierIds: Array<{ id: string; name: string }> = [];
  for (const s of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    const rec = existing
      ? await prisma.supplier.update({ where: { id: existing.id }, data: { mst: s.mst, phone: s.phone, email: s.email, address: s.address, rating: s.rating, active: true } })
      : await prisma.supplier.create({ data: { ...s, active: true } });
    supplierIds.push({ id: rec.id, name: rec.name });
  }
  console.log(`   ${supplierIds.length} suppliers`);

  // 2) ContractorProfile for already-existing NHA_THAU_PHU/TV orgs
  console.log("==> Contractor profiles");
  const subOrgs = await prisma.organization.findMany({
    where: { type: { in: ["NHA_THAU_PHU", "TU_VAN_GIAM_SAT", "TU_VAN_THIET_KE"] } },
  });
  for (const org of subOrgs) {
    const meta = SUB_PROFILES.find((p) => p.slug === org.slug);
    const exists = await prisma.contractorProfile.findUnique({ where: { orgId: org.id } });
    if (exists) continue;
    await prisma.contractorProfile.create({
      data: {
        orgId: org.id, legalName: org.name, mst: org.mst,
        capabilityClass: meta?.class ?? "HANG_II",
        capabilityScope: meta?.scope ?? ["Thi công dân dụng"],
        capabilityNo: `CN-${rand(10000, 99999)}/HĐXD`,
        capabilityExpiry: day(rand(365, 730)),
        charteredEng: rand(10, 50),
        totalStaff: rand(50, 500),
        charterCapVnd: bigVnd(rand(5, 80) * 1_000_000_000),
        yearsExperience: meta?.years ?? rand(5, 25),
        pastProjects: meta?.pastProjects ?? rand(15, 80),
        pastValueVnd: bigVnd(rand(50, 800) * 1_000_000_000),
        rating: meta?.rating ?? Number((3.5 + Math.random() * 1.4).toFixed(2)),
        blacklisted: false,
      },
    });
  }

  // 3) VendorContract — 15 contracts mixing suppliers + subcontractors
  console.log("==> Vendor contracts");
  const subOrgIds = subOrgs.map((o) => ({ id: o.id, name: o.name }));
  const contractDefs: Array<{ vendorType: "supplier" | "subcontractor"; idx: number; type: "FRAMEWORK" | "SPOT_PO" | "ANNUAL" | "RAMP_UP"; scope: string; valueVnd: number; state: "DRAFT" | "NEGOTIATING" | "ACTIVE" | "EXPIRED"; offsetStart: number; durationDays: number }> = [
    { vendorType: "supplier", idx: 0, type: "FRAMEWORK", scope: "Thép cuộn CB400-V D6-D32 toàn dự án 2026", valueVnd: 18_500_000_000, state: "ACTIVE", offsetStart: -180, durationDays: 365 },
    { vendorType: "supplier", idx: 1, type: "FRAMEWORK", scope: "Bê tông thương phẩm M300/M400 các trạm trộn miền Bắc", valueVnd: 24_800_000_000, state: "ACTIVE", offsetStart: -150, durationDays: 365 },
    { vendorType: "supplier", idx: 2, type: "ANNUAL", scope: "Dây cáp điện CV/CXV/CVV 2026", valueVnd: 3_200_000_000, state: "ACTIVE", offsetStart: -120, durationDays: 365 },
    { vendorType: "supplier", idx: 3, type: "ANNUAL", scope: "Ống cấp thoát nước PPR + PVC 2026", valueVnd: 1_850_000_000, state: "ACTIVE", offsetStart: -90, durationDays: 365 },
    { vendorType: "supplier", idx: 4, type: "FRAMEWORK", scope: "Sơn nội ngoại thất Dulux Weathercoat + Easyclean", valueVnd: 2_400_000_000, state: "ACTIVE", offsetStart: -60, durationDays: 365 },
    { vendorType: "supplier", idx: 5, type: "FRAMEWORK", scope: "Tủ điện MCCB + ACB 250-4000A", valueVnd: 4_500_000_000, state: "NEGOTIATING", offsetStart: -10, durationDays: 365 },
    { vendorType: "supplier", idx: 6, type: "FRAMEWORK", scope: "Cục lạnh điều hòa Daikin multi-split 9000-30000BTU", valueVnd: 5_200_000_000, state: "ACTIVE", offsetStart: -45, durationDays: 365 },
    { vendorType: "supplier", idx: 7, type: "SPOT_PO", scope: "Tủ bếp + tủ áo MFC An Cường — dự án VHGP-S9", valueVnd: 1_200_000_000, state: "ACTIVE", offsetStart: -20, durationDays: 60 },
    { vendorType: "supplier", idx: 8, type: "ANNUAL", scope: "Kính cường lực 8mm + 10mm các dự án 2026", valueVnd: 2_800_000_000, state: "ACTIVE", offsetStart: -90, durationDays: 365 },
    { vendorType: "supplier", idx: 9, type: "FRAMEWORK", scope: "Cửa nhôm Xingfa hệ 55-65 toàn dự án", valueVnd: 6_500_000_000, state: "ACTIVE", offsetStart: -75, durationDays: 365 },
    { vendorType: "supplier", idx: 11, type: "FRAMEWORK", scope: "Bê tông thương phẩm M300 các dự án Hà Nội", valueVnd: 8_900_000_000, state: "ACTIVE", offsetStart: -60, durationDays: 365 },
    { vendorType: "subcontractor", idx: 0, type: "ANNUAL", scope: "Tư vấn giám sát thi công toàn năm 2026 — Apave", valueVnd: 4_800_000_000, state: "ACTIVE", offsetStart: -120, durationDays: 365 },
    { vendorType: "subcontractor", idx: 1, type: "FRAMEWORK", scope: "Tư vấn thiết kế bản vẽ thi công các dự án 2026", valueVnd: 6_200_000_000, state: "ACTIVE", offsetStart: -100, durationDays: 365 },
    { vendorType: "supplier", idx: 10, type: "RAMP_UP", scope: "VLXD trang trí — thử việc 3 tháng", valueVnd: 850_000_000, state: "ACTIVE", offsetStart: -30, durationDays: 90 },
    { vendorType: "supplier", idx: 0, type: "SPOT_PO", scope: "Thép thanh CB500-V cho dự án HLX — bổ sung Q3", valueVnd: 2_100_000_000, state: "DRAFT", offsetStart: 0, durationDays: 30 },
  ];

  const apaveOrg = subOrgs.find((o) => o.slug === "apave");
  const aaOrg = subOrgs.find((o) => o.slug === "aa-design");
  const subFallback = [apaveOrg, aaOrg].filter(Boolean) as Array<{ id: string; name: string }>;

  let cNum = 1;
  for (const def of contractDefs) {
    const contractNo = `HD-${def.vendorType === "supplier" ? "VT" : "TP"}-2026/${cNum.toString().padStart(3, "0")}`;
    cNum++;
    const startDate = day(def.offsetStart);
    const endDate = day(def.offsetStart + def.durationDays);

    let vendorName: string, vendorOrgId: string | null = null, supplierId: string | null = null;
    if (def.vendorType === "supplier") {
      const s = supplierIds[def.idx % supplierIds.length];
      if (!s) continue;
      supplierId = s.id; vendorName = s.name;
    } else {
      const o = subFallback[def.idx % subFallback.length];
      if (!o) continue;
      vendorOrgId = o.id; vendorName = o.name;
    }

    const exists = await prisma.vendorContract.findFirst({ where: { orgId: cofico.id, contractNo } });
    if (exists) continue;

    await prisma.vendorContract.create({
      data: {
        orgId: cofico.id, vendorOrgId, supplierId, vendorName, contractNo,
        type: def.type, startDate, endDate, valueVnd: bigVnd(def.valueVnd),
        scope: def.scope, state: def.state,
        signedAt: def.state === "ACTIVE" || def.state === "EXPIRED" ? day(def.offsetStart - 5) : null,
      },
    });
  }

  // 4) VendorCreditEntry — generate purchases + payments over the last 90 days
  console.log("==> Credit entries");
  const activeContracts = await prisma.vendorContract.findMany({
    where: { orgId: cofico.id, state: "ACTIVE" },
    take: 12,
  });

  let txn = 1;
  for (const c of activeContracts) {
    if (!c.valueVnd) continue;
    // 3-5 purchase entries
    const purchases = rand(3, 5);
    const slice = Number(c.valueVnd) / (purchases * 3); // ~1/3 of contract realized
    for (let i = 0; i < purchases; i++) {
      const offset = -rand(7, 80);
      await prisma.vendorCreditEntry.create({
        data: {
          orgId: c.orgId, contractId: c.id, vendorOrgId: c.vendorOrgId, supplierId: c.supplierId, vendorName: c.vendorName,
          txnDate: day(offset), txnNo: `PN-2026/${txn.toString().padStart(4, "0")}`,
          type: "PURCHASE", amountVnd: bigVnd(slice * (0.8 + Math.random() * 0.4)),
          notes: `Nhập hàng đợt ${i + 1} theo ${c.contractNo}`,
        },
      });
      txn++;
      // 70% likely paid
      if (Math.random() < 0.7) {
        await prisma.vendorCreditEntry.create({
          data: {
            orgId: c.orgId, contractId: c.id, vendorOrgId: c.vendorOrgId, supplierId: c.supplierId, vendorName: c.vendorName,
            txnDate: day(offset + rand(7, 30)), txnNo: `PC-2026/${txn.toString().padStart(4, "0")}`,
            type: "PAYMENT", amountVnd: bigVnd(slice * (0.7 + Math.random() * 0.3)),
            notes: `Thanh toán đợt ${i + 1} qua chuyển khoản BIDV`,
          },
        });
        txn++;
      }
    }
  }

  console.log("==> Done");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
