import { WaitlistForm } from "./waitlist";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Atlas AEC — module #1 — LIVE tại app.aecplatform.vn
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Hệ điều hành{" "}
          <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            xây dựng Việt Nam
          </span>
          <br />
          một module mỗi quý.
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-300">
          AEC Platform là tập hợp các sản phẩm SaaS gắn chặt nghị định Việt Nam — bắt đầu với{" "}
          <strong className="text-white">Atlas AEC</strong> (Atlassian-style PM), tiếp theo là Vendor, Cost,
          Compliance, Field. Mỗi module độc lập, đăng nhập chung, dữ liệu liền mạch.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="https://app.aecplatform.vn"
            className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Mở Atlas AEC →
          </a>
          <WaitlistForm />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Module Atlas AEC sẵn sàng. Vendor / Cost / Compliance / Field — đăng ký waitlist để được thông báo.
        </p>

        <div className="mt-16 grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
          {[
            { num: "1", label: "module LIVE", note: "Atlas AEC" },
            { num: "8", label: "Layer architecture", note: "core → GTM" },
            { num: "35+", label: "Prisma models", note: "VN-grounded schema" },
            { num: "0đ", label: "/tháng infra", note: "free-tier stack" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-5">
              <div className="text-3xl font-bold text-white">{s.num}</div>
              <div className="mt-1 text-xs font-medium text-slate-400">{s.label}</div>
              <div className="text-[11px] text-slate-500">{s.note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
