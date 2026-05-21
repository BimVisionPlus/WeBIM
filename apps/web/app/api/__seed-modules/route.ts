/**
 * One-shot seeder for the 3 NEW module tables (ScheduleTask, PermitApplication,
 * PcccApplication). Used because the operator's local machine couldn't reach
 * Neon's 5432 to run `pnpm db:seed` — but Vercel's runtime can.
 *
 * Idempotent: wipes the 3 tables before reseeding, scoped to project key
 * VHGP-S9 only. Authenticated by a shared secret header — KEEP THIS BEHIND
 * AN ENV-GATED FLAG once seed data is loaded.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";

export async function POST(req: NextRequest) {
  // Hard refusal unless ALLOW_MODULE_SEED is set — prevents accidental wipe
  if (process.env.ALLOW_MODULE_SEED !== "yes") {
    return NextResponse.json(
      { error: "Module seed endpoint disabled. Set ALLOW_MODULE_SEED=yes to enable." },
      { status: 403 },
    );
  }
  // Shared secret guard — pick anything you can pass in header for the curl call
  const provided = req.headers.get("x-seed-secret");
  if (!provided || provided !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Bad or missing x-seed-secret" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { key: "VHGP-S9" } });
  if (!project) {
    return NextResponse.json({ error: "Demo project VHGP-S9 not found — run main seed first" }, { status: 404 });
  }

  // Wipe scoped to this project for the 3 new tables
  await prisma.scheduleDependency.deleteMany({
    where: { OR: [{ predecessor: { projectId: project.id } }, { successor: { projectId: project.id } }] },
  });
  await prisma.scheduleTask.deleteMany({ where: { projectId: project.id } });
  await prisma.permitChecklist.deleteMany({ where: { application: { projectId: project.id } } });
  await prisma.permitApplication.deleteMany({ where: { projectId: project.id } });
  await prisma.pcccApplication.deleteMany({ where: { projectId: project.id } });

  const dPlus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

  // ── Schedule: 12 tasks · 3 on critical path ─────────────────────────────
  await prisma.scheduleTask.createMany({
    data: [
      { projectId: project.id, code: "T1.1", name: "Hoàn thành ép cọc móng",        discipline: "Phần ngầm", zone: "Tầng hầm B2", plannedStart: dPlus(-30), plannedEnd: dPlus(-15), actualStart: dPlus(-30), actualEnd: dPlus(-14), pctComplete: 100, state: "DONE",        isCritical: true },
      { projectId: project.id, code: "T1.2", name: "Đổ bê tông móng + đài",         discipline: "Phần ngầm", zone: "Tầng hầm B2", plannedStart: dPlus(-14), plannedEnd: dPlus(0),   actualStart: dPlus(-14), pctComplete: 92,  state: "IN_PROGRESS", isCritical: true },
      { projectId: project.id, code: "T2.1", name: "Thi công khung BT cốt thép T1-T5", discipline: "Kết cấu", zone: "Khu A", plannedStart: dPlus(-5),  plannedEnd: dPlus(20),  actualStart: dPlus(-3),  pctComplete: 35,  state: "IN_PROGRESS", isCritical: true },
      { projectId: project.id, code: "T2.2", name: "Thi công khung BT T6-T12",         discipline: "Kết cấu", zone: "Khu A", plannedStart: dPlus(15), plannedEnd: dPlus(60),  pctComplete: 0,   state: "PLANNED",      isCritical: true },
      { projectId: project.id, code: "T2.3", name: "Thi công khung BT T13-mái",        discipline: "Kết cấu", zone: "Khu A", plannedStart: dPlus(55), plannedEnd: dPlus(95),  pctComplete: 0,   state: "PLANNED",      isCritical: true },
      { projectId: project.id, code: "T3.1", name: "Lắp đặt HVAC chính",                discipline: "MEP",     zone: "Toàn nhà", plannedStart: dPlus(40), plannedEnd: dPlus(110), pctComplete: 0,   state: "PLANNED" },
      { projectId: project.id, code: "T3.2", name: "Đi đường điện thân trục đứng",     discipline: "MEP",     zone: "Trục thang máy", plannedStart: dPlus(35), plannedEnd: dPlus(100), pctComplete: 0,   state: "PLANNED" },
      { projectId: project.id, code: "T3.3", name: "Lắp đặt hệ thống PCCC sprinkler",  discipline: "MEP",     zone: "Toàn nhà", plannedStart: dPlus(45), plannedEnd: dPlus(115), pctComplete: 0,   state: "PLANNED" },
      { projectId: project.id, code: "T4.1", name: "Xây tường ngăn căn hộ T1-T5",      discipline: "Hoàn thiện", zone: "Khu A T1-T5", plannedStart: dPlus(25),  plannedEnd: dPlus(50),  pctComplete: 0, state: "PLANNED" },
      { projectId: project.id, code: "T4.2", name: "Trát + sơn lót T1-T5",              discipline: "Hoàn thiện", zone: "Khu A T1-T5", plannedStart: dPlus(50),  plannedEnd: dPlus(75),  pctComplete: 0, state: "PLANNED" },
      { projectId: project.id, code: "T4.3", name: "Lát gạch + hoàn thiện sơn căn hộ",  discipline: "Hoàn thiện", zone: "Khu A T1-T12", plannedStart: dPlus(80),  plannedEnd: dPlus(140), pctComplete: 0, state: "PLANNED" },
      { projectId: project.id, code: "T5.1", name: "Nghiệm thu + bàn giao",             discipline: "Bàn giao",   zone: "Toàn nhà", plannedStart: dPlus(150), plannedEnd: dPlus(165), pctComplete: 0, state: "PLANNED",      isCritical: true },
    ],
  });

  // ── Permit: 2 applications ──────────────────────────────────────────────
  const permit1 = await prisma.permitApplication.create({
    data: {
      projectId: project.id,
      permitType: "GPXD_MOI",
      applicationCode: "GPXD-2025-S9-0042",
      applicant: "Vinhomes JSC",
      submittedAt: dPlus(-90), receivedAt: dPlus(-88),
      decisionAt: dPlus(-60), decision: "APPROVED",
      decisionNote: "Phê duyệt GPXD 24 tầng — Sở XD TP.HCM Quyết định số 0042/QĐ-SXD",
      expiresAt: dPlus(720), state: "APPROVED",
    },
  });
  await prisma.permitChecklist.createMany({
    data: [
      { applicationId: permit1.id, itemCode: "PL-I.A.1", itemTitle: "Đơn đề nghị cấp GPXD (Mẫu 01)",      attached: true,  evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/donxin.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.2", itemTitle: "Bản sao GCN quyền sử dụng đất",      attached: true,  evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/gcndat.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.3", itemTitle: "Bản vẽ tổng mặt bằng",                 attached: true,  evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/totalplan.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.4", itemTitle: "Bản vẽ kiến trúc — mặt đứng/cắt",      attached: true,  evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/kientruc.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.5", itemTitle: "Bản vẽ kết cấu — móng + khung",         attached: true,  evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/ketcau.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.6", itemTitle: "Bản vẽ M&E (điện · nước · HVAC · PCCC)", attached: true, evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/me.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.7", itemTitle: "Thẩm duyệt PCCC (NĐ 136/2020)",         attached: true,  evidenceUrl: "s3://atlas-aec/permits/VHGP-S9/pccc.pdf" },
      { applicationId: permit1.id, itemCode: "PL-I.A.8", itemTitle: "Báo cáo ĐTM (nếu thuộc danh mục)",       attached: false },
    ],
  });

  const permit2 = await prisma.permitApplication.create({
    data: {
      projectId: project.id,
      permitType: "GPXD_DIEU_CHINH",
      applicationCode: "GPXD-DC-2026-S9-0011",
      applicant: "Vinhomes JSC",
      submittedAt: dPlus(-10), receivedAt: dPlus(-8),
      decision: "PENDING", state: "REVIEWING",
    },
  });
  await prisma.permitChecklist.createMany({
    data: [
      { applicationId: permit2.id, itemCode: "PL-DC.1", itemTitle: "Đơn xin điều chỉnh GPXD",          attached: true  },
      { applicationId: permit2.id, itemCode: "PL-DC.2", itemTitle: "Hồ sơ thiết kế điều chỉnh (kiến trúc + kết cấu)", attached: true  },
      { applicationId: permit2.id, itemCode: "PL-DC.3", itemTitle: "Văn bản chấp thuận của CĐT cho điều chỉnh", attached: false },
      { applicationId: permit2.id, itemCode: "PL-DC.4", itemTitle: "Bản sao GPXD cũ",                    attached: true  },
    ],
  });

  // ── PCCC: 2 applications ────────────────────────────────────────────────
  await prisma.pcccApplication.createMany({
    data: [
      {
        projectId: project.id, stage: "THAM_DUYET_THIET_KE",
        applicationCode: "PCCC-TD-2025-0089",
        submittedAt: dPlus(-100), decisionAt: dPlus(-75), decision: "APPROVED",
        decisionNote: "Phê duyệt thiết kế PCCC 24 tầng — PC07 Công an TP.HCM CV-0089",
        state: "APPROVED",
      },
      {
        projectId: project.id, stage: "NGHIEM_THU_PCCC",
        applicationCode: "PCCC-NT-2026-0023",
        submittedAt: dPlus(-3), decision: "PENDING", state: "REVIEWING",
      },
    ],
  });

  const counts = {
    scheduleTasks: await prisma.scheduleTask.count({ where: { projectId: project.id } }),
    permitApplications: await prisma.permitApplication.count({ where: { projectId: project.id } }),
    permitChecklist: await prisma.permitChecklist.count({ where: { application: { projectId: project.id } } }),
    pcccApplications: await prisma.pcccApplication.count({ where: { projectId: project.id } }),
  };

  return NextResponse.json({ ok: true, project: project.key, counts });
}
