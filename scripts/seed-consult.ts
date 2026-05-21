import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tvgsOrg = await prisma.organization.findFirst({ where: { type: "TU_VAN_GIAM_SAT" } });
  const tvtkOrg = await prisma.organization.findFirst({ where: { type: "TU_VAN_THIET_KE" } });
  const cdtOrg = await prisma.organization.findFirst({ where: { type: "CHU_DAU_TU" } });
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });

  if (!tvgsOrg || !cdtOrg || !project) { console.error("Need orgs"); process.exit(1); }

  const contracts = [
    { org: tvgsOrg.id, no: "HĐ-TVGS-2026-VHGP-S9", type: "TVGS", total: 8_550_000_000n, invoiced: 4_280_000_000n, paid: 3_420_000_000n, pct: "50.00", start: new Date("2026-01-15") },
    tvtkOrg && { org: tvtkOrg.id, no: "HĐ-TVTK-2025-VHGP-S9-PH1", type: "TVTK", total: 12_800_000_000n, invoiced: 12_800_000_000n, paid: 11_520_000_000n, pct: "100.00", start: new Date("2025-03-20"), end: new Date("2025-12-31"), state: "COMPLETED" },
  ].filter(Boolean) as Array<{ org: string; no: string; type: string; total: bigint; invoiced: bigint; paid: bigint; pct: string; start: Date; end?: Date; state?: string }>;

  for (const c of contracts) {
    await prisma.consultantContract.upsert({
      where: { orgId_contractNo: { orgId: c.org, contractNo: c.no } },
      create: {
        orgId: c.org, clientOrgId: cdtOrg.id, projectId: project.id,
        contractNo: c.no, contractType: c.type as never,
        totalValueVnd: c.total, invoicedVnd: c.invoiced, paidVnd: c.paid,
        percentComplete: new Prisma.Decimal(c.pct),
        startDate: c.start, endDate: c.end ?? null, state: c.state ?? "ACTIVE",
      },
      update: { invoicedVnd: c.invoiced, paidVnd: c.paid, percentComplete: new Prisma.Decimal(c.pct) },
    });
    console.log(`  ✓ Contract ${c.no} — ${c.type}`);
  }

  const timesheets = [
    { date: new Date("2026-05-20"), name: "KS Nguyễn V. An", role: "KS giám sát chính", hours: "8.0", rate: 850_000n, desc: "Giám sát đổ BT sàn tầng 12 đoạn 2; ký BBNT KL; chữ ký số nhật ký TVGS." },
    { date: new Date("2026-05-19"), name: "KS Nguyễn V. An", role: "KS giám sát chính", hours: "8.0", rate: 850_000n, desc: "Kiểm tra cốt thép sàn tầng 12; lập NCR cọc P31." },
    { date: new Date("2026-05-18"), name: "KS Phan T. Hà", role: "KS MEP", hours: "8.0", rate: 720_000n, desc: "Kiểm tra ống PPR MEP tầng 5; thử áp đường ống.", billable: true },
    { date: new Date("2026-05-17"), name: "KS Nguyễn V. An", role: "KS giám sát chính", hours: "6.0", rate: 850_000n, desc: "Họp đầu tuần với CĐT + NT chính." },
    { date: new Date("2026-05-15"), name: "KTS Lê M. Châu", role: "Architect senior", hours: "4.0", rate: 950_000n, desc: "Review biện pháp thi công MEP tầng 1-5.", billable: false },
    { date: new Date("2026-05-13"), name: "KS Đặng V. Trí", role: "Junior KS", hours: "8.0", rate: 480_000n, desc: "Cập nhật bản vẽ as-built sàn tầng 11." },
  ];

  for (const t of timesheets) {
    const hours = new Prisma.Decimal(t.hours);
    const amount = BigInt(Number(hours) * Number(t.rate));
    await prisma.consultantTimesheet.create({
      data: {
        orgId: tvgsOrg.id, workerName: t.name, role: t.role,
        projectId: project.id, workDate: t.date,
        hours, billable: t.billable ?? true,
        rateVndPerHour: t.rate, amountVnd: amount,
        description: t.desc,
      },
    });
    console.log(`  ✓ Timesheet ${t.date.toISOString().slice(0, 10)} ${t.name} ${t.hours}h`);
  }
  console.log("✅ ConsultantOps seeded");
}

main().finally(() => prisma.$disconnect());
