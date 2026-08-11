// Demo seed for DinhMucDB — 12 mã định mức phổ biến + đơn giá HCM/HN Q2-2026.
// Source: TT 10/2019/TT-BXD + TT 11/2019/TT-BXD (corpus công khai Bộ XD).
// Run: pnpm --filter @atlas/db exec tsx ../../scripts/seed-dinhmuc.ts
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type SeedNorm = {
  code: string;
  chapter: string;
  section: string;
  group?: string;
  title: string;
  unit: string;
  source: "TT_10_2019" | "TT_11_2019" | "TT_12_2021";
  resources: { type: "VL" | "NC" | "M"; desc: string; unit: string; qty: string }[];
  prices: { province: string; period: string; total: bigint; vl?: bigint; nc?: bigint; m?: bigint }[];
};

const norms: SeedNorm[] = [
  {
    code: "AB.13211",
    chapter: "AB - CÔNG TÁC XÂY DỰNG",
    section: "AB.13 - Bê tông",
    group: "AB.132 - Bê tông cọc khoan nhồi",
    title: "Bê tông cọc khoan nhồi đường kính D800, chiều sâu ≤ 50m, vữa B25",
    unit: "m",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Xi măng PCB40", unit: "kg", qty: "0.328" },
      { type: "VL", desc: "Cát vàng", unit: "m3", qty: "0.000475" },
      { type: "VL", desc: "Đá 1x2", unit: "m3", qty: "0.000816" },
      { type: "NC", desc: "Nhân công bậc 3.5/7", unit: "công", qty: "0.045" },
      { type: "M", desc: "Máy khoan nhồi D800", unit: "ca", qty: "0.0035" },
      { type: "M", desc: "Cẩu 25T", unit: "ca", qty: "0.0028" },
    ],
    prices: [
      { province: "HCM", period: "2026-Q2", total: 2_850_000n, vl: 1_620_000n, nc: 380_000n, m: 850_000n },
      { province: "HN", period: "2026-Q2", total: 2_790_000n, vl: 1_580_000n, nc: 370_000n, m: 840_000n },
    ],
  },
  {
    code: "AB.13311",
    chapter: "AB - CÔNG TÁC XÂY DỰNG",
    section: "AB.13 - Bê tông",
    group: "AB.133 - Bê tông đài cọc / móng",
    title: "Bê tông đài cọc B30, đổ bằng bơm, ≤ 1.5m chiều cao",
    unit: "m3",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Bê tông thương phẩm B30", unit: "m3", qty: "1.025" },
      { type: "NC", desc: "Nhân công bậc 3/7", unit: "công", qty: "1.85" },
      { type: "M", desc: "Máy bơm bê tông tĩnh", unit: "ca", qty: "0.018" },
    ],
    prices: [
      { province: "HCM", period: "2026-Q2", total: 2_150_000n, vl: 1_485_000n, nc: 480_000n, m: 185_000n },
      { province: "HN", period: "2026-Q2", total: 2_080_000n },
    ],
  },
  {
    code: "AF.61221",
    chapter: "AF - CÔNG TÁC LẮP DỰNG",
    section: "AF.61 - Cốt thép",
    title: "Sản xuất, lắp dựng cốt thép D16-D25 trong đài/móng cọc",
    unit: "tấn",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Thép thanh CB400-V D16-D25", unit: "kg", qty: "1020" },
      { type: "VL", desc: "Que hàn", unit: "kg", qty: "1.4" },
      { type: "VL", desc: "Dây thép buộc 1mm", unit: "kg", qty: "5.6" },
      { type: "NC", desc: "Nhân công bậc 3.7/7", unit: "công", qty: "8.4" },
      { type: "M", desc: "Máy hàn 23kW", unit: "ca", qty: "0.32" },
      { type: "M", desc: "Máy cắt uốn thép", unit: "ca", qty: "0.26" },
    ],
    prices: [
      { province: "HCM", period: "2026-Q2", total: 22_500_000n, vl: 19_900_000n, nc: 1_900_000n, m: 700_000n },
      { province: "HN", period: "2026-Q2", total: 22_200_000n },
    ],
  },
  {
    code: "AF.61222",
    chapter: "AF - CÔNG TÁC LẮP DỰNG",
    section: "AF.61 - Cốt thép",
    title: "Sản xuất, lắp dựng cốt thép D10-D14 trong sàn / dầm",
    unit: "tấn",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Thép thanh CB400-V D10-D14", unit: "kg", qty: "1020" },
      { type: "NC", desc: "Nhân công bậc 3.5/7", unit: "công", qty: "9.2" },
      { type: "M", desc: "Máy cắt uốn thép", unit: "ca", qty: "0.31" },
    ],
    prices: [{ province: "HCM", period: "2026-Q2", total: 22_500_000n }, { province: "HN", period: "2026-Q2", total: 22_180_000n }],
  },
  {
    code: "AF.81121",
    chapter: "AF - CÔNG TÁC LẮP DỰNG",
    section: "AF.81 - Bê tông tại chỗ",
    title: "Bê tông sàn B30 đổ bằng bơm cần, dày ≤ 250mm",
    unit: "m3",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Bê tông thương phẩm B30 SCC", unit: "m3", qty: "1.020" },
      { type: "NC", desc: "Nhân công bậc 3/7", unit: "công", qty: "1.42" },
      { type: "M", desc: "Bơm bê tông cần 36m", unit: "ca", qty: "0.022" },
    ],
    prices: [{ province: "HCM", period: "2026-Q2", total: 2_080_000n }, { province: "HN", period: "2026-Q2", total: 2_020_000n }],
  },
  {
    code: "AK.21111",
    chapter: "AK - CÔNG TÁC HOÀN THIỆN",
    section: "AK.21 - Trát",
    title: "Trát tường trong nhà, vữa XM mác 75, dày 15mm",
    unit: "m2",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Vữa XM mác 75", unit: "m3", qty: "0.016" },
      { type: "NC", desc: "Nhân công bậc 3.5/7", unit: "công", qty: "0.22" },
    ],
    prices: [{ province: "HCM", period: "2026-Q2", total: 92_000n }, { province: "HN", period: "2026-Q2", total: 88_500n }],
  },
  {
    code: "AK.51111",
    chapter: "AK - CÔNG TÁC HOÀN THIỆN",
    section: "AK.51 - Lát gạch",
    title: "Lát gạch ceramic 600x600 nền nhà, vữa XM mác 75",
    unit: "m2",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Gạch ceramic 600x600", unit: "viên", qty: "2.83" },
      { type: "VL", desc: "Vữa XM mác 75", unit: "m3", qty: "0.015" },
      { type: "NC", desc: "Nhân công bậc 4/7", unit: "công", qty: "0.20" },
    ],
    prices: [{ province: "HCM", period: "2026-Q2", total: 285_000n }, { province: "HN", period: "2026-Q2", total: 278_000n }],
  },
  {
    code: "BA.13111",
    chapter: "BA - CÔNG TÁC LẮP MEP",
    section: "BA.13 - Cấp thoát nước",
    title: "Lắp ống PPR D32 PN20 cấp nước nóng-lạnh trong nhà",
    unit: "m",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Ống PPR D32 PN20", unit: "m", qty: "1.02" },
      { type: "VL", desc: "Phụ kiện co/tê/khớp nối", unit: "cái", qty: "0.85" },
      { type: "NC", desc: "Nhân công bậc 4/7", unit: "công", qty: "0.12" },
    ],
    prices: [{ province: "HCM", period: "2026-Q2", total: 95_000n }],
  },
  {
    code: "BB.18221",
    chapter: "BA - CÔNG TÁC LẮP MEP",
    section: "BB.18 - Thoát nước",
    title: "Lắp ống PVC D110 thoát nước trong nhà",
    unit: "m",
    source: "TT_10_2019",
    resources: [
      { type: "VL", desc: "Ống PVC D110 class B", unit: "m", qty: "1.02" },
      { type: "NC", desc: "Nhân công bậc 4/7", unit: "công", qty: "0.18" },
    ],
    prices: [{ province: "HCM", period: "2026-Q2", total: 142_000n }],
  },
  {
    code: "M.0301",
    chapter: "M - GIÁ CA MÁY",
    section: "M.03 - Máy ép cọc / khoan",
    title: "Máy khoan cọc nhồi D800-D1200 công suất 150kW",
    unit: "ca",
    source: "TT_11_2019",
    resources: [
      { type: "M", desc: "Khấu hao + sửa chữa + nhiên liệu + thợ vận hành (ca 8h)", unit: "ca", qty: "1" },
    ],
    prices: [{ province: "HCM", period: "2026-Q2", total: 8_500_000n }],
  },
  {
    code: "M.0710",
    chapter: "M - GIÁ CA MÁY",
    section: "M.07 - Cẩu",
    title: "Cẩu bánh xích 50 tấn, tầm với 18m",
    unit: "ca",
    source: "TT_11_2019",
    resources: [{ type: "M", desc: "Khấu hao + nhiên liệu + thợ vận hành", unit: "ca", qty: "1" }],
    prices: [{ province: "HCM", period: "2026-Q2", total: 6_200_000n }],
  },
  {
    code: "M.1102",
    chapter: "M - GIÁ CA MÁY",
    section: "M.11 - Máy bơm bê tông",
    title: "Bơm bê tông cần 36m, công suất 100m3/h",
    unit: "ca",
    source: "TT_11_2019",
    resources: [{ type: "M", desc: "Khấu hao + nhiên liệu + thợ vận hành", unit: "ca", qty: "1" }],
    prices: [{ province: "HCM", period: "2026-Q2", total: 4_500_000n }],
  },
];

async function main() {
  for (const n of norms) {
    const norm = await prisma.normCode.upsert({
      where: { code: n.code },
      create: { code: n.code, chapter: n.chapter, section: n.section, group: n.group, title: n.title, unit: n.unit, source: n.source },
      update: { title: n.title, unit: n.unit },
    });
    await prisma.normResource.deleteMany({ where: { normId: norm.id } });
    await prisma.normResource.createMany({
      data: n.resources.map((r) => ({
        normId: norm.id,
        resourceType: r.type,
        description: r.desc,
        unit: r.unit,
        quantity: new Prisma.Decimal(r.qty),
      })),
    });
    for (const p of n.prices) {
      await prisma.normPrice.upsert({
        where: { normId_province_period: { normId: norm.id, province: p.province, period: p.period } },
        create: { normId: norm.id, province: p.province, period: p.period, unitPriceVnd: p.total, vlCostVnd: p.vl, ncCostVnd: p.nc, mCostVnd: p.m, source: `Sở XD ${p.province} ${p.period}` },
        update: { unitPriceVnd: p.total },
      });
    }
    console.log(`  ✓ ${n.code} — ${n.resources.length} hao phí · ${n.prices.length} đơn giá`);
  }
  console.log(`✅ DinhMucDB seeded: ${norms.length} mã định mức`);
}

main().finally(() => prisma.$disconnect());
