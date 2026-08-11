import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[rgb(var(--surface))]">
      <header className="border-b border-[rgb(var(--line))]">
        <div className="mx-auto flex max-w-3xl items-center px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 font-bold text-[rgb(var(--inverse-ink))]">A</div>
            <span className="text-lg font-semibold">Atlas</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 prose prose-slate prose-headings:font-semibold prose-headings:text-[rgb(var(--ink))] prose-p:text-[rgb(var(--ink-2))] prose-li:text-[rgb(var(--ink-2))]">
        {children}
      </main>
    </div>
  );
}
