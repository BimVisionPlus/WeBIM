import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) { console.error("Project not found"); process.exit(1); }

  const samples = [
    { source: "PAYMENT", title: "Đề nghị thanh toán kỳ 2026-05", summary: "Bộ HSTT giai đoạn 05/2026 — KL 22.75 tỷ, ròng 20.88 tỷ. NT+TVGS+CĐT ký xong.", amountVnd: 20_884_500_000n, priority: "HIGH", state: "PENDING", dueAt: new Date(Date.now() + 3 * 86400000) },
    { source: "CHANGEORDER", title: "CO-VHGP-S9-018: Bổ sung cọc P31A", summary: "Cọc P31 không đạt sức chịu tải, bổ sung cọc P31A D800 L=45m. Phát sinh 320 triệu.", amountVnd: 320_000_000n, priority: "URGENT", state: "PENDING", dueAt: new Date(Date.now() + 1 * 86400000) },
    { source: "QAQC", title: "BBNT cốt thép sàn tầng 12 đoạn 2", summary: "ITP-COT-THEP-DAY: 4/4 check PASS, TVGS xác nhận.", priority: "NORMAL", state: "PENDING", dueAt: new Date(Date.now() + 2 * 86400000) },
    { source: "METHOD", title: "BPTC MEP tầng 1-5 toà A", summary: "Trình duyệt biện pháp thi công MEP. TVGS đã duyệt.", priority: "NORMAL", state: "IN_REVIEW", dueAt: new Date(Date.now() + 4 * 86400000) },
    { source: "MATERIAL", title: "Lô thép D10 không có CR", summary: "Lô LOT-THEP-VHGP-S9-04259 5.2 tấn không có CR hợp quy QCVN 7:2018. Đề nghị trả NCC.", priority: "URGENT", state: "APPROVED", decidedAt: new Date(Date.now() - 1 * 86400000), decision: "APPROVE", decisionNote: "Đồng ý trả NCC. Yêu cầu Phòng Vật tư đổi NCC." },
    { source: "PAYMENT", title: "Đề nghị thanh toán kỳ 2026-04", summary: "Bộ HSTT giai đoạn 04/2026 — đã thanh toán 14/04.", amountVnd: 16_983_000_000n, priority: "NORMAL", state: "APPROVED", decidedAt: new Date("2026-04-08"), decision: "APPROVE" },
    { source: "ACCEPTANCE", title: "BBNT giai đoạn — Móng cọc + đài cọc", summary: "Nghiệm thu giai đoạn theo Đ.22 NĐ 06/2021. 245 cọc + 24 đài.", priority: "NORMAL", state: "APPROVED", decidedAt: new Date("2026-03-25"), decision: "APPROVE" },
    { source: "CHANGEORDER", title: "CO-VHGP-S9-014: Thay đổi MEP tầng 8", summary: "TVTK đề xuất thay đổi đường ống cấp nước nóng tầng 8. -120 triệu.", amountVnd: -120_000_000n, priority: "NORMAL", state: "REJECTED", decidedAt: new Date("2026-04-22"), decision: "REJECT", decisionNote: "Không đồng ý — giữ phương án thiết kế gốc." },
  ];

  for (const s of samples) {
    await prisma.approvalRequest.create({
      data: {
        projectId: project.id,
        source: s.source as never,
        sourceId: `mock-${s.source}-${Math.random().toString(36).slice(2, 8)}`,
        title: s.title,
        summary: s.summary,
        amountVnd: (s as { amountVnd?: bigint }).amountVnd ?? null,
        priority: s.priority as never,
        state: s.state as never,
        dueAt: (s as { dueAt?: Date }).dueAt ?? null,
        decidedAt: (s as { decidedAt?: Date }).decidedAt ?? null,
        decision: (s as { decision?: string }).decision as never ?? null,
        decisionNote: (s as { decisionNote?: string }).decisionNote ?? null,
        attachmentIds: [],
      },
    });
    console.log(`  ✓ ${s.source} — ${s.title.slice(0, 50)}… — ${s.state}`);
  }
  console.log("✅ ClientPortal seeded");
}

main().finally(() => prisma.$disconnect());
