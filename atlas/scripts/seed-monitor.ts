import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst({ where: { key: "VHGP-S9" } });
  if (!project) { console.error("Project not found"); process.exit(1); }

  const points = [
    { code: "SET-A-001", type: "SETTLEMENT", desc: "Dấu lún trục A-1 mặt đất nền", unit: "mm", warn: "8.0", alert: "15.0", values: [{ d: 30, v: 2.1 }, { d: 20, v: 4.2 }, { d: 10, v: 5.8 }, { d: 1, v: 6.5 }] },
    { code: "SET-A-002", type: "SETTLEMENT", desc: "Dấu lún trục A-5", unit: "mm", warn: "8.0", alert: "15.0", values: [{ d: 30, v: 1.5 }, { d: 20, v: 2.8 }, { d: 10, v: 4.1 }, { d: 1, v: 5.0 }] },
    { code: "SET-B-003", type: "SETTLEMENT", desc: "Dấu lún trục B-3 — gần dân cư", unit: "mm", warn: "8.0", alert: "15.0", values: [{ d: 30, v: 3.2 }, { d: 20, v: 6.1 }, { d: 10, v: 8.4 }, { d: 1, v: 9.2 }] }, // WARN
    { code: "SET-C-004", type: "SETTLEMENT", desc: "Dấu lún trục C-7", unit: "mm", warn: "8.0", alert: "15.0", values: [{ d: 30, v: 4.5 }, { d: 20, v: 9.8 }, { d: 10, v: 14.2 }, { d: 1, v: 16.8 }] }, // ALERT!
    { code: "INC-A-1", type: "TILT", desc: "Inclinometer cừ Larssen vách hố móng", unit: "°", warn: "0.50", alert: "1.00", values: [{ d: 30, v: 0.08 }, { d: 20, v: 0.14 }, { d: 10, v: 0.22 }, { d: 1, v: 0.31 }] },
    { code: "INC-A-2", type: "TILT", desc: "Inclinometer vách hố móng phía Bắc", unit: "°", warn: "0.50", alert: "1.00", values: [{ d: 30, v: 0.12 }, { d: 20, v: 0.28 }, { d: 10, v: 0.48 }, { d: 1, v: 0.62 }] }, // WARN
    { code: "PIEZ-1", type: "PIEZOMETER", desc: "Piezometer độ sâu -8m, gần vách hố móng", unit: "m H2O", warn: "4.0", alert: "5.5", values: [{ d: 30, v: 2.1 }, { d: 20, v: 2.4 }, { d: 10, v: 2.8 }, { d: 1, v: 3.2 }] },
    { code: "PIEZ-2", type: "PIEZOMETER", desc: "Piezometer độ sâu -12m", unit: "m H2O", warn: "4.0", alert: "5.5", values: [{ d: 30, v: 3.8 }, { d: 20, v: 4.2 }, { d: 10, v: 4.5 }, { d: 1, v: 4.6 }] }, // WARN
    { code: "CRACK-NEIGH-1", type: "CRACK", desc: "Crack meter nhà dân lân cận - tường trục Bắc", unit: "mm", warn: "1.5", alert: "3.0", values: [{ d: 30, v: 0.42 }, { d: 20, v: 0.58 }, { d: 10, v: 0.81 }, { d: 1, v: 0.95 }] },
    { code: "TEMP-DAI-A", type: "TEMPERATURE", desc: "Nhiệt độ BT khối đài cọc khối A", unit: "°C", warn: "60.0", alert: "65.0", values: [{ d: 5, v: 38.0 }, { d: 3, v: 52.0 }, { d: 2, v: 58.0 }, { d: 1, v: 54.0 }] },
  ];

  for (const p of points) {
    const point = await prisma.monitorPoint.upsert({
      where: { projectId_pointCode: { projectId: project.id, pointCode: p.code } },
      create: {
        projectId: project.id,
        pointCode: p.code,
        monitorType: p.type as never,
        description: p.desc,
        unit: p.unit,
        thresholdWarn: new Prisma.Decimal(p.warn),
        thresholdAlert: new Prisma.Decimal(p.alert),
        installedAt: new Date("2026-01-20"),
      },
      update: {},
    });

    let prevValue = 0;
    let cumulative = 0;
    for (const m of p.values.reverse()) { // earliest first
      const value = m.v;
      cumulative = value;
      const measuredAt = new Date(Date.now() - m.d * 86400000);
      const exceeded = value >= Number(p.alert);
      const warning = !exceeded && value >= Number(p.warn);
      const alertLevel = exceeded ? "ALERT" : warning ? "WARN" : "NORMAL";
      await prisma.monitorMeasurement.create({
        data: {
          pointId: point.id,
          measuredAt,
          value: new Prisma.Decimal(value.toString()),
          cumulative: new Prisma.Decimal(cumulative.toString()),
          rate24h: new Prisma.Decimal((value - prevValue).toString()),
          alertLevel: alertLevel as never,
        },
      });
      prevValue = value;
    }
    console.log(`  ✓ ${p.code} ${p.type} - ${p.values.length} measurements (last=${p.values[p.values.length - 1].v}${p.unit})`);
  }
  console.log("✅ MonitorWatch seeded");
}

main().finally(() => prisma.$disconnect());
