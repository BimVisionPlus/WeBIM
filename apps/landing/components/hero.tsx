import { WaitlistForm } from "./waitlist";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.15),transparent_60%)]" />
      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
          Atlassian-style PM cho ngành Xây dựng — beta sắp ra mắt
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Procore quá đắt. Excel quá yếu.
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Atlas AEC — chuẩn xây dựng Việt Nam.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
          Tất cả công cụ Atlassian (Jira, Confluence, Bitbucket, Trello, Compass…) tái thiết kế cho
          AEC — RFI, Submittal, NCR, Punch list, BIM viewer, Nghiệm thu NĐ 06/2021, hồ sơ hoàn công tự động.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <WaitlistForm />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Không spam. 1 email duy nhất khi v1 sẵn sàng — dự kiến Q3/2026.
        </p>
      </div>
    </section>
  );
}
