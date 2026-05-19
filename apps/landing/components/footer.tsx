export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-600 text-sm font-bold text-white">A</div>
          <span className="text-sm font-semibold text-white">Atlas AEC</span>
          <span className="text-xs text-slate-500">© 2026</span>
        </div>
        <div className="flex gap-6 text-xs text-slate-500">
          <a href="#" className="hover:text-slate-200">Bảo mật</a>
          <a href="#" className="hover:text-slate-200">Điều khoản</a>
          <a href="#" className="hover:text-slate-200">Liên hệ</a>
        </div>
      </div>
    </footer>
  );
}
