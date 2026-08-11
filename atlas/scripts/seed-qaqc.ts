// Seed ITP library + sample checks. Source: TCVN tham chiếu chuẩn ngành.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ITPS = [
  {
    code: "ITP-MONG-COC-D800",
    category: "MONG_COC",
    title: "ITP cọc khoan nhồi D800",
    description: "Kiểm tra cọc khoan nhồi D600-D1200 trong điều kiện đất sét/cát.",
    tcvnRefs: ["TCVN 9395:2012", "TCVN 9398:2012", "TCVN 9393:2012"],
    items: [
      { seq: 1, checkPoint: "Vị trí cọc trên mặt bằng", acceptCrit: "Sai số ≤ 30mm so với bản vẽ", method: "Đo tổng trạm sau khi dựng casing", frequency: "100%", tcvnRef: "TCVN 9395:2012 §6.2", hold: true },
      { seq: 2, checkPoint: "Đường kính cọc", acceptCrit: "D800 ± 5% (760-840mm)", method: "Đo bằng thước kẹp khi rút casing", frequency: "Mỗi cọc đo 3 điểm", tcvnRef: "TCVN 9395:2012 §7.3", hold: false, witness: true },
      { seq: 3, checkPoint: "Độ sâu cọc", acceptCrit: "≥ 42m theo TKBVTC", method: "Đo dây thừng + cờ-lê", frequency: "100%", tcvnRef: "TCVN 9395:2012 §7.4", hold: true },
      { seq: 4, checkPoint: "Cấp phối + độ sụt bê tông", acceptCrit: "B25, slump 18-22cm", method: "Lấy mẫu trước khi đổ", frequency: "Mỗi xe", tcvnRef: "TCVN 3105:1993", hold: false },
      { seq: 5, checkPoint: "Cường độ bê tông R28", acceptCrit: "≥ Mác 25 (≥ 25 MPa)", method: "Ép mẫu phòng LAS", frequency: "3 tổ mẫu/cọc", tcvnRef: "TCVN 3118:1993", hold: false, witness: true },
    ],
  },
  {
    code: "ITP-COT-THEP-DAY",
    category: "COT_THEP",
    title: "ITP cốt thép đài/dầm/sàn",
    description: "Kiểm tra cốt thép trước khi đổ bê tông.",
    tcvnRefs: ["TCVN 1651-2:2018", "TCVN 4453:1995"],
    items: [
      { seq: 1, checkPoint: "Mác thép, đường kính, số lượng", acceptCrit: "Theo TKBVTC; CB400-V cho D10+", method: "Đếm + đo kích thước", frequency: "100%", tcvnRef: "TCVN 1651-2:2018", hold: true },
      { seq: 2, checkPoint: "Khoảng cách thép, lớp bảo vệ", acceptCrit: "Sai số ≤ ± a/20 nhưng không quá 10mm", method: "Đo thước thép", frequency: "5 điểm/m2", tcvnRef: "TCVN 4453:1995 §6.6", hold: false },
      { seq: 3, checkPoint: "Mối nối / chiều dài neo", acceptCrit: "≥ 40d cho D10-D14, ≥ 35d cho D16+", method: "Đo trực tiếp", frequency: "100% mối nối", tcvnRef: "TCVN 4453:1995 §6.8", hold: true },
      { seq: 4, checkPoint: "Gối thép, con kê", acceptCrit: "Đảm bảo lớp bảo vệ; bê tông gối", method: "Quan sát + đo", frequency: "100%", tcvnRef: "TCVN 4453:1995 §6.7" },
    ],
  },
  {
    code: "ITP-BT-SAN-B30",
    category: "BE_TONG",
    title: "ITP bê tông sàn B30 SCC",
    description: "Bê tông tự lèn (Self-Compacting Concrete) cho sàn dày ≤ 250mm.",
    tcvnRefs: ["TCVN 4453:1995", "TCVN 3118:1993", "TCVN 5574:2018"],
    items: [
      { seq: 1, checkPoint: "Slump-flow trước khi đổ", acceptCrit: "≥ 600mm (SF2 theo EN 206-9)", method: "Slump-flow test", frequency: "Mỗi xe", tcvnRef: "TCVN 12209:2018", hold: false },
      { seq: 2, checkPoint: "Nhiệt độ bê tông", acceptCrit: "≤ 32°C khi đổ", method: "Nhiệt kế", frequency: "Mỗi xe", tcvnRef: "TCVN 4453:1995 §6.6.3" },
      { seq: 3, checkPoint: "Lấy mẫu hồi quy", acceptCrit: "3 tổ mẫu × 3 viên 150x150x150", method: "Đúc mẫu tại hiện trường", frequency: "Mỗi 100m3 hoặc mỗi ca", tcvnRef: "TCVN 3105:1993", hold: false },
      { seq: 4, checkPoint: "R28 ép mẫu", acceptCrit: "Trung bình ≥ Mác × 1.10; min ≥ Mác × 0.85", method: "Nén thí nghiệm LAS", frequency: "100% mẫu", tcvnRef: "TCVN 3118:1993", hold: false, witness: true },
      { seq: 5, checkPoint: "Bảo dưỡng bê tông", acceptCrit: "Giữ ẩm ≥ 7 ngày; ≥ 14 ngày trong điều kiện nóng", method: "Quan sát + nhật ký", frequency: "Hằng ngày", tcvnRef: "TCVN 8828:2011" },
    ],
  },
  {
    code: "ITP-MEP-PPR-D32",
    category: "MEP_CAP_THOAT",
    title: "ITP ống PPR cấp nước nóng-lạnh D20-D40",
    description: "Hệ cấp nước trong nhà; thử áp + thử kín.",
    tcvnRefs: ["TCVN 4519:1988", "TCVN 5576:2012"],
    items: [
      { seq: 1, checkPoint: "Đường kính, độ dày ống", acceptCrit: "Theo CO/CQ; PN20 cho nóng", method: "Đo + đối chiếu CO", frequency: "Mỗi lô VL nhận", tcvnRef: "TCVN 7305-1:2008" },
      { seq: 2, checkPoint: "Mối hàn nhiệt", acceptCrit: "Không vênh, không lệch tâm; vành mép đều", method: "Quan sát mục", frequency: "100% mối", hold: false },
      { seq: 3, checkPoint: "Thử áp đường ống", acceptCrit: "P = 1.5 × P làm việc, giữ 1h, độ tụt áp ≤ 0.1 bar", method: "Bơm + đồng hồ áp", frequency: "Mỗi tuyến trước khi che kín", tcvnRef: "TCVN 4519:1988 §4.3", hold: true },
    ],
  },
  {
    code: "ITP-HT-LAT-GACH",
    category: "HOAN_THIEN",
    title: "ITP lát gạch ceramic 600x600 nền nhà",
    tcvnRefs: ["TCVN 9377-3:2012"],
    items: [
      { seq: 1, checkPoint: "Phẳng mặt vữa nền", acceptCrit: "Sai số ≤ 3mm/2m", method: "Thước nhôm 2m", frequency: "10 điểm/100m2" },
      { seq: 2, checkPoint: "Mạch khe đều", acceptCrit: "1-3mm, đường mạch thẳng", method: "Quan sát + thước", frequency: "Toàn bộ" },
      { seq: 3, checkPoint: "Độ rỗng dưới gạch", acceptCrit: "Gõ kiểm; rỗng ≤ 5% diện tích", method: "Gõ búa nhựa nhỏ", frequency: "100% sau 24h" },
    ],
  },
];

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });

  for (const t of ITPS) {
    const template = await prisma.itpTemplate.upsert({
      where: { code: t.code },
      create: { code: t.code, category: t.category as never, title: t.title, description: t.description, tcvnRefs: t.tcvnRefs, isGlobal: true },
      update: { tcvnRefs: t.tcvnRefs, title: t.title },
    });
    await prisma.itpItem.deleteMany({ where: { templateId: template.id } });
    await prisma.itpItem.createMany({ data: t.items.map((i) => ({ templateId: template.id, ...(i as Record<string, unknown>) })) as never });
    console.log(`  ✓ ${t.code} — ${t.items.length} điểm kiểm tra`);
  }

  if (project) {
    const cocItp = await prisma.itpTemplate.findUnique({ where: { code: "ITP-MONG-COC-D800" } });
    const btItp = await prisma.itpTemplate.findUnique({ where: { code: "ITP-BT-SAN-B30" } });
    const checks = [
      { templateId: cocItp?.id, location: "Cọc P14 trục 3-A", result: "PASS", conductedAt: new Date("2026-02-12") },
      { templateId: cocItp?.id, location: "Cọc P22 trục 5-C", result: "PASS", conductedAt: new Date("2026-02-15") },
      { templateId: cocItp?.id, location: "Cọc P31 trục 7-B", result: "FAIL", conductedAt: new Date("2026-02-18"), notes: "Độ sâu chỉ đạt 38m, thiếu 4m. Yêu cầu khoan lại." },
      { templateId: btItp?.id, location: "Sàn tầng 12 đoạn 1", result: "PASS", conductedAt: new Date("2026-05-17") },
      { templateId: btItp?.id, location: "Sàn tầng 12 đoạn 2", result: "PENDING", conductedAt: new Date("2026-05-20") },
      { templateId: btItp?.id, location: "Sàn tầng 11", result: "REWORK", conductedAt: new Date("2026-05-10"), notes: "Slump-flow chỉ đạt 540mm, cần điều chỉnh phụ gia." },
    ];
    for (const c of checks) {
      await prisma.qaqcCheck.create({ data: { projectId: project.id, ...c as never } });
      console.log(`  ✓ Check ${c.location} — ${c.result}`);
    }
  }
  console.log("✅ QAQC seeded");
}

main().finally(() => prisma.$disconnect());
