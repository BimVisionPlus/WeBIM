import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@atlas/auth";

export const dynamic = "force-dynamic";

export default async function PortfolioLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/portfolio");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-900">Atlas AEC</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900">ProjectPulse — Executive Portfolio</span>
            <span className="ml-auto flex items-center gap-3 text-xs">
              <Link href="/winwork" className="hover:text-slate-900">WinWork</Link>
              <Link href="/settings/team" className="hover:text-slate-900">Đội</Link>
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Bức tranh đa dự án · Risk heatmap (5 chiều) · Profitability · Tóm tắt AI
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
