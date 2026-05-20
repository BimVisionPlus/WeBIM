export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 sm:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white">A</div>
              <span className="text-sm font-semibold text-white">AEC Platform</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Hệ điều hành SaaS cho ngành xây dựng Việt Nam. 1 đăng nhập, nhiều module.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sản phẩm</div>
            <ul className="mt-3 space-y-2 text-xs text-slate-500">
              <li><a href="https://app.aecplatform.vn" className="hover:text-slate-200">Atlas AEC · LIVE</a></li>
              <li><span className="text-slate-600">Atlas Vendor · Q4/2026</span></li>
              <li><span className="text-slate-600">Atlas Cost · Q1/2027</span></li>
              <li><span className="text-slate-600">Atlas Compliance · Q2/2027</span></li>
              <li><span className="text-slate-600">Atlas Field · Q3/2027</span></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pháp lý</div>
            <ul className="mt-3 space-y-2 text-xs text-slate-500">
              <li><a href="https://app.aecplatform.vn/terms" className="hover:text-slate-200">Điều khoản</a></li>
              <li><a href="https://app.aecplatform.vn/privacy" className="hover:text-slate-200">Bảo mật (NĐ 13/2023)</a></li>
              <li><a href="https://app.aecplatform.vn/trust" className="hover:text-slate-200">Trust · Model Cards</a></li>
              <li><a href="https://app.aecplatform.vn/pricing" className="hover:text-slate-200">Bảng giá</a></li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Liên hệ</div>
            <ul className="mt-3 space-y-2 text-xs text-slate-500">
              <li>Email: <a href="mailto:hello@aecplatform.vn" className="hover:text-slate-200">hello@aecplatform.vn</a></li>
              <li>Hỗ trợ: <a href="mailto:support@aecplatform.vn" className="hover:text-slate-200">support@aecplatform.vn</a></li>
              <li>Thanh toán: <a href="mailto:billing@aecplatform.vn" className="hover:text-slate-200">billing@aecplatform.vn</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-slate-900 pt-6 text-[11px] text-slate-600 sm:flex-row">
          <div>© 2026 AEC Platform · CTCP đang đăng ký</div>
          <div className="font-mono">aecplatform.vn</div>
        </div>
      </div>
    </footer>
  );
}
