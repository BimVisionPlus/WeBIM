const APP = "https://app.aecplatform.vn";

const liveModules = [
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

export function Modules() {
  return (
    <section className="border-y border-slate-800 bg-slate-900/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            <span className="font-mono">01</span> · Atlas AEC · LIVE
          </div>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            Atlas AEC · 13 mô-đun đang chạy
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">
            Mỗi mô-đun một trang riêng, dùng chung audit log + RBAC. Đăng nhập 1 lần,
            chuyển qua lại trong sidebar không reload. <span className="text-slate-300">Bấm vào card để mở thẳng.</span>
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {liveModules.map((m) => (
            <a
              key={m.name}
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
              <p className="mt-1 text-sm text-slate-400">{m.desc}</p>
              <div className="mt-3 text-[11px] font-medium text-emerald-400 opacity-0 transition group-hover:opacity-100">
                Mở mô-đun →
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
