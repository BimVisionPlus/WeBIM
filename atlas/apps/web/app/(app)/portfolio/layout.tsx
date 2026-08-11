import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@atlas/auth";

export const dynamic = "force-dynamic";

export default async function PortfolioLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/portfolio");

  return (
    <div className="min-h-screen bg-[rgb(var(--raised))]">
      <header className="border-b border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3 text-sm text-[rgb(var(--muted))]">
            <a href="https://aecplatform.vn" className="hover:text-[rgb(var(--ink))]">AEC Platform</a>
            <span>/</span>
            <Link href="/" className="hover:text-[rgb(var(--ink))]">Atlas</Link>
            <span>/</span>
            <span className="font-semibold text-[rgb(var(--ink))]">ProjectPulse — Executive Portfolio</span>
            <span className="ml-auto flex items-center gap-3 text-xs">
              <Link href="/winwork" className="hover:text-[rgb(var(--ink))]">WinWork</Link>
              <Link href="/settings/team" className="hover:text-[rgb(var(--ink))]">Đội</Link>
            </span>
          </div>
          <div className="mt-1 text-xs text-[rgb(var(--muted))]">
            Bức tranh đa dự án · Risk heatmap (5 chiều) · Profitability · Tóm tắt AI
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
