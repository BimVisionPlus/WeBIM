/**
 * Seed spec pages for the demo project + embed them via bge-m3.
 * Lets /api/ai/submittal/check work against real specs.
 *
 * Usage:
 *   DATABASE_URL=… GROQ_API_KEY=… CF_ACCOUNT_ID=… CF_API_TOKEN=… \
 *     pnpm exec tsx ../../scripts/seed-spec-pages.ts <projectId>
 */

import { PrismaClient } from "@prisma/client";
import { embed } from "../packages/ai/src/embed";

const prisma = new PrismaClient();

const SPEC_PAGES: Array<{ slug: string; title: string; body: string }> = [
  {
    slug: "03-30-00-cast-in-place-concrete",
    title: "03 30 00 — Cast-in-Place Concrete",
    body: `# Bê tông đổ tại chỗ

## 1. Phạm vi
Spec section này quy định yêu cầu kỹ thuật cho bê tông đổ tại chỗ dùng trong kết cấu cột, dầm, sàn của công trình.

## 2. Vật liệu yêu cầu
- **Mác bê tông:** M300 cho cột tầng hầm; M250 cho dầm sàn.
- **Loại xi măng:** PC40 hoặc PCB40 theo TCVN 6260:2009.
- **Cốt liệu thô:** Đá dăm 1x2cm, sạch không dính bùn, theo TCVN 7570:2006.
- **Phụ gia:** Phụ gia giảm nước tăng dẻo theo TCVN 8826:2011 (BASF Pozzolith, Sika ViscoCrete).
- **Nhà cung cấp đề xuất:** Holcim Việt Nam, Vicem, Insee Vietnam.

## 3. Yêu cầu chất lượng
- **Cường độ nén 28 ngày:** ≥ 30 MPa (M300).
- **Độ sụt:** 12 ± 2 cm.
- **Tỷ lệ N/X:** ≤ 0.48.

## 4. Tiêu chuẩn tham chiếu
- TCVN 5574:2018 (Kết cấu BTCT — Tiêu chuẩn thiết kế)
- TCVN 4453:1995 (Kết cấu BTCT toàn khối — Quy phạm thi công và nghiệm thu)
- TCVN 9382:2012 (Đánh giá cường độ bê tông).`,
  },
  {
    slug: "05-12-00-structural-steel",
    title: "05 12 00 — Structural Steel",
    body: `# Cốt thép kết cấu

## 1. Phạm vi
Spec section này quy định yêu cầu cho cốt thép sử dụng trong kết cấu BTCT.

## 2. Vật liệu yêu cầu
- **Mác thép:** CB400-V theo TCVN 1651-2:2008 cho thép tròn vằn D10–D32.
- **Mác thép:** CB240-T theo TCVN 1651-1:2008 cho thép tròn trơn D6–D8 (làm đai).
- **Nhà sản xuất chấp nhận:** Hòa Phát, Pomina, VINAKYOEI, Việt-Đức Tisco.

## 3. Yêu cầu chất lượng
- **Giới hạn chảy:** fy ≥ 400 MPa (CB400-V).
- **Giới hạn bền:** fu ≥ 570 MPa.
- **Độ giãn dài:** ≥ 14%.
- Mỗi lô thép phải có chứng nhận xuất xưởng (Mill Test Certificate).

## 4. Tiêu chuẩn
- TCVN 1651-1:2008, TCVN 1651-2:2008
- TCVN 5574:2018 (thiết kế kết cấu BTCT).`,
  },
  {
    slug: "22-11-00-domestic-water-piping",
    title: "22 11 00 — Domestic Water Piping",
    body: `# Hệ thống cấp nước sinh hoạt

## 1. Phạm vi
Spec quy định ống cấp nước và phụ kiện cho hệ thống cấp nước sinh hoạt nhà ở.

## 2. Vật liệu
- **Đường ống chính:** PPR DN25–DN50 PN20 (chịu áp 20 bar).
- **Đường ống nhánh:** PPR DN20 PN16.
- **Phụ kiện:** Tê, cút, van bi, van 1 chiều — cùng nhà sản xuất với ống.
- **Nhà sản xuất chấp nhận:** Tiền Phong, Bình Minh, Đệ Nhất, Vesbo.

## 3. Yêu cầu chất lượng
- **Áp suất thử:** 1.5 lần áp suất làm việc, giữ 24 giờ, không sụt áp.
- **Vật liệu PPR:** Random PP, có chứng nhận VSATTP.

## 4. Tiêu chuẩn
- TCVN 4519:1988 (Hệ thống cấp thoát nước — quy phạm thi công).
- TCVN 7305:2008 (Ống PPR).`,
  },
  {
    slug: "26-05-19-conductors",
    title: "26 05 19 — Conductors & Cables",
    body: `# Dây dẫn và cáp điện

## 1. Phạm vi
Spec quy định dây/cáp dẫn điện hạ thế 0.6/1kV cho hệ thống điện nội bộ.

## 2. Vật liệu
- **Dây nhỏ (ổ cắm, đèn):** CV 2x2.5mm² hoặc CV 2x4.0mm² ruột đồng.
- **Dây trung (cáp xuất tủ):** CXV/DSTA 4x16mm² đến 4x70mm² theo thiết kế.
- **Nhà sản xuất chấp nhận:** Cadivi, LS-VINA, Trần Phú, Daphaco.
- **Tiêu chuẩn cách điện:** PVC theo TCVN 6612:2007.

## 3. Yêu cầu chất lượng
- **Điện áp danh định:** 0.6/1kV.
- **Nhiệt độ ruột tối đa khi vận hành:** 70°C (PVC).
- Mỗi cuộn dây phải có nhãn hãng + tem QC.

## 4. Tiêu chuẩn
- TCVN 6612:2007, TCVN 5935-1:2013.
- 11 TCN-19-2006 (quy phạm trang bị điện).`,
  },
];

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: tsx seed-spec-pages.ts <projectId>");
    process.exit(1);
  }

  console.log(`==> Seeding spec pages for project ${projectId}`);

  // Find an author user — any membership in any org
  const user = await prisma.user.findFirstOrThrow({ where: { email: "anh.nguyen@cofico.vn" } });

  for (const p of SPEC_PAGES) {
    console.log(`   + ${p.slug}`);

    // Embed
    const r = await embed(`${p.title}\n${p.body}`);
    const embedding = r.ok ? r.data : null;
    const embedModel = r.ok ? r.model : null;
    const embeddedAt = r.ok ? new Date() : null;

    await prisma.specPage.upsert({
      where: { projectId_slug: { projectId, slug: p.slug } },
      create: {
        projectId, slug: p.slug, title: p.title, body: p.body,
        authorId: user.id,
        embedding: embedding as any,
        embeddedAt,
        embedModel,
      },
      update: {
        title: p.title, body: p.body,
        embedding: embedding as any,
        embeddedAt,
        embedModel,
      },
    });
    console.log(`     embed ${r.ok ? `OK (${(embedding as number[]).length} dims)` : `FAIL: ${r.error ?? r.reason}`}`);
  }

  console.log("==> Done");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
