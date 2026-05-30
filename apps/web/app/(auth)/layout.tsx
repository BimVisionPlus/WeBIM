import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 font-bold text-white">A</div>
            <span className="text-lg font-semibold">Viwase Quản lý công việc</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-md px-6 pb-10 text-center text-xs text-slate-400">
        <Link href="/terms" className="hover:text-slate-600">Điều khoản</Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-slate-600">Bảo mật</Link>
      </footer>
    </div>
  );
}
