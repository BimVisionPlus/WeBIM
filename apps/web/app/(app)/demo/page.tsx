/**
 * /demo — single-pane demo launchpad.
 *
 * Use this as the primary demo URL. Customers see everything-in-one-place:
 *   - Live KPI hero (real counts from prod DB)
 *   - One-click into all 16 module clusters
 *   - "Try AI now" panel (button → POST → show response inline)
 *   - Quick-jump to per-project flagship project
 *   - "What to demo first" guided sequence
 *
 * Server-rendered for instant content (no spinner on demo arrival).
 */

import { redirect } from "next/navigation";
import { prisma } from "@atlas/db";
import { getSession } from "@atlas/auth";
import { formatVnd } from "@atlas/lib";
import Link from "next/link";
import { DemoAiPanel } from "./DemoAiPanel";

export const dynamic = "force-dynamic";

const MODULES: Array<{ icon: string; group: string; name: string; href: string; tagline: string }> = [
  // Atlas Suite — roadmap 02→05 shipped
  { icon: "📦", group: "Atlas Suite (02→05)", name: "Atlas Vendor", href: "/vendor", tagline: "Supplier + thầu phụ · HĐ khung · Sổ công nợ" },
  { icon: "💰", group: "Atlas Suite (02→05)", name: "Atlas Cost", href: "/cost", tagline: "Định mức TT 10/2019 · EVM · ML cảnh báo overrun" },
  { icon: "✅", group: "Atlas Suite (02→05)", name: "Atlas Compliance", href: "/compliance", tagline: "TCVN/QCVN · PC07/Sở XD audit prep · AI score" },
  { icon: "📱", group: "Atlas Suite (02→05)", name: "Atlas Field", href: "/field", tagline: "PWA mobile · Voice-to-form · GPS check-in · Offline" },
  { icon: "🏛️", group: "Atlas Suite (02→05)", name: "Đơn vị (Business Units)", href: "/units", tagline: "Chi nhánh / Tổng đội / Ban điều hành" },
  // Đấu thầu
  { icon: "🎯", group: "Đấu thầu", name: "WinWork", href: "/winwork", tagline: "Pipeline bid + win-rate dashboard" },
  { icon: "📡", group: "Đấu thầu", name: "BidRadar", href: "/bidradar", tagline: "Quét cơ hội DauThauQuocGia + Báo Đấu thầu" },
  { icon: "🛠️", group: "Đấu thầu", name: "TenderForge", href: "/tenderforge", tagline: "Lập hồ sơ dự thầu — workflow ký TVTV → CĐT" },
  { icon: "🛡️", group: "Đấu thầu", name: "BondVault", href: "/bondvault", tagline: "Sổ bảo lãnh + cảnh báo sắp hết hạn" },
  // PT thị trường
  { icon: "🌱", group: "PTTT", name: "Leads", href: "/leads", tagline: "Pipeline cơ hội — Tiềm năng → Theo dõi → Trúng" },
  { icon: "🗺️", group: "PTTT", name: "Territories", href: "/territories", tagline: "Phân vùng địa bàn — owner-user trên từng tỉnh" },
  // Hành chính
  { icon: "📜", group: "Hành chính", name: "Văn bản nội bộ", href: "/internaldocs", tagline: "Sổ Quyết định / Thông báo / Quy chế" },
  { icon: "🆔", group: "Hành chính", name: "BHXH", href: "/bhxh", tagline: "Sổ bảo hiểm xã hội theo Luật BHXH" },
  { icon: "🚗", group: "Hành chính", name: "Điều phối xe", href: "/vehicledispatch", tagline: "Lệnh điều xe + lịch trực ban" },
  // Tài chính kế toán
  { icon: "💰", group: "TC-KT", name: "Tạm ứng & Thanh toán", href: "/advances", tagline: "Sổ tạm ứng/thanh toán + cảnh báo hoàn ứng" },
  { icon: "💸", group: "TC-KT", name: "PaymentRail", href: "/paymentrail", tagline: "Quy trình thanh toán theo VBHN 06/VBHN-BXD" },
  { icon: "📈", group: "TC-KT", name: "Cash Forecast", href: "/tckt/cash-forecast", tagline: "Dòng tiền 90 ngày tới" },
  // Thi công
  { icon: "📅", group: "Thi công", name: "Schedule", href: "/schedule", tagline: "Gantt + critical path (CPM)" },
  { icon: "📋", group: "Thi công", name: "DailyLog", href: "/dailylog", tagline: "Nhật ký công trình — voice-to-text" },
  { icon: "🔍", group: "Thi công", name: "Supervise", href: "/supervise", tagline: "Nhật ký giám sát" },
  { icon: "📐", group: "Thi công", name: "Methods", href: "/methods", tagline: "Biện pháp thi công — duyệt theo workflow" },
  { icon: "✅", group: "Thi công", name: "QA/QC", href: "/qaqc", tagline: "ITP + biên bản kiểm tra" },
  { icon: "🧪", group: "Thi công", name: "Lab Reports", href: "/labreports", tagline: "Kết quả thí nghiệm vật liệu" },
  { icon: "🧰", group: "Thi công", name: "Material Trace", href: "/materialtrace", tagline: "Truy xuất nguồn vật tư" },
  { icon: "📏", group: "Thi công", name: "Volume Meter", href: "/volumemeter", tagline: "Đo bóc khối lượng từ bản vẽ" },
  { icon: "📑", group: "Thi công", name: "Hoàn công", href: "/hoancong", tagline: "Hồ sơ hoàn công VIIIb — AI auto-draft" },
  // HSE + Reg
  { icon: "🪪", group: "HSE+Reg", name: "PermitFlow", href: "/permitflow", tagline: "GPXD — NĐ 15/2021 Phụ lục I" },
  { icon: "🔥", group: "HSE+Reg", name: "PCCC", href: "/pccc", tagline: "Thẩm duyệt + nghiệm thu PCCC" },
  { icon: "🌳", group: "HSE+Reg", name: "EIAFlow", href: "/eiaflow", tagline: "ĐTM môi trường" },
  { icon: "🦺", group: "HSE+Reg", name: "HSE Training", href: "/hsetrain", tagline: "Chứng chỉ ATLĐ 6 nhóm" },
  { icon: "🌡️", group: "HSE+Reg", name: "Monitor", href: "/monitor", tagline: "Quan trắc môi trường + tiếng ồn" },
  // BIM + AI
  { icon: "🏗️", group: "BIM+AI", name: "CodeGuard", href: "/codeguard", tagline: "AI duyệt bản vẽ vs QCVN" },
  { icon: "📷", group: "BIM+AI", name: "SiteEye", href: "/siteeye", tagline: "Camera AI — PPE + giám sát" },
  { icon: "💬", group: "BIM+AI", name: "DocChat", href: "/docchat", tagline: "Q&A hồ sơ — RAG bge-m3" },
  // Cross-project
  { icon: "📦", group: "Khác", name: "Catalog", href: "/catalog", tagline: "Catalog vật liệu + nhà cung cấp" },
  { icon: "📚", group: "Khác", name: "Định mức 10/2019", href: "/dinhmuc", tagline: "Tra cứu định mức Bộ XD" },
  { icon: "🏢", group: "Khác", name: "Contractor Registry", href: "/registry", tagline: "Sổ năng lực nhà thầu (NĐ 15/2021)" },
  { icon: "👤", group: "Khác", name: "Consultants", href: "/consult", tagline: "Hợp đồng tư vấn + timesheet" },
  { icon: "👥", group: "Khác", name: "Stakeholder Map", href: "/stakeholders", tagline: "Bản đồ các bên liên quan" },
  { icon: "🔔", group: "Khác", name: "Pulse", href: "/pulse", tagline: "Bảng tin tổng — risk banner" },
  { icon: "🌐", group: "Khác", name: "Portal CĐT", href: "/portal", tagline: "Cổng CĐT — sign + review" },
  // Compliance
  { icon: "📜", group: "Audit", name: "Audit Log", href: "/audit", tagline: "Toàn bộ AuditEvent — CSV export" },
  { icon: "🗄️", group: "Audit", name: "Archive", href: "/archive", tagline: "Bản ghi đã xoá mềm — khôi phục được" },
];

const AI_FEATURES: Array<{ icon: string; name: string; verb: string; what: string; tryUrl?: string }> = [
  { icon: "📊", name: "Weekly Digest", verb: "AI tóm tắt", what: "Tóm tắt 7 ngày qua mỗi phòng — Groq Llama 3.3", tryUrl: "/api/digest?dept=HANH_CHINH" },
  { icon: "🤖", name: "Classify công văn", verb: "AI phân loại", what: "OCR + phân loại Quyết định / Thông báo / Quy chế" },
  { icon: "🎙️", name: "Voice → Daily Log", verb: "AI phiên âm", what: "Whisper STT — chỉ huy trưởng nói, AI điền form" },
  { icon: "🔍", name: "Specs RAG", verb: "AI tìm spec", what: "bge-m3 cosine retrieval — semantic, không cần keyword" },
  { icon: "📑", name: "Hồ sơ hoàn công", verb: "AI soạn", what: "13 mục VIIIb tự động — cite VBHN 06/VBHN-BXD" },
  { icon: "⚠️", name: "Schedule Risk", verb: "AI cảnh báo", what: "Dự đoán slip % + giải thích bằng tiếng Việt" },
  { icon: "📐", name: "Submittal Checker", verb: "AI kiểm spec", what: "Đối chiếu vật liệu vs spec — flag mismatch" },
  { icon: "🎯", name: "Smart suggestion", verb: "AI gợi ý", what: "Trên StatusUpdate + InternalDocument" },
  { icon: "💸", name: "Cost Overrun Forecast", verb: "AI dự báo", what: "BAC/EV/AC/CPI/SPI/EAC — Llama đọc trend + đề xuất action" },
  { icon: "🛡️", name: "Compliance Check", verb: "AI đánh giá", what: "Per TCVN/QCVN: COMPLIANT / PARTIAL / NON_COMPLIANT + findings" },
  { icon: "🗣️", name: "Field Voice-to-Form", verb: "AI rút trích", what: "Whisper + Llama → 5 intent (DAILY_LOG/INCIDENT/NCR/PPE/PROGRESS)" },
];

export default async function DemoLaunchpad() {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/demo");

  // Live counts (no caching — show real platform pulse).
  const [
    projectCount, taskCount, ncrCount, paymentVnd, leadValue,
    workerCount, internalDocCount, rfiOpen, advanceOpen, handoverOpen,
    vendorActive, normCodes, complianceStds, openAuditPreps, businessUnits,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.scheduleTask.count(),
    prisma.nCR.count(),
    prisma.progressPayment.aggregate({ _sum: { workDoneVnd: true } }).then((r) => r._sum.workDoneVnd ?? BigInt(0)),
    prisma.projectLead.aggregate({ where: { status: { in: ["POTENTIAL", "TRACKING"] } }, _sum: { estValueVnd: true } }).then((r) => r._sum.estValueVnd ?? BigInt(0)),
    prisma.siteWorker.count(),
    prisma.internalDocument.count(),
    prisma.rFI.count({ where: { answer: null } }),
    prisma.advanceTransaction.count({ where: { status: { in: ["PENDING", "APPROVED"] } } }),
    prisma.handoverTicket.count({ where: { state: { notIn: ["VERIFIED", "CLOSED"] } } }),
    prisma.vendorContract.count({ where: { state: "ACTIVE" } }),
    prisma.normCode.count(),
    prisma.regulation.count({ where: { status: "IN_FORCE", kind: { in: ["TCVN", "QCVN"] } } }),
    prisma.auditPrep.count({ where: { state: { in: ["DRAFT", "IN_PROGRESS", "READY", "INSPECTING"] } } }),
    prisma.businessUnit.count({ where: { active: true } }),
  ]);

  // Pick the richest project to drill into
  const flagshipProject = await prisma.project.findFirst({
    where: { id: "cmpwimwi7000ajprqxnmgjeo3" },
    select: { id: true, key: true, name: true, ownerOrg: { select: { name: true } } },
  });

  // Find a CHANGE_ORDER for AI-workflow demo
  const co = await prisma.issue.findFirst({
    where: { projectId: flagshipProject?.id, type: "CHANGE_ORDER" },
    select: { id: true, key: true, state: true },
  });

  // Find a Submittal for AI-check demo
  const sub = await prisma.submittal.findFirst({
    where: { issue: { projectId: flagshipProject?.id } },
    select: { issueId: true, materialName: true },
  });

  // Find an at-risk schedule task
  const riskTask = await prisma.scheduleTask.findFirst({
    where: { projectId: flagshipProject?.id, state: "IN_PROGRESS", isCritical: true },
    select: { id: true, code: true, name: true },
    orderBy: { plannedEnd: "asc" },
  });

  const groups = Array.from(new Set(MODULES.map((m) => m.group)));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="border-b border-slate-200 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="text-xs uppercase tracking-wider text-blue-100">Demo launchpad · {flagshipProject?.ownerOrg.name ?? "Cofico"}</div>
          <h1 className="mt-1 text-3xl font-bold">Viwase Quản lý công việc</h1>
          <p className="mt-2 max-w-3xl text-sm text-blue-100">
            Atlassian-style cho ngành xây dựng VN. Gắn chặt NĐ 06/2021 · VBHN 06/VBHN-BXD · NĐ 15/2021 · NĐ 123/2020 · Luật BHXH. AI = Groq Llama + Cloudflare bge-m3 (OSS-only).
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            <Stat label="Dự án" value={projectCount.toString()} />
            <Stat label="Công việc Schedule" value={taskCount.toString()} />
            <Stat label="NCR ghi nhận" value={ncrCount.toString()} />
            <Stat label="NLĐ trên sổ" value={workerCount.toString()} />
            <Stat label="Văn bản nội bộ" value={internalDocCount.toString()} />
            <Stat label="Khối lượng thanh toán" value={formatVnd(paymentVnd)} />
            <Stat label="Pipeline đang theo" value={formatVnd(leadValue)} />
            <Stat label="RFI đang mở" value={rfiOpen.toString()} />
            <Stat label="Tạm ứng chưa hoàn" value={advanceOpen.toString()} />
            <Stat label="Bảo hành đang mở" value={handoverOpen.toString()} />
            <Stat label="HĐ vendor ACTIVE" value={vendorActive.toString()} />
            <Stat label="Định mức TT 10/2019" value={normCodes.toString()} />
            <Stat label="Tiêu chuẩn TCVN/QCVN" value={complianceStds.toString()} />
            <Stat label="Audit prep đang mở" value={openAuditPreps.toString()} />
            <Stat label="Đơn vị" value={businessUnits.toString()} />
          </div>
        </div>
      </div>

      {/* Try AI panel — client component for the interactive buttons */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h2 className="text-lg font-bold text-slate-900">🤖 Thử AI live (1 click)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mỗi nút gọi 1 API thật, trả kết quả tiếng Việt trong vài giây. Dùng dữ liệu thật của dự án {flagshipProject?.key}.
        </p>
        <div className="mt-4">
          <DemoAiPanel
            projectId={flagshipProject?.id ?? ""}
            projectKey={flagshipProject?.key ?? ""}
            taskId={riskTask?.id ?? null}
            taskLabel={riskTask ? `${riskTask.code} — ${riskTask.name}` : null}
            submittalId={sub?.issueId ?? null}
            submittalLabel={sub?.materialName ?? null}
          />
        </div>

        <h2 className="mt-10 text-lg font-bold text-slate-900">📍 Đi thẳng vào dự án flagship</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Tổng quan", href: `/projects/${flagshipProject?.id}` },
            { label: "Tình hình", href: `/projects/${flagshipProject?.id}/tinh-hinh` },
            { label: "Issues / RFI / NCR", href: `/projects/${flagshipProject?.id}/site/issues` },
            { label: "Crews Look-ahead", href: `/projects/${flagshipProject?.id}/crews` },
            { label: "Schedule", href: `/projects/${flagshipProject?.id}/site/issues` },
            { label: "CostPulse", href: `/projects/${flagshipProject?.id}/costpulse` },
            { label: "EVM", href: `/projects/${flagshipProject?.id}/evm` },
            { label: "DrawBridge BIM", href: `/projects/${flagshipProject?.id}/drawbridge` },
            { label: "SiteEye PPE", href: `/projects/${flagshipProject?.id}/siteeye` },
            { label: "Handover", href: `/projects/${flagshipProject?.id}/handover` },
            ...(co ? [{ label: `Lệnh đổi ${co.key} (${co.state})`, href: `/projects/${flagshipProject?.id}/site/issues/${co.key}` }] : []),
          ].map((b) => (
            <Link key={b.label} href={b.href} className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-500 hover:text-blue-700">
              {b.label} →
            </Link>
          ))}
        </div>

        <h2 className="mt-10 text-lg font-bold text-slate-900">🗂️ Tất cả module ({MODULES.length})</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mỗi card → click 1 lần để mở module. Phân nhóm theo phòng / domain.
        </p>
        {groups.map((g) => (
          <div key={g} className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{g}</div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {MODULES.filter((m) => m.group === g).map((m) => (
                <Link key={m.href} href={m.href} className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-blue-500 hover:shadow-sm">
                  <div className="text-2xl">{m.icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700">{m.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{m.tagline}</div>
                  </div>
                  <div className="text-slate-400 group-hover:text-blue-700">→</div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <h2 className="mt-10 text-lg font-bold text-slate-900">🧠 Tất cả tính năng AI ({AI_FEATURES.length})</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {AI_FEATURES.map((a) => (
            <div key={a.name} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-2">
                <div className="text-xl">{a.icon}</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="text-[11px] uppercase tracking-wider text-emerald-700">{a.verb}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{a.what}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <strong>Hạ tầng:</strong> Hetzner VPS · Neon Postgres (Singapore) · MinIO/S3 · Groq (Llama 3.3 70B + Llama 4 Scout + Whisper) · Cloudflare Workers AI (bge-m3) · Resend (email aecplatform.vn). Hỗ trợ on-prem Ollama 1 lệnh docker-compose.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/10 px-3 py-2 backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-wider text-blue-100">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-white">{value}</div>
    </div>
  );
}
