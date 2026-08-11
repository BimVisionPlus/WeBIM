import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  const ntOrg = await prisma.organization.findFirst({ where: { type: "NHA_THAU_CHINH" } });
  if (!project || !ntOrg) { console.error("Need project + NT_CHINH"); process.exit(1); }

  const workers = [
    { code: "NT-001", name: "Nguyễn V. An", id: "079198000001", trade: "Chỉ huy trưởng công trình", level: "KS XD", isStaff: true, hseGroup: "N2", hseExp: "2027-04-15", proNo: "HĐXD-2022-04221", proExp: "2027-12-31" },
    { code: "NT-002", name: "Trần T. Bình", id: "079198000002", trade: "KS giám sát NT chính", level: "KS XD", isStaff: true, hseGroup: "N2", hseExp: "2027-03-20", proNo: "HĐXD-2023-09921" },
    { code: "NT-003", name: "Lê Q. Cường", id: "079198000003", trade: "Đội trưởng kết cấu", level: "Thợ bậc 7/7", isStaff: false, hseGroup: "N3", hseExp: "2027-04-30" },
    { code: "NT-004", name: "Phạm T. Diệu", id: "079198000004", trade: "Thợ sắt", level: "Thợ bậc 5/7", isStaff: false, hseGroup: "N3", hseExp: "2024-06-20" },
    { code: "NT-005", name: "Hoàng V. Em", id: "079198000005", trade: "Thợ điện", level: "Thợ bậc 5/7", isStaff: false, hseGroup: "N3", hseExp: "2027-06-15" },
    { code: "NT-006", name: "Đỗ T. Phương", id: "079198000006", trade: "Thợ phụ", level: "—", isStaff: false, hseGroup: "N4", hseExp: "2027-05-01" },
    { code: "NT-007", name: "Vũ V. Giáp", id: "079198000007", trade: "Thợ phụ", level: "—", isStaff: false, hseGroup: "N4", hseExp: "2026-06-22" },
    { code: "NT-008", name: "Nguyễn V. Hùng", id: "079198000008", trade: "Thợ cốp pha", level: "Thợ bậc 4/7", isStaff: false, hseGroup: "N3", hseExp: "2027-06-30" },
  ];

  const created: { id: string; code: string }[] = [];
  for (const w of workers) {
    const sw = await prisma.siteWorker.upsert({
      where: { orgId_workerCode: { orgId: ntOrg.id, workerCode: w.code } },
      create: {
        orgId: ntOrg.id,
        projectId: project.id,
        workerCode: w.code,
        fullName: w.name,
        idNo: w.id,
        trade: w.trade,
        level: w.level,
        isStaff: w.isStaff,
        startedAt: new Date("2026-01-10"),
        hseGroup: w.hseGroup as never,
        hseCertNumber: `ATLD-${w.hseGroup}-2026-${w.code.replace("NT-", "")}`,
        hseCertExpiry: new Date(w.hseExp),
        proLicenseNo: (w as { proNo?: string }).proNo ?? null,
        proLicenseExpiry: (w as { proExp?: string }).proExp ? new Date((w as { proExp?: string }).proExp!) : null,
        badgeQrCode: `https://app.aecplatform.vn/workforce/badge/${w.code}`,
      },
      update: {},
    });
    created.push({ id: sw.id, code: w.code });
    console.log(`  ✓ ${w.code} — ${w.name}`);
  }

  // Today's attendance
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const attendances = [
    { workerCode: "NT-001", hour: 7, min: 12, gate: "Cổng A", method: "FACE", faceMatch: "0.9821", ppe: { helmet: true, vest: true, boots: true } },
    { workerCode: "NT-002", hour: 7, min: 18, gate: "Cổng A", method: "FACE", faceMatch: "0.9745", ppe: { helmet: true, vest: true, boots: true } },
    { workerCode: "NT-003", hour: 6, min: 55, gate: "Cổng A", method: "QR", ppe: { helmet: true, vest: true, boots: true } },
    { workerCode: "NT-004", hour: 6, min: 58, gate: "Cổng A", method: "QR", ppe: { helmet: false, vest: true, boots: true } },
    { workerCode: "NT-005", hour: 7, min: 2, gate: "Cổng B", method: "QR", ppe: { helmet: true, vest: true, boots: true } },
    { workerCode: "NT-006", hour: 7, min: 5, gate: "Cổng A", method: "QR", ppe: { helmet: true, vest: true, boots: true } },
    { workerCode: "NT-007", hour: 7, min: 9, gate: "Cổng A", method: "QR", ppe: { helmet: true, vest: false, boots: true } },
    { workerCode: "NT-008", hour: 7, min: 15, gate: "Cổng A", method: "FACE", faceMatch: "0.9612", ppe: { helmet: true, vest: true, boots: true } },
  ];
  for (const a of attendances) {
    const worker = created.find((w) => w.code === a.workerCode);
    if (!worker) continue;
    const checkIn = new Date(today);
    checkIn.setHours(a.hour, a.min, 0, 0);
    await prisma.attendance.create({
      data: {
        workerId: worker.id, projectId: project.id, checkInAt: checkIn, gateCode: a.gate, method: a.method as never,
        faceMatchScore: a.faceMatch ? new Prisma.Decimal(a.faceMatch) : null, ppeStatus: a.ppe,
      },
    });
    console.log(`  ✓ Check-in ${a.workerCode} ${a.hour}:${String(a.min).padStart(2, "0")} ${a.gate}`);
  }
  console.log("✅ WorkforceHub seeded");
}

main().finally(() => prisma.$disconnect());
