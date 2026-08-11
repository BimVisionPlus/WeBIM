import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  const supplier = await prisma.organization.findFirst({ where: { type: "NHA_CUNG_CAP" } });
  if (!project) { console.error("Project not found"); process.exit(1); }

  const lots = [
    {
      lotCode: "LOT-THEP-VHGP-S9-04221", materialName: "Thép thanh CB400-V D16", category: "THEP",
      manufacturer: "Pomina Steel", origin: "Việt Nam", receivedAt: new Date("2026-05-10"),
      quantity: "28.50", unit: "tấn", coDocUrl: "lots/04221/co.pdf", cqDocUrl: "lots/04221/cq.pdf",
      crCertNo: "CR-POM-2025-08821", crCertExpiry: new Date("2028-12-31"),
      state: "ACCEPTED", acceptedAt: new Date("2026-05-11"),
    },
    {
      lotCode: "LOT-XM-VHGP-S9-04230", materialName: "Xi măng PCB40 Holcim", category: "XI_MANG",
      manufacturer: "Holcim Việt Nam", origin: "Việt Nam", receivedAt: new Date("2026-05-12"),
      quantity: "120.00", unit: "tấn", coDocUrl: "lots/04230/co.pdf", cqDocUrl: "lots/04230/cq.pdf",
      crCertNo: "CR-HOL-2024-99812", crCertExpiry: new Date("2027-06-30"),
      state: "PARTIAL_USED",
    },
    {
      lotCode: "LOT-BT-VHGP-S9-04241", materialName: "Bê tông thương phẩm B30 SCC", category: "BE_TONG_TUOI",
      manufacturer: "Holcim ReadyMix", origin: "Việt Nam", receivedAt: new Date("2026-05-20"),
      quantity: "142.00", unit: "m3", coDocUrl: "lots/04241/co.pdf", cqDocUrl: "lots/04241/cq-slump.pdf",
      state: "USED_UP",
    },
    {
      lotCode: "LOT-KINH-VHGP-S9-04222", materialName: "Kính cường lực 12mm low-E", category: "KINH",
      manufacturer: "Việt Hưng Glass", origin: "Việt Nam", receivedAt: new Date("2026-05-15"),
      quantity: "480.00", unit: "m2", coDocUrl: "lots/04222/co.pdf", cqDocUrl: "lots/04222/cq.pdf",
      crCertNo: "CR-VH-2025-01102", state: "ACCEPTED", acceptedAt: new Date("2026-05-16"),
    },
    {
      lotCode: "LOT-GACH-VHGP-S9-04231", materialName: "Gạch ceramic 600x600 vân đá", category: "GACH",
      manufacturer: "Đồng Tâm Ceramic", origin: "Việt Nam", receivedAt: new Date("2026-05-08"),
      quantity: "3200", unit: "viên", coDocUrl: "lots/04231/co.pdf",
      state: "TESTING",
    },
    {
      lotCode: "LOT-PG-VHGP-S9-04250", materialName: "Phụ gia siêu dẻo SikaPlast 280VN", category: "PHU_GIA",
      manufacturer: "Sika Việt Nam", origin: "Việt Nam", receivedAt: new Date("2026-05-19"),
      quantity: "200", unit: "L", coDocUrl: "lots/04250/co.pdf", cqDocUrl: "lots/04250/cq.pdf",
      state: "ACCEPTED", acceptedAt: new Date("2026-05-19"),
    },
    {
      lotCode: "LOT-THEP-VHGP-S9-04259", materialName: "Thép D10 không rõ NSX", category: "THEP",
      manufacturer: "Không rõ", origin: "?", receivedAt: new Date("2026-05-21"),
      quantity: "5.20", unit: "tấn",
      state: "REJECTED", rejectedReason: "Không có CO, không có CR hợp quy theo QCVN 7:2018. Trả về NCC.",
    },
  ];

  for (const l of lots) {
    await prisma.materialLot.upsert({
      where: { projectId_lotCode: { projectId: project.id, lotCode: l.lotCode } },
      create: {
        projectId: project.id, supplierOrgId: supplier?.id ?? null,
        ...l, category: l.category as never, state: l.state as never,
        quantity: new Prisma.Decimal(l.quantity),
        qrCode: `https://app.aecplatform.vn/material/${l.lotCode}`,
        testRefs: [],
      },
      update: {},
    });
    console.log(`  ✓ ${l.lotCode} — ${l.state}`);
  }
  console.log("✅ MaterialTrace seeded");
}

main().finally(() => prisma.$disconnect());
