/**
 * scripts/seed-cost-norms.ts — seed TT 10/2019 định mức catalog.
 *
 * 30 common work codes across chapters AB/AC/AD/AE/AF/AG with:
 *  - VL/NC/M resource breakdowns
 *  - 4 provinces × 1 period (current quarter) price tables
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const bigVnd = (n: number): bigint => BigInt(Math.round(n));

// Each norm carries a base price (HCM Q2/2026); seed will generate
// price entries for HN/DN/BD with regional adjustment factors.
type NormDef = {
  code: string;
  chapter: string;
  section: string;
  group?: string;
  title: string;
  unit: string;
  baseUnitVnd: number; // total
  baseVl: number; // material portion
  baseNc: number; // labor portion
  baseMay: number; // machine portion
  resources: Array<{ type: "VL" | "NC" | "M"; description: string; unit: string; quantity: number }>;
};

const NORMS: NormDef[] = [
  // AB - Công tác xây dựng
  {
    code: "AB.11211", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.1 - Công tác đào, đắp", group: "AB.11 - Đào đất bằng máy",
    title: "Đào đất hố móng bằng máy đào ≤0.8 m³, đất cấp II", unit: "100 m³",
    baseUnitVnd: 16_500_000, baseVl: 0, baseNc: 3_200_000, baseMay: 13_300_000,
    resources: [
      { type: "NC", description: "Nhân công 3/7", unit: "công", quantity: 11.2 },
      { type: "M", description: "Máy đào 0.8 m³", unit: "ca", quantity: 0.55 },
      { type: "M", description: "Máy ủi 110 CV", unit: "ca", quantity: 0.15 },
    ],
  },
  {
    code: "AB.13211", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.1 - Công tác đào, đắp", group: "AB.13 - Đắp đất",
    title: "Đắp đất công trình bằng đầm cóc, độ chặt K=0.90", unit: "100 m³",
    baseUnitVnd: 5_800_000, baseVl: 0, baseNc: 3_800_000, baseMay: 2_000_000,
    resources: [
      { type: "NC", description: "Nhân công 3/7", unit: "công", quantity: 13.5 },
      { type: "M", description: "Đầm cóc 70kg", unit: "ca", quantity: 1.2 },
    ],
  },
  {
    code: "AB.21221", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.2 - Cọc bê tông", group: "AB.21 - Cọc BTCT đúc sẵn",
    title: "Ép cọc BTCT D400 chiều dài cọc ≤24m, đất cấp II", unit: "100 m",
    baseUnitVnd: 51_000_000, baseVl: 32_000_000, baseNc: 5_500_000, baseMay: 13_500_000,
    resources: [
      { type: "VL", description: "Cọc BTCT D400", unit: "m", quantity: 100 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 18 },
      { type: "M", description: "Máy ép cọc 150T", unit: "ca", quantity: 1.05 },
      { type: "M", description: "Cẩu tự hành 25T", unit: "ca", quantity: 0.6 },
    ],
  },
  {
    code: "AB.31111", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.3 - Bê tông", group: "AB.31 - Bê tông tươi M250",
    title: "Bê tông móng M250 đá 1x2, độ sụt 6-8cm", unit: "m³",
    baseUnitVnd: 1_650_000, baseVl: 1_350_000, baseNc: 180_000, baseMay: 120_000,
    resources: [
      { type: "VL", description: "Xi măng PCB30", unit: "kg", quantity: 290 },
      { type: "VL", description: "Cát vàng", unit: "m³", quantity: 0.52 },
      { type: "VL", description: "Đá 1x2", unit: "m³", quantity: 0.91 },
      { type: "VL", description: "Nước", unit: "lít", quantity: 195 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.65 },
      { type: "M", description: "Máy trộn 250L", unit: "ca", quantity: 0.045 },
    ],
  },
  {
    code: "AB.31211", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.3 - Bê tông", group: "AB.31 - Bê tông tươi M300",
    title: "Bê tông cột M300 đá 1x2, sản xuất tại trạm trộn", unit: "m³",
    baseUnitVnd: 1_780_000, baseVl: 1_470_000, baseNc: 180_000, baseMay: 130_000,
    resources: [
      { type: "VL", description: "Bê tông thương phẩm M300", unit: "m³", quantity: 1.015 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.65 },
      { type: "M", description: "Máy bơm bê tông 60 m³/h", unit: "ca", quantity: 0.038 },
    ],
  },
  {
    code: "AB.31311", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.3 - Bê tông", group: "AB.31 - Bê tông tươi M400",
    title: "Bê tông cột tầng hầm M400 đá 1x2", unit: "m³",
    baseUnitVnd: 1_920_000, baseVl: 1_590_000, baseNc: 200_000, baseMay: 130_000,
    resources: [
      { type: "VL", description: "Bê tông thương phẩm M400", unit: "m³", quantity: 1.015 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.7 },
      { type: "M", description: "Máy bơm bê tông 60 m³/h", unit: "ca", quantity: 0.038 },
    ],
  },
  {
    code: "AB.41111", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.4 - Cốt thép", group: "AB.41 - Cốt thép cột",
    title: "Cốt thép cột, đường kính ≤18mm, CB400-V", unit: "tấn",
    baseUnitVnd: 22_500_000, baseVl: 20_800_000, baseNc: 1_400_000, baseMay: 300_000,
    resources: [
      { type: "VL", description: "Thép cuộn CB400-V D6-D18", unit: "kg", quantity: 1005 },
      { type: "VL", description: "Dây thép buộc D1mm", unit: "kg", quantity: 15 },
      { type: "NC", description: "Nhân công 4/7 (gia công + lắp đặt)", unit: "công", quantity: 5.2 },
      { type: "M", description: "Máy cắt + uốn thép 5kW", unit: "ca", quantity: 0.15 },
    ],
  },
  {
    code: "AB.41121", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.4 - Cốt thép", group: "AB.41 - Cốt thép cột",
    title: "Cốt thép cột, đường kính >18mm, CB400-V", unit: "tấn",
    baseUnitVnd: 21_800_000, baseVl: 20_500_000, baseNc: 1_100_000, baseMay: 200_000,
    resources: [
      { type: "VL", description: "Thép thanh CB400-V D20-D32", unit: "kg", quantity: 1005 },
      { type: "VL", description: "Dây thép buộc", unit: "kg", quantity: 12 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 4.1 },
      { type: "M", description: "Máy hàn 23kW", unit: "ca", quantity: 0.1 },
    ],
  },
  {
    code: "AB.51211", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.5 - Cốp pha", group: "AB.51 - Cốp pha cột",
    title: "Cốp pha cột bằng thép (sử dụng 5 lần)", unit: "100 m²",
    baseUnitVnd: 28_000_000, baseVl: 17_500_000, baseNc: 8_500_000, baseMay: 2_000_000,
    resources: [
      { type: "VL", description: "Tấm cốp pha thép", unit: "m²", quantity: 22 },
      { type: "VL", description: "Đà giáo + ti giằng", unit: "kg", quantity: 850 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 28 },
      { type: "M", description: "Cẩu 25T", unit: "ca", quantity: 0.4 },
    ],
  },
  {
    code: "AB.51311", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.5 - Cốp pha", group: "AB.51 - Cốp pha dầm sàn",
    title: "Cốp pha dầm sàn bằng thép tổ hợp", unit: "100 m²",
    baseUnitVnd: 26_000_000, baseVl: 15_200_000, baseNc: 9_300_000, baseMay: 1_500_000,
    resources: [
      { type: "VL", description: "Cốp pha thép tổ hợp", unit: "m²", quantity: 22 },
      { type: "VL", description: "Đà giáo + chống", unit: "kg", quantity: 780 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 31 },
    ],
  },
  // AC - Xây tường
  {
    code: "AC.21211", chapter: "AC - CÔNG TÁC HOÀN THIỆN", section: "AC.2 - Xây gạch", group: "AC.21 - Xây tường",
    title: "Xây tường gạch xi măng 200, vữa XM mác 75", unit: "m³",
    baseUnitVnd: 1_950_000, baseVl: 1_400_000, baseNc: 500_000, baseMay: 50_000,
    resources: [
      { type: "VL", description: "Gạch xi măng 80x80x180", unit: "viên", quantity: 580 },
      { type: "VL", description: "Vữa XM mác 75", unit: "m³", quantity: 0.22 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 1.8 },
      { type: "M", description: "Máy trộn vữa 80L", unit: "ca", quantity: 0.022 },
    ],
  },
  {
    code: "AC.21221", chapter: "AC - CÔNG TÁC HOÀN THIỆN", section: "AC.2 - Xây gạch", group: "AC.21 - Xây tường",
    title: "Xây tường gạch xi măng 100, vữa XM mác 75", unit: "m³",
    baseUnitVnd: 1_950_000, baseVl: 1_400_000, baseNc: 500_000, baseMay: 50_000,
    resources: [
      { type: "VL", description: "Gạch xi măng", unit: "viên", quantity: 580 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 1.8 },
    ],
  },
  {
    code: "AC.31111", chapter: "AC - CÔNG TÁC HOÀN THIỆN", section: "AC.3 - Trát", group: "AC.31 - Trát tường",
    title: "Trát tường trong vữa XM mác 75, dày ≤1.5cm", unit: "m²",
    baseUnitVnd: 95_000, baseVl: 35_000, baseNc: 55_000, baseMay: 5_000,
    resources: [
      { type: "VL", description: "Vữa XM mác 75", unit: "m³", quantity: 0.0165 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.18 },
    ],
  },
  {
    code: "AC.31211", chapter: "AC - CÔNG TÁC HOÀN THIỆN", section: "AC.3 - Trát", group: "AC.31 - Trát tường",
    title: "Trát tường ngoài vữa XM mác 75 + lưới sợi thủy tinh", unit: "m²",
    baseUnitVnd: 125_000, baseVl: 50_000, baseNc: 70_000, baseMay: 5_000,
    resources: [
      { type: "VL", description: "Vữa XM mác 75", unit: "m³", quantity: 0.0165 },
      { type: "VL", description: "Lưới sợi thủy tinh chống nứt", unit: "m²", quantity: 1.05 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.22 },
    ],
  },
  {
    code: "AC.41111", chapter: "AC - CÔNG TÁC HOÀN THIỆN", section: "AC.4 - Sơn", group: "AC.41 - Sơn nội thất",
    title: "Sơn nước nội thất 3 lớp (1 lớp lót + 2 lớp phủ) - Dulux", unit: "m²",
    baseUnitVnd: 58_000, baseVl: 32_000, baseNc: 24_000, baseMay: 2_000,
    resources: [
      { type: "VL", description: "Sơn lót Dulux", unit: "lít", quantity: 0.11 },
      { type: "VL", description: "Sơn phủ Dulux Easyclean", unit: "lít", quantity: 0.22 },
      { type: "NC", description: "Nhân công 3.5/7", unit: "công", quantity: 0.085 },
    ],
  },
  {
    code: "AC.42111", chapter: "AC - CÔNG TÁC HOÀN THIỆN", section: "AC.4 - Sơn", group: "AC.42 - Sơn ngoại thất",
    title: "Sơn ngoại thất 3 lớp - Dulux Weathercoat", unit: "m²",
    baseUnitVnd: 92_000, baseVl: 60_000, baseNc: 30_000, baseMay: 2_000,
    resources: [
      { type: "VL", description: "Sơn lót chống kiềm Dulux", unit: "lít", quantity: 0.13 },
      { type: "VL", description: "Sơn phủ Weathercoat Smooth", unit: "lít", quantity: 0.24 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.105 },
    ],
  },
  {
    code: "AC.51111", chapter: "AC - CÔNG TÁC HOÀN THIỆN", section: "AC.5 - Lát ốp", group: "AC.51 - Lát sàn",
    title: "Lát gạch Granite 600x600, vữa XM mác 75", unit: "m²",
    baseUnitVnd: 360_000, baseVl: 230_000, baseNc: 120_000, baseMay: 10_000,
    resources: [
      { type: "VL", description: "Gạch Granite 600x600", unit: "viên", quantity: 2.85 },
      { type: "VL", description: "Vữa XM mác 75 lót", unit: "m³", quantity: 0.025 },
      { type: "VL", description: "Keo dán gạch", unit: "kg", quantity: 1.8 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.42 },
    ],
  },
  {
    code: "AC.51211", chapter: "AC - CÔNG TÁC HOÀN THIỆN", section: "AC.5 - Lát ốp", group: "AC.51 - Ốp tường",
    title: "Ốp tường gạch men 30x60, vữa keo", unit: "m²",
    baseUnitVnd: 280_000, baseVl: 160_000, baseNc: 110_000, baseMay: 10_000,
    resources: [
      { type: "VL", description: "Gạch men 30x60", unit: "viên", quantity: 5.7 },
      { type: "VL", description: "Keo dán gạch", unit: "kg", quantity: 4.5 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.38 },
    ],
  },
  // AE - MEP
  {
    code: "AE.21111", chapter: "AE - CÔNG TÁC ĐIỆN - NƯỚC", section: "AE.2 - Cấp thoát nước", group: "AE.21 - Ống cấp nước",
    title: "Lắp đặt ống PPR DN25 PN20 + phụ kiện", unit: "100 m",
    baseUnitVnd: 9_500_000, baseVl: 7_200_000, baseNc: 2_100_000, baseMay: 200_000,
    resources: [
      { type: "VL", description: "Ống PPR DN25 PN20", unit: "m", quantity: 102 },
      { type: "VL", description: "Phụ kiện co + tê", unit: "cái", quantity: 30 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 7.2 },
    ],
  },
  {
    code: "AE.22111", chapter: "AE - CÔNG TÁC ĐIỆN - NƯỚC", section: "AE.2 - Cấp thoát nước", group: "AE.22 - Ống thoát nước",
    title: "Lắp đặt ống PVC D110 thoát nước + phụ kiện", unit: "100 m",
    baseUnitVnd: 14_500_000, baseVl: 11_500_000, baseNc: 2_800_000, baseMay: 200_000,
    resources: [
      { type: "VL", description: "Ống PVC D110 PN6", unit: "m", quantity: 102 },
      { type: "VL", description: "Co cút + măng sông", unit: "cái", quantity: 25 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 9.5 },
    ],
  },
  {
    code: "AE.31111", chapter: "AE - CÔNG TÁC ĐIỆN - NƯỚC", section: "AE.3 - Điện", group: "AE.31 - Dây điện",
    title: "Đi dây điện CV 2x2.5mm² Cadivi trong ống ruột gà", unit: "100 m",
    baseUnitVnd: 2_500_000, baseVl: 1_800_000, baseNc: 650_000, baseMay: 50_000,
    resources: [
      { type: "VL", description: "Dây CV 2x2.5mm² Cadivi", unit: "m", quantity: 102 },
      { type: "VL", description: "Ống ruột gà PE D16", unit: "m", quantity: 102 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 2.2 },
    ],
  },
  {
    code: "AE.31211", chapter: "AE - CÔNG TÁC ĐIỆN - NƯỚC", section: "AE.3 - Điện", group: "AE.31 - Dây điện",
    title: "Đi dây điện CV 2x4.0mm² Cadivi (mạch nhánh)", unit: "100 m",
    baseUnitVnd: 3_800_000, baseVl: 2_900_000, baseNc: 800_000, baseMay: 100_000,
    resources: [
      { type: "VL", description: "Dây CV 2x4.0mm² Cadivi", unit: "m", quantity: 102 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 2.7 },
    ],
  },
  {
    code: "AE.41111", chapter: "AE - CÔNG TÁC ĐIỆN - NƯỚC", section: "AE.4 - Tủ điện", group: "AE.41 - Tủ MCCB",
    title: "Lắp đặt tủ điện tổng MCCB 250A - ABB", unit: "cái",
    baseUnitVnd: 18_500_000, baseVl: 15_000_000, baseNc: 3_000_000, baseMay: 500_000,
    resources: [
      { type: "VL", description: "Tủ điện ABB MCCB 250A", unit: "cái", quantity: 1 },
      { type: "NC", description: "Nhân công 5/7", unit: "công", quantity: 8.5 },
    ],
  },
  {
    code: "AE.51111", chapter: "AE - CÔNG TÁC ĐIỆN - NƯỚC", section: "AE.5 - Điều hòa", group: "AE.51 - Multi-split",
    title: "Lắp đặt cục lạnh điều hòa Daikin 18000BTU multi-split", unit: "bộ",
    baseUnitVnd: 22_500_000, baseVl: 19_500_000, baseNc: 2_500_000, baseMay: 500_000,
    resources: [
      { type: "VL", description: "Cục lạnh Daikin 18000BTU", unit: "bộ", quantity: 1 },
      { type: "VL", description: "Ống đồng + bảo ôn", unit: "m", quantity: 6 },
      { type: "NC", description: "Nhân công 5/7", unit: "công", quantity: 7.2 },
    ],
  },
  // AF - Cửa
  {
    code: "AF.11111", chapter: "AF - CỬA + VÁCH NGĂN", section: "AF.1 - Cửa nhôm", group: "AF.11 - Cửa nhôm Xingfa",
    title: "Cửa nhôm Xingfa hệ 55 + kính cường lực 10mm", unit: "m²",
    baseUnitVnd: 2_850_000, baseVl: 2_300_000, baseNc: 500_000, baseMay: 50_000,
    resources: [
      { type: "VL", description: "Khung nhôm Xingfa hệ 55", unit: "m", quantity: 3.6 },
      { type: "VL", description: "Kính cường lực 10mm", unit: "m²", quantity: 1.02 },
      { type: "VL", description: "Phụ kiện khóa + bản lề", unit: "bộ", quantity: 0.5 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 1.5 },
    ],
  },
  // AD - Chống thấm + cách nhiệt
  {
    code: "AD.11111", chapter: "AD - CÔNG TÁC CHỐNG THẤM", section: "AD.1 - Chống thấm sàn", group: "AD.11 - Sàn vệ sinh",
    title: "Chống thấm sàn vệ sinh bằng Sika Top Seal 107, 2 lớp", unit: "m²",
    baseUnitVnd: 145_000, baseVl: 95_000, baseNc: 48_000, baseMay: 2_000,
    resources: [
      { type: "VL", description: "Sika Top Seal 107", unit: "kg", quantity: 2.5 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.165 },
    ],
  },
  // AG - PCCC
  {
    code: "AG.11111", chapter: "AG - CÔNG TÁC PCCC", section: "AG.1 - Hệ chữa cháy", group: "AG.11 - Sprinkler",
    title: "Lắp đặt đầu phun sprinkler ZSTP K=80, có nắp", unit: "cái",
    baseUnitVnd: 285_000, baseVl: 180_000, baseNc: 90_000, baseMay: 15_000,
    resources: [
      { type: "VL", description: "Đầu phun sprinkler 68°C K80", unit: "cái", quantity: 1 },
      { type: "VL", description: "Ống thép D25 SCH40 + măng sông", unit: "m", quantity: 0.8 },
      { type: "NC", description: "Nhân công 4/7", unit: "công", quantity: 0.32 },
    ],
  },
  // AH - Bê tông cốt thép đặc biệt
  {
    code: "AB.31511", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.3 - Bê tông", group: "AB.31 - Bê tông tự lèn",
    title: "Bê tông tự lèn SCC M400 dùng cho kết cấu đặc biệt", unit: "m³",
    baseUnitVnd: 2_180_000, baseVl: 1_820_000, baseNc: 200_000, baseMay: 160_000,
    resources: [
      { type: "VL", description: "Bê tông tự lèn SCC M400", unit: "m³", quantity: 1.015 },
      { type: "NC", description: "Nhân công 5/7", unit: "công", quantity: 0.7 },
    ],
  },
  {
    code: "AB.51411", chapter: "AB - CÔNG TÁC XÂY DỰNG", section: "AB.5 - Cốp pha", group: "AB.51 - Giàn giáo",
    title: "Lắp giàn giáo ngoài khung hoặc khung đỡ", unit: "100 m²",
    baseUnitVnd: 4_500_000, baseVl: 2_800_000, baseNc: 1_600_000, baseMay: 100_000,
    resources: [
      { type: "VL", description: "Khung giàn giáo H1.7m", unit: "khung", quantity: 50 },
      { type: "VL", description: "Mâm + thanh giằng", unit: "kg", quantity: 350 },
      { type: "NC", description: "Nhân công 3.5/7", unit: "công", quantity: 5.5 },
    ],
  },
];

const PROVINCE_FACTOR: Record<string, number> = {
  HCM: 1.0,
  HN: 1.02,
  DN: 0.94,
  BD: 0.96,
};
const PERIOD = "2026-Q2";

async function main() {
  console.log("==> Cost-norm seed");
  for (const def of NORMS) {
    const existing = await prisma.normCode.findUnique({ where: { code: def.code } });
    const norm = existing
      ? existing
      : await prisma.normCode.create({
        data: { code: def.code, chapter: def.chapter, section: def.section, group: def.group, title: def.title, unit: def.unit, source: "TT_10_2019", effectiveFrom: new Date("2019-01-01") },
      });
    // Resources
    const hasResources = await prisma.normResource.count({ where: { normId: norm.id } });
    if (hasResources === 0) {
      for (const r of def.resources) {
        await prisma.normResource.create({
          data: { normId: norm.id, resourceType: r.type, description: r.description, unit: r.unit, quantity: r.quantity },
        });
      }
    }
    // Prices for 4 provinces
    for (const [province, factor] of Object.entries(PROVINCE_FACTOR)) {
      const exists = await prisma.normPrice.findUnique({ where: { normId_province_period: { normId: norm.id, province, period: PERIOD } } });
      if (exists) continue;
      await prisma.normPrice.create({
        data: {
          normId: norm.id, province, period: PERIOD,
          unitPriceVnd: bigVnd(def.baseUnitVnd * factor),
          vlCostVnd: bigVnd(def.baseVl * factor),
          ncCostVnd: bigVnd(def.baseNc * factor),
          mCostVnd: bigVnd(def.baseMay * factor),
          source: `Công bố Sở XD ${province === "HCM" ? "TP.HCM" : province === "HN" ? "Hà Nội" : province === "DN" ? "Đà Nẵng" : "Bình Dương"} Q2/2026`,
        },
      });
    }
  }
  const total = await prisma.normCode.count();
  const totalPrices = await prisma.normPrice.count();
  console.log(`   ${total} norm codes, ${totalPrices} price entries`);
  console.log("==> Done");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
