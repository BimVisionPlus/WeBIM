import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[rgb(var(--raised))]">
      <header className="border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
        <div className="mx-auto flex max-w-7xl items-center px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 font-bold text-[rgb(var(--inverse-ink))]">A</div>
            <span className="text-lg font-semibold">Atlas</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-md px-6 pb-10 text-center text-xs text-[rgb(var(--muted-2))]">
        <Link href="/terms" className="hover:text-[rgb(var(--muted))]">Điều khoản</Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:text-[rgb(var(--muted))]">Bảo mật</Link>
      </footer>
    </div>
  );
}
