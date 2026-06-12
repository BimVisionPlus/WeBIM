import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@atlas/db";
import { requireProject } from "@atlas/auth";

// Quét chứng cứ — sweep deterministic (không AI) qua các bản ghi nền tảng trong
// cửa sổ thời gian của claim: nhật ký thi công, sổ TVGS, RFI/CO/NCR, BBNT,
// thời tiết xấu. Trả về ứng viên; người dùng chọn gắn vào hồ sơ.
// Đây chính là giá trị "nhật ký là xương sống chứng cứ" — NĐ 06/2021 Đ.10.

export type EvidenceCandidate = {
  kind: string;
  refTable: string;
  refId: string;
  title: string;
  capturedAt: string | null;
  excerpt: string | null;
  alreadyAttached: boolean;
};

const EXCERPT = (s: string | null | undefined, n = 160) =>
  s ? (s.length > n ? `${s.slice(0, n)}…` : s) : null;

export async function GET(_req: NextRequest, { params }: { params: { claimId: string } }) {
  try {
    const claim = await prisma.claim.findUnique({
      where: { id: params.claimId },
      include: { evidence: { select: { refTable: true, refId: true } } },
    });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireProject(claim.projectId);

    // Cửa sổ quét: period ± lề (trước 7 ngày — bối cảnh; sau 30 ngày — hệ quả).
    const DAY = 86_400_000;
    const from = claim.periodStart ? new Date(claim.periodStart.getTime() - 7 * DAY) : null;
    const to = claim.periodEnd ? new Date(claim.periodEnd.getTime() + 30 * DAY) : null;
    const range = (field: string) =>
      from || to ? { [field]: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {};

    const attached = new Set(claim.evidence.map((e) => `${e.refTable}:${e.refId}`));
    const mark = (c: Omit<EvidenceCandidate, "alreadyAttached">): EvidenceCandidate => ({
      ...c,
      alreadyAttached: attached.has(`${c.refTable}:${c.refId}`),
    });

    const [dailyLogs, superviseEntries, issues, acceptances, weather] = await Promise.all([
      prisma.dailyLog.findMany({
        where: { projectId: claim.projectId, ...range("date") },
        orderBy: { date: "asc" },
        take: 120,
        select: { id: true, date: true, weather: true, workDone: true, safetyNotes: true },
      }),
      prisma.superviseEntry.findMany({
        where: { projectId: claim.projectId, ...range("logDate") },
        orderBy: { logDate: "asc" },
        take: 120,
        select: { id: true, logDate: true, workItems: true, qualityNotes: true, state: true },
      }),
      prisma.issue.findMany({
        where: {
          projectId: claim.projectId,
          type: { in: ["RFI", "CHANGE_ORDER", "NCR"] },
          ...range("createdAt"),
        },
        orderBy: { createdAt: "asc" },
        take: 120,
        select: { id: true, key: true, type: true, title: true, createdAt: true, state: true },
      }),
      prisma.acceptance.findMany({
        where: { projectId: claim.projectId, ...(from || to ? { conductedAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}) },
        orderBy: { conductedAt: "asc" },
        take: 60,
        select: { id: true, code: true, title: true, conductedAt: true, state: true },
      }),
      prisma.weatherSnapshot.findMany({
        where: {
          projectId: claim.projectId,
          ...range("ts"),
          OR: [{ rainMmHr: { gte: 10 } }, { condition: { in: ["rain_heavy", "thunder", "storm"] } }],
        },
        orderBy: { ts: "asc" },
        take: 60,
        select: { id: true, ts: true, rainMmHr: true, windKph: true, condition: true },
      }),
    ]);

    const candidates: EvidenceCandidate[] = [
      ...dailyLogs.map((l) =>
        mark({
          kind: "DAILY_LOG",
          refTable: "DailyLog",
          refId: l.id,
          title: `Nhật ký thi công ${l.date.toISOString().slice(0, 10)}${l.weather ? ` — ${l.weather}` : ""}`,
          capturedAt: l.date.toISOString(),
          excerpt: EXCERPT(l.safetyNotes ? `${l.workDone} | ATLĐ: ${l.safetyNotes}` : l.workDone),
        }),
      ),
      ...superviseEntries.map((s) =>
        mark({
          kind: "SUPERVISE_ENTRY",
          refTable: "SuperviseEntry",
          refId: s.id,
          title: `Sổ TVGS ${s.logDate.toISOString().slice(0, 10)} (${s.state})`,
          capturedAt: s.logDate.toISOString(),
          excerpt: EXCERPT(s.qualityNotes ? `${s.workItems} | CL: ${s.qualityNotes}` : s.workItems),
        }),
      ),
      ...issues.map((i) =>
        mark({
          kind: i.type === "RFI" ? "RFI" : i.type === "CHANGE_ORDER" ? "CHANGE_ORDER" : "OTHER",
          refTable: "Issue",
          refId: i.id,
          title: `${i.key} [${i.type}] ${i.title} (${i.state})`,
          capturedAt: i.createdAt.toISOString(),
          excerpt: null,
        }),
      ),
      ...acceptances.map((a) =>
        mark({
          kind: "ACCEPTANCE",
          refTable: "Acceptance",
          refId: a.id,
          title: `${a.code} — ${a.title} (${a.state})`,
          capturedAt: a.conductedAt?.toISOString() ?? null,
          excerpt: null,
        }),
      ),
      ...weather.map((w) =>
        mark({
          kind: "WEATHER",
          refTable: "WeatherSnapshot",
          refId: w.id,
          title: `Thời tiết xấu ${w.ts.toISOString().slice(0, 10)}: ${w.condition ?? ""} mưa ${w.rainMmHr ?? "?"}mm/h, gió ${w.windKph ?? "?"}km/h`,
          capturedAt: w.ts.toISOString(),
          excerpt: null,
        }),
      ),
    ];

    return NextResponse.json({
      window: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      candidates,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
