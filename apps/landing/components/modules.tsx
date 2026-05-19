const mods = [
  {
    atlas: "Site",
    jira: "Jira",
    desc: "Issues + RFI + Submittal + NCR + Punch + Change Order + Daily Log. Workflow gắn NĐ 06/2021.",
    icon: "🏗",
  },
  {
    atlas: "Models",
    jira: "Bitbucket",
    desc: "Tải lên IFC / Revit / Navisworks / DWG → xem qua Autodesk Forge Viewer. Versioning bản vẽ R0/R1/IFC.",
    icon: "🧱",
  },
  {
    atlas: "Specs",
    jira: "Confluence",
    desc: "Wiki dự án: hồ sơ thiết kế, biện pháp thi công, tham chiếu TCVN/QCVN.",
    icon: "📚",
  },
  {
    atlas: "Crews",
    jira: "Trello",
    desc: "Kanban look-ahead 1 tuần / 2 tuần. Phân công tổ đội, theo dõi tiến độ ca/ngày.",
    icon: "👷",
  },
  {
    atlas: "Catalog",
    jira: "Compass",
    desc: "Cấu kiện, vật tư, nhà cung cấp. Liên kết với Submittal & BoQ.",
    icon: "📦",
  },
  {
    atlas: "Handover",
    jira: "Jira SM",
    desc: "Service desk hậu bàn giao — bảo hành 12/24/60 tháng theo NĐ 06/2021.",
    icon: "🤝",
  },
  {
    atlas: "Portfolio",
    jira: "Align",
    desc: "Đa dự án — EVM, S-curve, dòng tiền, cảnh báo trễ tiến độ.",
    icon: "📊",
  },
  {
    atlas: "Site Status",
    jira: "Statuspage",
    desc: "Trang công khai tiến độ — CĐT / Ban QLDA / cổ đông xem real-time.",
    icon: "📡",
  },
];

export function Modules() {
  return (
    <section className="border-y border-slate-800 bg-slate-900/30 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">8 module, một workspace</h2>
          <p className="mt-3 text-slate-400">
            Mỗi công cụ Atlassian được tái thiết kế thành module AEC chuyên dụng.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {mods.map((m) => (
            <div
              key={m.atlas}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 transition hover:border-blue-500/40 hover:bg-slate-900"
            >
              <div className="text-2xl">{m.icon}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <h3 className="text-lg font-semibold text-white">{m.atlas}</h3>
                <span className="text-xs text-slate-500">← {m.jira}</span>
              </div>
              <p className="mt-1 text-sm text-slate-400">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
