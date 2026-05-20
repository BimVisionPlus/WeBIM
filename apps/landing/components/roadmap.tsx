const modules = [
  {
    n: "01",
    name: "Atlas AEC",
    tag: "PM — Workflow Engine",
    eta: "LIVE",
    status: "live",
    desc: "Atlassian-style cho thầu chính / TVGS / CĐT. RFI · Submittal · NCR · Punch · BBNT · BIM viewer · NĐ 06/2021 / NĐ 15/2021 / Luật ĐT 22/2023.",
    url: "https://app.aecplatform.vn",
    color: "from-blue-500 to-cyan-400",
  },
  {
    n: "02",
    name: "Atlas Vendor",
    tag: "Supplier · Subcontractor",
    eta: "Q4 / 2026",
    status: "next",
    desc: "Quản lý nhà cung cấp vật tư + nhà thầu phụ. Đánh giá hiệu suất, lịch sử công nợ, hợp đồng khung, chỉ số giá vật liệu Bộ XD theo tỉnh.",
    color: "from-emerald-500 to-teal-400",
  },
  {
    n: "03",
    name: "Atlas Cost",
    tag: "Định mức 10/2019 · EVM · ML",
    eta: "Q1 / 2027",
    status: "planning",
    desc: "Lập dự toán theo định mức 10/2019 / TT 13/2021. Theo dõi BoQ + EVM real-time. ML cảnh báo cost overrun 2–4 tuần trước (mô hình OSS).",
    color: "from-amber-500 to-orange-400",
  },
  {
    n: "04",
    name: "Atlas Compliance",
    tag: "TCVN/QCVN · PCCC · Sở XD",
    eta: "Q2 / 2027",
    status: "planning",
    desc: "Compliance engine cho TCVN 5574 / 2737, QCVN 06 PCCC, QCVN 04 chung cư. Audit prep cho PC07 + Sở Xây dựng. Tự sinh hồ sơ hoàn công.",
    color: "from-rose-500 to-pink-400",
  },
  {
    n: "05",
    name: "Atlas Field",
    tag: "Mobile-first · Offline · Voice",
    eta: "Q3 / 2027",
    status: "planning",
    desc: "App iOS / Android cho công nhân hiện trường. Voice-to-form bằng tiếng Việt, offline-first, geo-fence, chấm công sinh trắc, báo cáo 1-tap.",
    color: "from-violet-500 to-fuchsia-400",
  },
];

export function Roadmap() {
  return (
    <section className="border-t border-slate-800 bg-slate-950 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            Roadmap 18 tháng
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            5 module · ngôn ngữ chung · đăng nhập 1 lần
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-400">
            Mỗi module là 1 SaaS độc lập, có thể dùng riêng. Nhưng dữ liệu chia sẻ: 1 dự án Atlas AEC tự
            xuất BoQ sang Atlas Cost, tự pull subcontractor score từ Atlas Vendor, tự check QCVN qua
            Atlas Compliance. Đăng nhập 1 tài khoản, dùng cả 5.
          </p>
        </div>

        <ol className="mt-12 grid gap-4">
          {modules.map((m) => (
            <li
              key={m.n}
              className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-700"
            >
              <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${m.color}`} />
              <div className="grid gap-4 sm:grid-cols-[80px_1fr_140px] sm:items-center">
                <div className="font-mono text-3xl font-bold text-slate-700">{m.n}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold text-white">{m.name}</h3>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                      {m.tag}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{m.desc}</p>
                </div>
                <div className="text-right">
                  {m.status === "live" ? (
                    <a
                      href={m.url}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-900" />
                      {m.eta} →
                    </a>
                  ) : m.status === "next" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-300">
                      {m.eta}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-500">
                      {m.eta}
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-center text-sm text-slate-500">
          Roadmap có thể dịch chuyển. Cập nhật trên trang này khi launch từng module.
        </p>
      </div>
    </section>
  );
}
