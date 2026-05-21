// Landing modules grid — shows BOTH product surfaces side by side:
//
//   1. Atlas AEC (suite ngang, Atlassian-clone)        13 mô-đun
//   2. aec-platform (PM dọc cho nhà thầu VN)           14 mô-đun
//                                                       ──────────
//                                                       27 mô-đun
//
// The two suites share an account + RBAC; same `app.aecplatform.vn`
// host backs both — Atlas modules live at the root, aec-platform PM
// modules under their own slugs (/winwork, /bidradar, …). Overlap on
// names like WinWork/CostPulse is intentional — Atlas calls it the
// "intelligence" lens (read-only feeds, market scoring), aec-platform
// calls it the "execution" lens (your own BoQ, your own bid response).

const APP = "https://app.aecplatform.vn";

const atlasModules = [
  {
    name: "Site",
    sub: "Jira",
    icon: "🏗",
    desc: "Issues + RFI + Submittal + NCR + Punch + Change Order + Daily Log. Workflow gắn NĐ 06/2021.",
    href: `${APP}/`,
  },
  {
    name: "Models",
    sub: "Bitbucket",
    icon: "🧱",
    desc: "Tải lên IFC / Revit / Navisworks / DWG. Versioning bản vẽ R0/R1/IFC. Forge Viewer khi APS bật.",
    href: `${APP}/`,
  },
  {
    name: "Specs",
    sub: "Confluence",
    icon: "📚",
    desc: "Wiki dự án: hồ sơ thiết kế, biện pháp thi công, tham chiếu TCVN/QCVN với embedding RAG bge-m3.",
    href: `${APP}/`,
  },
  {
    name: "Portfolio",
    sub: "Align",
    icon: "📊",
    desc: "Đa dự án — EVM, S-curve, 5-dim risk heatmap (cost · schedule · safety · quality · compliance).",
    href: `${APP}/portfolio`,
  },
  {
    name: "Site Status",
    sub: "Statuspage",
    icon: "📡",
    desc: "Trang công khai tiến độ — CĐT / Ban QLDA / cổ đông xem real-time, không cần đăng nhập.",
    href: `${APP}/status/VHGP-S9`,
  },
  {
    name: "WinWork",
    sub: "Bidding Intelligence",
    icon: "🎯",
    desc: "Scrape muasamcong.mpi.gov.vn + dauthau.asia. Bond tracker. 9-rule Luật ĐT 22/2023 compliance engine.",
    href: `${APP}/winwork`,
  },
  {
    name: "CodeGuard",
    sub: "TCVN/QCVN engine",
    icon: "⚖️",
    desc: "Thư viện 10+ TCVN/QCVN, machine-checkable rules. NĐ 15/2021 Phụ lục I — checklist hồ sơ chất lượng.",
    href: `${APP}/`,
  },
  {
    name: "DrawBridge",
    sub: "BIM Intelligence",
    icon: "🔗",
    desc: "BIM element registry. AABB clash detection cross-discipline. Link issue ↔ element để truy ngược.",
    href: `${APP}/`,
  },
  {
    name: "SiteEye",
    sub: "Computer Vision + Safety",
    icon: "👁",
    desc: "PPE detection (Qwen2.5-VL). Open-meteo weather alert. Incident report Luật ATVSLĐ 84/2015.",
    href: `${APP}/`,
  },
  {
    name: "CostPulse",
    sub: "Cost Intelligence",
    icon: "💰",
    desc: "BoQ tracking. EVM thật (BAC·EV·AC·CPI·SPI·EAC). Material price index Bộ XD. Subcontractor scoring.",
    href: `${APP}/`,
  },
  {
    name: "Crews",
    sub: "Trello",
    icon: "👷",
    desc: "Kanban look-ahead 1-2 tuần. Phân công tổ đội, theo dõi tiến độ ca/ngày, tích hợp Daily Log.",
    href: `${APP}/`,
  },
  {
    name: "Catalog",
    sub: "Compass",
    icon: "📦",
    desc: "Cấu kiện · vật tư · supplier registry. Link với Submittal & BoQ. Compare giá nhà cung cấp.",
    href: `${APP}/catalog`,
  },
  {
    name: "Handover",
    sub: "Jira SM",
    icon: "🛠",
    desc: "Service desk hậu bàn giao — bảo hành 12/24/60 tháng theo NĐ 06/2021. SLA + escalation matrix.",
    href: `${APP}/`,
  },
];

// aec-platform vertical PM modules — same Next.js app, dedicated slugs.
// Group taxonomy matches the lifecycle bar on aec-platform's own landing:
// Pháp lý → Thiết kế → Đấu thầu → Thi công → Bàn giao.
const aecPlatformModules = [
  {
    name: "WinWork",
    sub: "Đề xuất & Báo giá",
    icon: "📨",
    desc: "Soạn hồ sơ dự thầu — template HSDT (HSMT-22/2023), generate cover letter + BoQ markup từ template ngành.",
    href: `${APP}/winwork`,
    group: "Đấu thầu",
  },
  {
    name: "BidRadar",
    sub: "Săn gói thầu nhà nước",
    icon: "📡",
    desc: "Watchlist + alert email mỗi khi muasamcong.mpi.gov.vn / dauthau.asia có gói phù hợp NACE code của bạn.",
    href: `${APP}/bidradar`,
    group: "Đấu thầu",
  },
  {
    name: "CostPulse",
    sub: "Dự toán & RFQ vật tư",
    icon: "🧾",
    desc: "Dựng BoQ từ bản vẽ, gửi RFQ multi-supplier qua Zalo/email, scoring giá chào trên material price index.",
    href: `${APP}/costpulse`,
    group: "Đấu thầu",
  },
  {
    name: "DinhMucDB",
    sub: "Định mức + đơn giá",
    icon: "📒",
    desc: "TT 10/2019 (XD) + TT 11/2019 (máy) + đơn giá tỉnh × quý. Knowledge-as-data, API tra cứu cho CostPulse / VolumeMeter / TenderForge.",
    href: `${APP}/dinhmuc`,
    group: "Đấu thầu",
  },
  {
    name: "CodeGuard",
    sub: "Đối chiếu QCVN/TCVN",
    icon: "⚖️",
    desc: "Quét bản vẽ + hồ sơ thiết kế, đánh dấu vi phạm QCVN 06/QCVN 04/TCVN 5574. Báo cáo PDF tự sinh.",
    href: `${APP}/codeguard`,
    group: "Thiết kế",
  },
  {
    name: "Drawbridge",
    sub: "Q&A bản vẽ",
    icon: "💬",
    desc: "Comment ngay trên bản vẽ, thread Q&A giữa CĐT/TVTK/nhà thầu. Audit log thay đổi version R0→R1→IFC.",
    href: `${APP}/drawbridge`,
    group: "Thiết kế",
  },
  {
    name: "PermitFlow",
    sub: "Giấy phép xây dựng",
    icon: "📋",
    desc: "Checklist hồ sơ xin GPXD theo NĐ 15/2021 Phụ lục I. Generate đơn từ profile dự án. Track trạng thái sở XD.",
    href: `${APP}/permitflow`,
    group: "Pháp lý",
  },
  {
    name: "BondVault",
    sub: "Bảo lãnh hợp đồng",
    icon: "🏦",
    desc: "BLTHHĐ + BL Tạm ứng + BLBH. Sync API BIDV/VCB/Techcombank/MB. Alert T-30 expiry, auto-release theo NĐ 06/2021 (12/24/60 tháng).",
    href: `${APP}/bondvault`,
    group: "Pháp lý",
  },
  {
    name: "PCCC",
    sub: "Phòng cháy chữa cháy",
    icon: "🧯",
    desc: "Hồ sơ thẩm duyệt PCCC — NĐ 136/2020 + TCVN 5738. Sinh bản vẽ ký hiệu PCCC, biên bản nghiệm thu C06.",
    href: `${APP}/pccc`,
    group: "Pháp lý",
  },
  {
    name: "Tiến độ dự án",
    sub: "Gantt + đường găng",
    icon: "📅",
    desc: "Schedule Gantt, đường găng (CPM), AI rủi ro chậm tiến độ dựa trên daily log + weather forecast.",
    href: `${APP}/schedule`,
    group: "Thi công",
  },
  {
    name: "Pulse",
    sub: "Điều phối dự án",
    icon: "🚦",
    desc: "Dashboard điều hành — heatmap đội/ca/khu vực, escalation matrix khi NCR/safety event mở.",
    href: `${APP}/pulse`,
    group: "Thi công",
  },
  {
    name: "SiteEye",
    sub: "Giám sát công trường AI",
    icon: "👁",
    desc: "PPE detection từ CCTV/drone. Weather + air-quality alert. Sinh báo cáo ATVSLĐ Luật 84/2015 hằng tuần.",
    href: `${APP}/siteeye`,
    group: "Thi công",
  },
  {
    name: "Nhật ký",
    sub: "Báo cáo nhật trình",
    icon: "📝",
    desc: "Daily log mobile-first (offline-capable Capacitor). Mẫu nhật ký TT 26/2016. Voice-to-text Whisper.cpp.",
    href: `${APP}/dailylog`,
    group: "Thi công",
  },
  {
    name: "Lệnh thay đổi",
    sub: "Change order tracking",
    icon: "🔁",
    desc: "Phiếu phát sinh khối lượng — workflow CĐT → TVTK → nhà thầu → chấp thuận. Tự cộng vào EVM.",
    href: `${APP}/changeorder`,
    group: "Thi công",
  },
  {
    name: "PaymentRail",
    sub: "Hồ sơ thanh toán",
    icon: "💸",
    desc: "Đề nghị thanh toán theo NĐ 99/2021 + TT 08/2022. BBNT KL → Bảng tính giá trị → Phiếu giá → KBNN-DVC. Ký số chuỗi NT-TVGS-CĐT.",
    href: `${APP}/paymentrail`,
    group: "Thi công",
  },
  {
    name: "VolumeMeter",
    sub: "Bóc khối lượng QTO",
    icon: "📐",
    desc: "Bóc khối lượng theo TT 13/2021 — auto-takeoff IFC/Revit qua IfcOpenShell. So sánh 3 cột: dự toán ↔ thi công ↔ hoàn công.",
    href: `${APP}/volumemeter`,
    group: "Thi công",
  },
  {
    name: "Handover",
    sub: "Bàn giao + sổ tay vận hành",
    icon: "🛠",
    desc: "Hồ sơ bàn giao NĐ 06/2021 Phụ lục III. Service desk bảo hành 12/24/60 tháng + SLA leo thang.",
    href: `${APP}/handover`,
    group: "Bàn giao",
  },
  {
    name: "Punch list",
    sub: "Tồn đọng bàn giao",
    icon: "✅",
    desc: "Snag list — chấm điểm khiếm khuyết theo vị trí trên drawing/3D model. Đóng từng item với ảnh after.",
    href: `${APP}/punchlist`,
    group: "Bàn giao",
  },
];

export function Modules() {
  return (
    <section className="border-y border-slate-800 bg-slate-900/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section banner */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            <span className="font-mono">01</span> · Sản phẩm · LIVE
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            31 mô-đun chạy thực — 2 suite, 1 tài khoản
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Atlas AEC (suite ngang kiểu Atlassian) + aec-platform (PM dọc cho nhà
            thầu VN). Đăng nhập 1 lần, chuyển qua lại không reload.{" "}
            <span className="text-slate-300">Bấm vào card để mở thẳng.</span>
          </p>
        </div>

        {/* ─── Atlas AEC suite ─────────────────────────────────────── */}
        <div className="mt-16">
          <div className="flex items-baseline justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xl font-semibold text-white">
              Atlas AEC{" "}
              <span className="ml-2 text-sm font-normal text-slate-500">
                Suite ngang · 13 mô-đun
              </span>
            </h3>
            <span className="text-[11px] font-medium text-emerald-400">
              Atlassian-style
            </span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {atlasModules.map((m) => (
              <ModuleCard key={`atlas-${m.name}`} module={m} />
            ))}
          </div>
        </div>

        {/* ─── aec-platform PM suite ───────────────────────────────── */}
        <div className="mt-16">
          <div className="flex items-baseline justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xl font-semibold text-white">
              aec-platform{" "}
              <span className="ml-2 text-sm font-normal text-slate-500">
                PM dọc cho nhà thầu VN · 18 mô-đun
              </span>
            </h3>
            <span className="text-[11px] font-medium text-blue-400">
              Lifecycle: Pháp lý → Thiết kế → Đấu thầu → Thi công → Bàn giao
            </span>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {aecPlatformModules.map((m) => (
              <ModuleCard key={`aec-${m.name}`} module={m} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

type Module = {
  name: string;
  sub: string;
  icon: string;
  desc: string;
  href: string;
  group?: string;
};

function ModuleCard({ module: m }: { module: Module }) {
  return (
    <a
      href={m.href}
      className="group rounded-lg border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-0.5 hover:border-emerald-500/60 hover:bg-slate-900 hover:shadow-lg hover:shadow-emerald-500/5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-2xl">{m.icon}</div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
          <span className="h-1 w-1 rounded-full bg-emerald-400" />
          LIVE
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <h3 className="text-lg font-semibold text-white">{m.name}</h3>
        <span className="text-xs text-slate-500">· {m.sub}</span>
      </div>
      {m.group ? (
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-400">
          {m.group}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-slate-400">{m.desc}</p>
      <div className="mt-3 text-[11px] font-medium text-emerald-400 opacity-0 transition group-hover:opacity-100">
        Mở mô-đun →
      </div>
    </a>
  );
}
