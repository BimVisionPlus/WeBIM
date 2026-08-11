/**
 * Self-serve "Get your own demo sandbox" page.
 *
 * Public, no auth. User fills form → POST /api/tenant/provision →
 * redirect to <slug>.aecplatform.vn.
 */
import { StartForm } from "./StartForm";

export const metadata = {
  title: "Bắt đầu sandbox riêng — Atlas",
  description: "Tạo sandbox riêng tại <công-ty>.aecplatform.vn với 5 dự án mẫu, 38 module, 11 AI feature. Miễn phí 14 ngày, không cần thẻ.",
};

export default function StartPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[rgb(var(--inverse-bg))] via-[rgb(var(--inverse-bg))] to-blue-900 text-[rgb(var(--inverse-ink))]">
      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-12 md:py-20">
        {/* Hero */}
        <div className="text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-blue-300">
            Sandbox riêng · Miễn phí 14 ngày · Không cần thẻ
          </div>
          <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
            Tự nghịch Atlas với <span className="text-blue-300">dữ liệu của riêng bạn</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[rgb(var(--inverse-ink))] md:text-lg">
            Sandbox 5 dự án mẫu sẵn 384 dòng BoQ, 969 issue, AI tóm tắt / dự đoán / hồ sơ hoàn công.
            URL riêng <code className="rounded bg-[rgb(var(--inverse-bg))] px-1.5 py-0.5 text-blue-300">&lt;công-ty&gt;.aecplatform.vn</code>.
            Bạn là OWNER toàn quyền chỉnh sửa.
          </p>
        </div>

        {/* Form */}
        <div className="mt-10 w-full max-w-2xl rounded-2xl bg-[rgb(var(--surface))] p-6 text-[rgb(var(--ink))] shadow-2xl md:p-8">
          <StartForm />
        </div>

        {/* Feature strip */}
        <div className="mt-10 grid w-full grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div className="rounded-lg bg-[rgb(var(--surface))]/5 p-4 backdrop-blur">
            <div className="text-2xl">⚡</div>
            <div className="mt-2 font-semibold">Sẵn trong 30s</div>
            <div className="mt-0.5 text-xs text-[rgb(var(--inverse-ink))]">Provisioning ngay khi bấm tạo</div>
          </div>
          <div className="rounded-lg bg-[rgb(var(--surface))]/5 p-4 backdrop-blur">
            <div className="text-2xl">🇻🇳</div>
            <div className="mt-2 font-semibold">100% tiếng Việt</div>
            <div className="mt-0.5 text-xs text-[rgb(var(--inverse-ink))]">VBHN 06/VBHN-BXD · NĐ 06/2021 · TCVN/QCVN</div>
          </div>
          <div className="rounded-lg bg-[rgb(var(--surface))]/5 p-4 backdrop-blur">
            <div className="text-2xl">🤖</div>
            <div className="mt-2 font-semibold">11 AI features</div>
            <div className="mt-0.5 text-xs text-[rgb(var(--inverse-ink))]">Voice-to-form · Hồ sơ hoàn công · Cost overrun</div>
          </div>
          <div className="rounded-lg bg-[rgb(var(--surface))]/5 p-4 backdrop-blur">
            <div className="text-2xl">🔐</div>
            <div className="mt-2 font-semibold">Cô lập hoàn toàn</div>
            <div className="mt-0.5 text-xs text-[rgb(var(--inverse-ink))]">Subdomain riêng, không thấy dữ liệu khách khác</div>
          </div>
        </div>

        <p className="mt-8 max-w-2xl text-center text-xs text-[rgb(var(--muted-2))]">
          Sau 14 ngày sandbox tự đóng. Upgrade lên Pro tier để giữ dữ liệu + thêm seat — xem <a href="https://app.aecplatform.vn/pricing" className="text-blue-300 underline">/pricing</a>.
        </p>
      </div>
    </div>
  );
}
