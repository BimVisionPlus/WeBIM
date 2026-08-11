export function Footer() {
  return (
    <footer className="border-t border-[rgb(var(--inverse-bg))] bg-[rgb(var(--inverse-bg))] py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-[rgb(var(--inverse-ink))]">A</div>
              <span className="text-sm font-semibold text-[rgb(var(--inverse-ink))]">AEC Platform</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[rgb(var(--muted))]">
              Hệ điều hành SaaS cho ngành xây dựng Việt Nam. 1 đăng nhập, nhiều module.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted-2))]">Sản phẩm</div>
            <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
              <li><a href="https://app.aecplatform.vn" className="hover:text-[rgb(var(--inverse-ink))]">Atlas AEC · LIVE</a></li>
              <li><span className="text-[rgb(var(--muted))]">Atlas Vendor · Q4/2026</span></li>
              <li><span className="text-[rgb(var(--muted))]">Atlas Cost · Q1/2027</span></li>
              <li><span className="text-[rgb(var(--muted))]">Atlas Compliance · Q2/2027</span></li>
              <li><span className="text-[rgb(var(--muted))]">Atlas Field · Q3/2027</span></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted-2))]">Pháp lý</div>
            <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
              <li><a href="https://app.aecplatform.vn/terms" className="hover:text-[rgb(var(--inverse-ink))]">Điều khoản</a></li>
              <li><a href="https://app.aecplatform.vn/privacy" className="hover:text-[rgb(var(--inverse-ink))]">Bảo mật (NĐ 13/2023)</a></li>
              <li><a href="https://app.aecplatform.vn/trust" className="hover:text-[rgb(var(--inverse-ink))]">Trust · Model Cards</a></li>
              <li><a href="https://app.aecplatform.vn/pricing" className="hover:text-[rgb(var(--inverse-ink))]">Bảng giá</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--muted-2))]">Liên hệ</div>
            <ul className="mt-3 space-y-2 text-xs text-[rgb(var(--muted))]">
              <li>Email: <a href="mailto:hello@aecplatform.vn" className="hover:text-[rgb(var(--inverse-ink))]">hello@aecplatform.vn</a></li>
              <li>Hỗ trợ: <a href="mailto:support@aecplatform.vn" className="hover:text-[rgb(var(--inverse-ink))]">support@aecplatform.vn</a></li>
              <li>Thanh toán: <a href="mailto:billing@aecplatform.vn" className="hover:text-[rgb(var(--inverse-ink))]">billing@aecplatform.vn</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-[rgb(var(--inverse-bg))] pt-6 text-[11px] text-[rgb(var(--muted))] sm:flex-row">
          <div>© 2026 AEC Platform · CTCP đang đăng ký</div>
          <div className="font-mono">aecplatform.vn</div>
        </div>
      </div>
    </footer>
  );
}
