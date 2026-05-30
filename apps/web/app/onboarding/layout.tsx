import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@atlas/auth";
import { prisma } from "@atlas/db";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/signin?callbackUrl=/onboarding/org");
  // Defend against stale JWT after a DB wipe — bounce to signout if user gone
  const userRow = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } });
  if (!userRow) redirect("/api/auth/signout?callbackUrl=/signup");
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-blue-600 font-bold text-white">A</div>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">AEC Platform</span>
              <span className="text-base font-semibold text-slate-900">Viwase Quản lý công việc <span className="text-[10px] font-medium text-slate-400">· Module #1</span></span>
            </div>
          </Link>
          <span className="text-xs text-slate-500">Khởi tạo</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
