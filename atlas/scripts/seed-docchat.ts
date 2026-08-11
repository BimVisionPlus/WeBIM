import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });

  const docs = [
    { sourceType: "TCVN", title: "NĐ 06/2021/NĐ-CP — Quản lý chất lượng và bảo trì công trình", body: "Điều 21. Nghiệm thu công việc xây dựng: Tổ chức nghiệm thu khi hoàn thành công việc xây dựng. Thành phần gồm: người trực tiếp giám sát thi công của chủ đầu tư, người trực tiếp phụ trách kỹ thuật thi công của nhà thầu...\n\nĐiều 22. Nghiệm thu giai đoạn / bộ phận: Việc nghiệm thu giai đoạn hoặc nghiệm thu bộ phận công trình thực hiện khi kết thúc thi công bộ phận, giai đoạn theo quy định trong hợp đồng.\n\nĐiều 23. Nghiệm thu hoàn thành công trình xây dựng: Tổ chức nghiệm thu khi hoàn thành toàn bộ công trình xây dựng. Hồ sơ nghiệm thu gồm: ... Phụ lục VIIIb liệt kê 13 nhóm tài liệu hồ sơ hoàn công.", chunkCount: 12 },
    { sourceType: "TCVN", title: "TCVN 5574:2018 — Kết cấu bê tông cốt thép — Tiêu chuẩn thiết kế", body: "Bê tông sử dụng cho kết cấu BTCT có mác không nhỏ hơn B7,5 (M100). Đối với kết cấu chịu lực chính, mác bê tông tối thiểu B15. Lớp bê tông bảo vệ cốt thép theo Bảng 17.\n\nCốt thép thanh sử dụng theo TCVN 1651-2:2018. Khoảng cách giữa các thanh cốt thép không nhỏ hơn 25mm và không nhỏ hơn đường kính lớn nhất của cốt thép.", chunkCount: 28 },
    { sourceType: "TCVN", title: "TCVN 9395:2012 — Cọc khoan nhồi — Thi công và nghiệm thu", body: "Sai số vị trí cọc trên mặt bằng so với thiết kế không lớn hơn 30mm (cọc chính), 50mm (cọc phụ).\n\nSai số đường kính cọc không vượt quá ± 5% đường kính thiết kế.\n\nĐộ sâu cọc đo bằng dây thừng có cờ-lê. Sai số ≤ ± 100mm.\n\nSức chịu tải đầu cọc thử nghiệm bằng phương pháp tải tĩnh hoặc PDA. Hệ số an toàn ≥ 2,5.", chunkCount: 18 },
    { sourceType: "HOP_DONG", title: "HĐ 18/2026/HĐKT-VHGP — Hợp đồng thi công Vinhomes Grand Park S9", body: "Điều 7. Giá trị hợp đồng: 285.000.000.000 đồng (đã bao gồm VAT 8%).\n\nĐiều 9. Tạm ứng: 15% giá trị hợp đồng = 42.750.000.000 đồng, đảm bảo bằng BL Tạm ứng BIDV. Khấu trừ tạm ứng 10% mỗi đợt thanh toán.\n\nĐiều 12. Bảo lưu: 5% mỗi đợt thanh toán, hoàn trả sau khi hết bảo hành 24 tháng.\n\nĐiều 18. Phạt vi phạm: 0,05%/ngày giá trị HĐ chậm tiến độ, tối đa 12%.", chunkCount: 14 },
    { sourceType: "BBNT", title: "BBNT-CV-127 — Nghiệm thu cốt thép sàn tầng 12", body: "Hôm nay, ngày 18 tháng 5 năm 2026, tại công trình Vinhomes Grand Park Lô S9, tầng 12 đoạn 1...\n\nKết quả kiểm tra: Cốt thép D10-D14 lắp đúng bản vẽ. Khoảng cách thép ≤ ± a/20. Lớp bảo vệ 25mm đạt yêu cầu. Mối nối thép có chiều dài ≥ 40d. Gối thép và con kê đầy đủ.\n\nKết luận: Đạt yêu cầu, đồng ý đổ bê tông tiếp theo.\n\nKý: KS Trần T. Bình (NT chính), KS Nguyễn V. An (TVGS), KS Lê Q. Cường (CĐT).", chunkCount: 4 },
    { sourceType: "CV_QLNN", title: "VB 2245/SXD-CCXD — Yêu cầu báo cáo tiến độ Quý 2/2026", body: "Sở Xây dựng TP. HCM yêu cầu chủ đầu tư báo cáo tiến độ thi công Quý 2/2026 đối với DA Vinhomes Grand Park Lô S9 trước ngày 15/5/2026. Nội dung báo cáo: tiến độ % hoàn thành, khối lượng đã thi công, kế hoạch Q3...", chunkCount: 3 },
    { sourceType: "BPTC", title: "BPTC-VHGP-S9-COC-001 — Biện pháp thi công cọc khoan nhồi D800", body: "## Phạm vi\nKhối A trục 1-8, 245 cọc D800, chiều sâu thiết kế 42m, bê tông B25.\n\n## Trình tự thi công\n1. Định vị mặt bằng + dựng casing trên cao trình ≥ -2.0m\n2. Khoan tạo lỗ bằng máy SR250-W bùn bentonite\n3. Lắp lồng thép D16-D25 CB400-V\n4. Đổ bê tông bằng phễu Tremie, theo dõi cao trình bùn\n5. Kiểm tra PDA + thử tải tĩnh 5% số cọc\n\n## Kiểm soát chất lượng\n- Sai số vị trí ≤ 30mm\n- Cường độ R28 ≥ M25 (25 MPa)\n- TVGS hold-point: kiểm tra đáy hố trước khi đổ BT", chunkCount: 9 },
    { sourceType: "TCVN", title: "QCVN 06:2022/BXD — An toàn cháy cho nhà và công trình", body: "Bậc chịu lửa của công trình theo quy định trong Bảng 4. Đối với nhà chung cư cao tầng (>9 tầng), bậc chịu lửa tối thiểu I.\n\nLối thoát hiểm: Khoảng cách từ điểm xa nhất đến lối thoát ≤ 25m (hành lang kín). Bề rộng lối thoát ≥ 1.2m mỗi 100 người.\n\nHệ thống báo cháy tự động bắt buộc cho nhà từ 5 tầng trở lên hoặc diện tích sàn ≥ 1500m². Sprinkler theo TCVN 7336.", chunkCount: 22 },
  ];

  for (const d of docs) {
    await prisma.docCorpus.create({
      data: {
        projectId: d.sourceType === "HOP_DONG" || d.sourceType === "BBNT" || d.sourceType === "CV_QLNN" || d.sourceType === "BPTC" ? project?.id ?? null : null,
        sourceType: d.sourceType as never,
        title: d.title,
        body: d.body,
        chunkCount: d.chunkCount,
        indexed: true,
        indexedAt: new Date(),
        embedModel: "bge-m3",
      },
    });
    console.log(`  ✓ ${d.title.slice(0, 60)}… (${d.chunkCount} chunks)`);
  }

  const sampleQueries = [
    { q: "Theo NĐ 06/2021 Đ.21, thành phần BBNT công việc xây dựng gồm những ai?", a: "Theo NĐ 06/2021 Điều 21, thành phần tham gia nghiệm thu công việc xây dựng gồm: (1) người trực tiếp giám sát thi công của chủ đầu tư, (2) người trực tiếp phụ trách kỹ thuật thi công của nhà thầu, (3) đại diện TVGS." },
    { q: "Đường kính cọc khoan nhồi D800 cho phép sai số bao nhiêu?", a: "Theo TCVN 9395:2012, sai số đường kính cọc khoan nhồi không vượt quá ± 5% đường kính thiết kế. Với D800 thì cho phép 760-840mm." },
    { q: "Giá trị bảo lưu trong HĐ 18/2026 là bao nhiêu phần trăm?", a: "Theo Điều 12 của HĐ 18/2026/HĐKT-VHGP, bảo lưu là 5% giá trị mỗi đợt thanh toán, hoàn trả sau khi hết bảo hành 24 tháng." },
  ];

  for (const q of sampleQueries) {
    await prisma.docChatQuery.create({
      data: {
        question: q.q, answer: q.a,
        modelUsed: "qwen2.5-14b-instruct",
        latencyMs: 1200 + Math.floor(Math.random() * 800),
        citations: [{ snippet: q.a.slice(0, 80), score: 0.91 }, { snippet: "…", score: 0.86 }],
      },
    });
    console.log(`  ✓ Query: ${q.q.slice(0, 50)}…`);
  }
  console.log("✅ DocChat-VN seeded");
}

main().finally(() => prisma.$disconnect());
