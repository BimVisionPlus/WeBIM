import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@atlas/auth";
import { prisma } from "@atlas/db";
import { WinWorkNav } from "@/components/winwork-nav";

export const dynamic = "force-dynamic";

export default async function WinWorkLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/winwork");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { org: { select: { id: true, name: true, slug: true } } },
  });
  if (memberships.length === 0) redirect("/onboarding/org");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <a href="https://aecplatform.vn" className="hover:text-slate-900">AEC Platform</a>
            <span>/</span>
            <Link href="/" className="hover:text-slate-900">Atlas AEC</Link>
            <span>/</span>
            <span className="font-semibold text-slate-900">WinWork — Bidding Intelligence</span>
            <span className="ml-auto flex items-center gap-3 text-xs">
              <Link href="/settings/team" className="hover:text-slate-900">Đội</Link>
              <Link href="/settings/ai" className="hover:text-slate-900">AI</Link>
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Cơ hội đấu thầu · Hồ sơ dự thầu · Bảo lãnh · Tuân thủ Luật ĐT 22/2023
          </div>
        </div>
      </header>

      <WinWorkNav />

      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
